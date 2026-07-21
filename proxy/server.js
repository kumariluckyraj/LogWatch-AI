const express = require("express");
const httpProxy = require("http-proxy");
const fs = require("fs");
require("dotenv").config();

const EnhancedLogger = require("./enhanced-logger");
const ErrorTracker = require("./error-tracker");
const AutoRollback = require("./auto-rollback");
const MetricsTracker = require("./metrics-tracker");

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
const metricsTracker = new MetricsTracker();

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

app.get("/api/metrics",(req, res) => { 
  const config= getConfig();

  res.json({
    ...metricsTracker.getMetrics(),activeBackend: config.mode
  });
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

// ================= ANALYTICS =================
app.get("/api/analytics/volume", (req, res) => {
  try {
    const logs = logger.getTodayLogs();
    if (!logs || logs.length === 0) {
      return res.json({
        success: true,
        data: {
          hourly: [],
          daily: [],
          severity: [],
          services: [],
          totalLogs: 0,
          dateRange: { from: null, to: null },
        },
      });
    }

    const timestamps = logs.map(l => new Date(l.timestamp).getTime()).filter(t => !isNaN(t));
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    // Hourly trends
    const hourlyMap = {};
    logs.forEach(l => {
      const d = new Date(l.timestamp);
      const hourKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      hourlyMap[hourKey] = (hourlyMap[hourKey] || 0) + 1;
    });
    const hourly = Object.entries(hourlyMap)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // Daily trends
    const dailyMap = {};
    logs.forEach(l => {
      const d = new Date(l.timestamp);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1;
    });
    const daily = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Severity distribution
    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    logs.forEach(l => {
      const code = l.statusCode || 200;
      if (code >= 500) severityCounts.CRITICAL++;
      else if ([429, 408].includes(code)) severityCounts.HIGH++;
      else if (code >= 400) severityCounts.MEDIUM++;
      else severityCounts.LOW++;
    });
    const severity = [
      { name: 'Critical', value: severityCounts.CRITICAL, color: '#ff4444' },
      { name: 'High', value: severityCounts.HIGH, color: '#f59e0b' },
      { name: 'Medium', value: severityCounts.MEDIUM, color: '#22d3ee' },
      { name: 'Low', value: severityCounts.LOW, color: '#00ff88' },
    ].filter(s => s.value > 0);

    // Service-wise breakdown
    const serviceMap = {};
    logs.forEach(l => {
      const service = l.target?.includes('5001') ? 'Stable' : l.target?.includes('5002') ? 'Test' : 'Unknown';
      serviceMap[service] = (serviceMap[service] || 0) + 1;
    });
    const services = Object.entries(serviceMap)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        hourly,
        daily,
        severity,
        services,
        totalLogs: logs.length,
        dateRange: {
          from: timestamps.length > 0 ? new Date(minTime).toISOString() : null,
          to: timestamps.length > 0 ? new Date(maxTime).toISOString() : null,
        },
      },
    });
  } catch (err) {
    console.error("Analytics error:", err.message);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.post("/api/analytics/export", (req, res) => {
  try {
    const { type, data } = req.body;
    let csvContent = '';

    if (type === 'hourly') {
      csvContent = 'Hour,Count\n' + data.map(row => `${row.hour},${row.count}`).join('\n');
    } else if (type === 'daily') {
      csvContent = 'Date,Count\n' + data.map(row => `${row.date},${row.count}`).join('\n');
    } else if (type === 'severity') {
      csvContent = 'Severity,Count\n' + data.map(row => `${row.name},${row.value}`).join('\n');
    } else if (type === 'services') {
      csvContent = 'Service,Count\n' + data.map(row => `${row.service},${row.count}`).join('\n');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=logwatch-analytics-${type}-${Date.now()}.csv`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
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

    metricsTracker.recordRequest(status, duration);

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