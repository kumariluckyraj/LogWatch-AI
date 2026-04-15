const express = require("express");
const httpProxy = require("http-proxy");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");

const { ingestLogs } = require("./rag/ingest");
const { retrieveRelevantLogs } = require("./rag/retriever");
const { runPatchAgent } = require("./agents/patch-agent");
const { applyPatch } = require("./agents/patch-executor");
const { createCheckpoint } = require("./utils/git-checkpoint");
const TriggerAgent = require("./agents/trigger-agent");
const { runAnalysisAgent } = require("./agents/analysis-agent");
const { getAIState } = require("./agents/ai-state");

const app = express();
const proxy = httpProxy.createProxyServer({ changeOrigin: true });

// ================= INIT =================
const logger = new EnhancedLogger();
const errorTracker = new ErrorTracker(100);
const autoRollback = new AutoRollback(20);

const triggerAgent = new TriggerAgent(errorTracker, {
  errorThreshold: 20,
  minRequests: 20,
  cooldownMs: 60000,
});

// ================= MIDDLEWARE =================
app.use(express.json());

// Allow all origins — tighten this in production
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Disable caching on ALL /api routes — fixes 304 empty body issue
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ================= CONFIG =================
const getConfig = () => {
  try {
    return JSON.parse(fs.readFileSync("./config.json", "utf8"));
  } catch {
    return {
      mode: "stable",
      stable_url: "https://logwatch-stable.onrender.com",
      test_url: "https://logwatch-test.onrender.com",
      canary_percent: 10,
    };
  }
};

const saveConfig = (config) => {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
};

// ================= PATCH VALIDATION =================
function isValidPatch(patch) {
  if (!patch?.file || !patch?.replacement) return false;
  if (typeof patch.replacement !== "string") return false;
  if (patch.replacement.includes("TODO")) return false;
  if (patch.replacement.trim().length < 20) return false;
  return true;
}

// ================= ROUTES =================

// Health check — useful for UptimeRobot pings
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), ts: Date.now() });
});

// Stats — always returns live in-memory data
app.get("/api/stats", (req, res) => {
  res.json(errorTracker.getStats());
});

// Logs — returns today's logs from filesystem
// On Render this resets on restart, but live requests in same session will show
app.get("/api/logs", (req, res) => {
  const logs = logger.getTodayLogs();
  res.json({ logs: logs || [], count: logs?.length || 0 });
});

// Config
app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

app.post("/api/config", (req, res) => {
  const { mode } = req.body;

  if (!["stable", "test", "canary"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  const config = getConfig();
  config.mode = mode;
  saveConfig(config);

  res.json({ success: true, mode });
});

// Rollback history
app.get("/api/rollback-history", (req, res) => {
  try {
    const history = autoRollback.getRollbackHistory();
    res.json({ success: true, count: history.length, history });
  } catch (err) {
    console.error("[ROLLBACK HISTORY ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch rollback history" });
  }
});

// Manual emergency rollback
app.post("/api/rollback", (req, res) => {
  try {
    const config = getConfig();
    config.mode = "stable";
    saveConfig(config);
    console.log("🔄 Manual rollback triggered via API");
    res.json({ success: true, message: "Rolled back to stable" });
  } catch (err) {
    res.status(500).json({ error: "Rollback failed" });
  }
});

// ================= AI STATE =================
app.get("/api/ai/state", (req, res) => {
  res.json({ success: true, data: getAIState() });
});

// ================= DEBUG INGEST =================
// Call this manually to push current session logs into Pinecone
app.post("/api/debug/ingest", async (req, res) => {
  const logs = logger.getTodayLogs();

  const normalized = (logs || []).map((l) => ({
    statusCode: l.statusCode || l.status || 200,
    path: l.path || l.url || "unknown",
    responseBody: l.responseBody || l.body || null,
  }));

  try {
    await ingestLogs(normalized);
    console.log("[DEBUG INGEST] Ingested", normalized.length, "logs to Pinecone");
  } catch (err) {
    console.error("[INGEST ERROR]", err.message);
    return res.status(500).json({ error: err.message });
  }

  res.json({ success: true, ingested: normalized.length });
});

// ================= ANALYZE =================
app.post("/api/analyze", async (req, res) => {
  console.log("🔍 /api/analyze called");

  try {
    const stats = errorTracker.getStats();
    const errorRate = parseFloat(
      stats.errorRatePercent || stats.errorRate || 0
    );

    console.log("📊 Current stats:", stats, "errorRate:", errorRate);

    // ================= 1. ANALYSIS =================
    const analysis = await runAnalysisAgent({ errorRate, stats });

    if (!analysis) {
      console.error("[ANALYZE] runAnalysisAgent returned null");
      return res.status(500).json({
        success: false,
        error: "AI analysis returned no result — check Render logs for Groq/Pinecone errors",
      });
    }

    // ================= 2. PATCH GENERATION =================
    let patch = null;

    try {
      patch = await runPatchAgent({ analysis, stats });
    } catch (err) {
      console.error("[PATCH AGENT ERROR]", err.message);
      // Non-fatal — analysis still succeeded
    }

    // ================= 3. APPLY PATCH SAFELY =================
    if (patch?.file) {
      console.log("🧠 Patch generated for:", patch.file);

      if (!isValidPatch(patch)) {
        console.log("❌ Invalid patch rejected");
        return res.json({
          success: true, // Analysis succeeded even if patch failed
          data: analysis,
          patch: null,
          patchError: "AI returned invalid patch — analysis result still valid",
        });
      }

      try {
        createCheckpoint();
        applyPatch(patch);
        console.log("🩹 Patch applied successfully");
      } catch (patchErr) {
        console.error("[PATCH APPLY ERROR]", patchErr.message);
        // Non-fatal
      }
    }

    res.json({
      success: true,
      data: analysis,
      patch: patch
        ? { file: patch.file, applied: true }
        : null,
    });

  } catch (err) {
    console.error("[ANALYZE ERROR]", err.message, err.stack);
    res.status(500).json({
      success: false,
      error: "Analysis failed: " + err.message,
    });
  }
});

// ================= PROXY RESPONSE CAPTURE =================
// Capture response body BEFORE it gets sent, so we can log it
proxy.on("proxyRes", (proxyRes, req, res) => {
  let body = [];

  proxyRes.on("data", (chunk) => body.push(chunk));

  proxyRes.on("end", () => {
    try {
      const raw = Buffer.concat(body).toString();
      req.responseBody = JSON.parse(raw);
    } catch {
      req.responseBody = Buffer.concat(body).toString();
    }
  });
});

// ================= PROXY =================
app.use((req, res) => {
  const config = getConfig();

  let target;
  if (config.mode === "test") {
    target = config.test_url;
  } else if (config.mode === "canary") {
    target =
      Math.random() * 100 < (config.canary_percent || 10)
        ? config.test_url
        : config.stable_url;
  } else {
    target = config.stable_url;
  }

  console.log(`➡️  Proxying ${req.method} ${req.path} → ${target} [mode: ${config.mode}]`);

  proxy.web(req, res, { target, changeOrigin: true });

  res.on("finish", async () => {
    const duration = Date.now() - req.startTime;

    // Log to filesystem (works in same session; resets on Render restart)
    try {
      logger.logRequest(req, res, duration, target, res.statusCode, req.responseBody);
    } catch (logErr) {
      console.error("[LOGGER ERROR]", logErr.message);
    }

    // Always track in-memory (survives for this session)
    errorTracker.addRequest(res.statusCode);

    const stats = errorTracker.getStats();
    const errorRate = parseFloat(
      stats.errorRatePercent || stats.errorRate || 0
    );

    console.log(`📊 ${req.method} ${req.path} → ${res.statusCode} | errorRate: ${errorRate}%`);

    // Ingest errors to Pinecone immediately — this is the persistent store
    if (res.statusCode >= 400) {
      const logEntry = {
        statusCode: res.statusCode,
        path: req.path,
        responseBody: req.responseBody || null,
      };

      try {
        await ingestLogs([logEntry]);
        console.log(`📥 Ingested ${res.statusCode} error to Pinecone`);
      } catch (err) {
        console.error("[INGEST ERROR]", err.message);
      }
    }

    // Auto-trigger AI agent if thresholds met
    try {
      await triggerAgent.observe({
        statusCode: res.statusCode,
        path: req.path,
        responseBody: req.responseBody,
        errorRate,
        autoRollback,
      });
    } catch (e) {
      console.error("[AGENT ERROR]", e.message);
    }
  });
});

// ================= PROXY ERROR =================
proxy.on("error", (err, req, res) => {
  console.error("[PROXY ERROR]", err.message);

  // Track proxy errors in error tracker too
  errorTracker.addRequest(502);

  if (!res.headersSent) {
    res.status(502).json({ error: "Bad Gateway", message: err.message });
  }
});

// ================= START =================
const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`🚀 LogWatchAI proxy running on port ${PORT}`);
  console.log("🤖 Agentic AI system ACTIVE");
  console.log("📡 Backends:", getConfig());

  // Seed Pinecone on startup so RAG always has at least one vector
  // This prevents the "no logs to analyze" failure on cold start
  try {
    await ingestLogs([
      {
        statusCode: 200,
        path: "/startup",
        responseBody: {
          message: `LogWatchAI proxy started. Monitoring active. Port: ${PORT}`,
        },
      },
    ]);
    console.log("✅ Pinecone seeded on startup");
  } catch (e) {
    console.error("⚠️  Pinecone seed failed (non-fatal):", e.message);
  }
});