const express = require("express");
const httpProxy = require("http-proxy");

require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");
const { getTarget, getConfig, saveConfig } = require("./router");

const { ingestLogs } = require("./rag/ingest");
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

// ✅ CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://logwatchai.vercel.app");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ✅ Disable caching
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// ================= ROUTES =================
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/stats", (req, res) => {
  res.json(errorTracker.getStats());
});

app.get("/api/logs", (req, res) => {
  const logs = logger.getTodayLogs();
  res.json({ logs: logs || [] });
});

app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

app.post("/api/config", (req, res) => {
  const { mode } = req.body;
  const config = getConfig();

  if (!["stable", "test", "canary"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  config.mode = mode;
  saveConfig(config);

  res.json({ success: true });
});

app.get("/api/rollback-history", (req, res) => {
  try {
    const history = autoRollback.getRollbackHistory();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.get("/api/ai/state", (req, res) => {
  res.json({ success: true, data: getAIState() });
});

// ================= ANALYZE =================
app.post("/api/analyze", async (req, res) => {
  console.log("🔍 AI ANALYSIS TRIGGERED");

  try {
    const stats = errorTracker.getStats();
    const errorRate = parseFloat(stats.errorRatePercent || 0);

    const analysis = await runAnalysisAgent({ errorRate, stats });

    res.json({
      success: true,
      data: analysis,
    });
  } catch (err) {
    console.error("❌ ANALYSIS ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= PROXY =================
app.use((req, res) => {
  const target = getTarget();

  req.target = target;

  console.log(`➡️ ${req.method} ${req.path} → ${target}`);

  proxy.web(req, res, {
    target,
    changeOrigin: true,
    secure: true,
    timeout: 30000,
  });
});

// ================= PROXY RESPONSE (FIXED CORE) =================
proxy.on("proxyRes", (proxyRes, req, res) => {
  let body = [];
  const status = proxyRes.statusCode || 200;

  console.log("📡 REAL STATUS:", status);

  proxyRes.on("data", (chunk) => body.push(chunk));

  proxyRes.on("end", async () => {
    let responseBody;

    try {
      responseBody = JSON.parse(Buffer.concat(body).toString());
    } catch {
      responseBody = Buffer.concat(body).toString();
    }

    const duration = Date.now() - (req.startTime || Date.now());

    // ================= LOGGING =================
    try {
      logger.logRequest(req, res, duration, req.target, status, responseBody);
    } catch (e) {
      console.error("Logger error:", e.message);
    }

    // ================= ERROR TRACKING =================
    errorTracker.addRequest(status);

    const stats = errorTracker.getStats();
    const errorRate = parseFloat(stats.errorRatePercent || 0);

    console.log(`📊 ${status} | errorRate: ${errorRate}%`);

    // ================= INGEST =================
    if (status >= 400) {
      try {
        await ingestLogs([
          {
            statusCode: status,
            path: req.path,
            responseBody,
          },
        ]);
        console.log("📥 Error ingested");
      } catch (e) {
        console.error("Ingest error:", e.message);
      }
    }

    // ================= AI TRIGGER =================
    try {
      await triggerAgent.observe({
        statusCode: status,
        path: req.path,
        responseBody,
        errorRate,
        autoRollback,
      });
    } catch (e) {
      console.error("Agent error:", e.message);
    }
  });
});

// ================= PROXY ERROR =================
proxy.on("error", (err, req, res) => {
  console.error("❌ PROXY ERROR:", err.message);

  errorTracker.addRequest(502);

  if (!res.headersSent) {
    res.status(502).json({
      error: "Bad Gateway",
      message: err.message,
    });
  }
});

// ================= START =================
const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  try {
    await ingestLogs([
      {
        statusCode: 200,
        path: "/startup",
        responseBody: { message: "Server started" },
      },
    ]);
    console.log("✅ Pinecone seeded");
  } catch (e) {
    console.log("⚠️ Seed failed:", e.message);
  }
});
