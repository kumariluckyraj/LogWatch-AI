const express = require("express");
const app = express();

app.use(express.json());

// ==============================
// RANDOM ERROR GENERATOR
// ==============================
const randomError = () => {
  const errors = [
    () => ({
      status: 500,
      message: "Database connection pool exhausted",
    }),
    () => ({
      status: 500,
      message: "Deadlock detected - transaction rolled back",
    }),
    () => ({
      status: 503,
      message: "Service unavailable - backend overloaded",
    }),
    () => ({
      status: 504,
      message: "Gateway timeout - upstream not responding",
    }),
    () => ({
      status: 429,
      message: "Rate limit exceeded",
    }),
    () => ({
      status: 500,
      message: "Redis cache connection failed",
    }),
    () => ({
      status: 500,
      message: "Out of memory - heap limit exceeded",
    }),
    () => ({
      status: 400,
      message: "Validation error - invalid input",
    }),
  ];

  return errors[Math.floor(Math.random() * errors.length)]();
};

// ==============================
// MAIN API (REALISTIC TRAFFIC)
// ==============================
app.get("/api", (req, res) => {
  // 50% chance of failure
  if (Math.random() < 0.5) {
    const err = randomError();

    return res.status(err.status).json({
      error: "Error",
      message: err.message,
      timestamp: new Date().toISOString(),
      backend: "test",
    });
  }

  res.json({
    status: "ok",
    backend: "test",
    latency: Math.floor(Math.random() * 100),
    timestamp: new Date().toISOString(),
  });
});

// ==============================
// DEDICATED ERROR ROUTES (MANUAL TEST)
// ==============================
app.get("/error/db", (req, res) => {
  res.status(500).json({
    message: "Database connection pool exhausted",
  });
});

app.get("/error/memory", (req, res) => {
  res.status(500).json({
    message: "Out of memory - heap exceeded",
  });
});

app.get("/error/timeout", (req, res) => {
  res.status(504).json({
    message: "Gateway timeout - upstream slow",
  });
});

app.get("/error/rate-limit", (req, res) => {
  res.status(429).json({
    message: "Too many requests",
  });
});

app.get("/error/cache", (req, res) => {
  res.status(500).json({
    message: "Redis cache connection failed",
  });
});

app.get("/error/validation", (req, res) => {
  res.status(400).json({
    message: "Validation failed",
  });
});

// ==============================
// CASCADE FAILURE SIMULATION
// ==============================
let cascadeCount = 0;

app.get("/error/cascade", (req, res) => {
  cascadeCount++;

  if (cascadeCount > 5) {
    return res.status(503).json({
      message: "System-wide failure - multiple services down",
      failed_services: ["DB", "Cache", "Queue"],
    });
  }

  res.json({
    status: "ok",
    cascade_step: cascadeCount,
  });
});

// ==============================
// PARTIAL FAILURE
// ==============================
app.get("/error/partial", (req, res) => {
  const rand = Math.random();

  if (rand < 0.3) {
    return res.status(500).json({ message: "Database timeout" });
  } else if (rand < 0.6) {
    return res.status(503).json({ message: "Service degraded" });
  } else if (rand < 0.9) {
    return res.status(429).json({ message: "Rate limit hit" });
  }

  res.json({ status: "ok" });
});

// ==============================
// HEALTH CHECK
// ==============================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    backend: "test",
    timestamp: new Date().toISOString(),
  });
});

// ==============================
// FALLBACK ROUTE (FIXED FOR NODE 22)
// ==============================
app.use((req, res) => {
  if (Math.random() < 0.4) {
    const err = randomError();

    return res.status(err.status).json({
      error: "Error",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    status: "ok",
    backend: "test",
    path: req.path,
  });
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`🚀 TEST BACKEND running on port ${PORT}`);
});