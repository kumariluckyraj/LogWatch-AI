const express = require("express");
const httpProxy = require("http-proxy");
const fs = require("fs");
require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");

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

// ✅ CORS FIX
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://logwatchai.vercel.app");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

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

// ================= PROXY RESPONSE CAPTURE =================
proxy.on("proxyRes", (proxyRes, req, res) => {
  let body = [];

  // 🔥 FIX: capture REAL backend status
  req.actualStatusCode = proxyRes.statusCode;

  // ✅ Force CORS headers on proxy responses
  proxyRes.headers["Access-Control-Allow-Origin"] =
    "https://logwatchai.vercel.app";

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

  console.log(`🔥 TARGET: ${target}`);
  console.log(`➡️ ${req.method} ${req.path}`);

  req.headers["x-forwarded-host"] = req.headers.host;
  req.headers["x-forwarded-proto"] = "https";

  proxy.web(req, res, {
    target,
    changeOrigin: true,
    secure: true,
    timeout: 30000,
  });

  res.on("finish", async () => {
    const duration = Date.now() - req.startTime;

    // 🔥 USE REAL STATUS
    const status = req.actualStatusCode || res.statusCode || 200;

    console.log("📡 BACKEND STATUS:", req.actualStatusCode);
    console.log("📡 FINAL STATUS:", res.statusCode);

    // LOGGING
    try {
      logger.logRequest(req, res, duration, target, status, req.responseBody);
    } catch (e) {
      console.error("Logger error:", e.message);
    }

    // TRACK ERRORS
    errorTracker.addRequest(status);

    const stats = errorTracker.getStats();
    const errorRate = parseFloat(stats.errorRatePercent || 0);

    console.log(`📊 ${status} | errorRate: ${errorRate}%`);

    // INGEST ERRORS
    if (status >= 400) {
      try {
        await ingestLogs([
          {
            statusCode: status,
            path: req.path,
            responseBody: req.responseBody,
          },
        ]);
        console.log("📥 Error ingested");
      } catch (e) {
        console.error("Ingest error:", e.message);
      }
    }

    // TRIGGER AI
    try {
      await triggerAgent.observe({
        statusCode: status,
        path: req.path,
        responseBody: req.responseBody,
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