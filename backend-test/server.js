// ============================================
// backend-test/server.js - REALISTIC ERROR GENERATOR.
// ============================================
// Real error messages that DBAs & developers care about

const express = require("express");
const app = express();

app.use(express.json());

// Random 40% failure rate
const randomFail = () => Math.random() < 0.4;

// ============================================
// BASE API - 40% random failures
// ============================================
app.get("/api", (req, res) => {
  if (randomFail()) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Database connection pool exhausted",
      timestamp: new Date().toISOString(),
      details: {
        pool_size: 10,
        active_connections: 10,
        waiting: 5
      }
    });
  }
  res.json({ status: "ok", backend: "test", latency: Math.random() * 100 });
});

// ============================================
// DATABASE ERRORS (Most Important!)
// ============================================

// Connection Pool Exhausted
app.get("/error/db-pool", (req, res) => {
  res.status(503).json({
    error: "Service Unavailable",
    message: "Database connection pool exhausted - all 50 connections in use",
    timestamp: new Date().toISOString(),
    details: {
      service: "MySQL Connection Pool",
      available: 0,
      total: 50,
      in_use: 50,
      waiting_requests: 12
    }
  });
});

// Query Timeout
app.get("/error/query-timeout", (req, res) => {
  setTimeout(() => {
    res.status(504).json({
      error: "Gateway Timeout",
      message: "Query execution exceeded 30s timeout - SELECT * FROM large_table JOIN another_table",
      timestamp: new Date().toISOString(),
      details: {
        query: "SELECT * FROM users JOIN orders ON users.id = orders.user_id WHERE status='pending'",
        timeout_ms: 30000,
        query_type: "JOIN",
        tables: ["users", "orders"],
        estimated_rows: 5000000
      }
    });
  }, 35000);
});

// Constraint Violation
app.get("/error/constraint", (req, res) => {
  res.status(409).json({
    error: "Conflict",
    message: "Unique constraint violation on email field",
    timestamp: new Date().toISOString(),
    details: {
      constraint: "uk_users_email",
      field: "email",
      value: "user@example.com",
      table: "users"
    }
  });
});

// Deadlock
app.get("/error/deadlock", (req, res) => {
  res.status(500).json({
    error: "Internal Server Error",
    message: "Deadlock detected - Transaction rolled back",
    timestamp: new Date().toISOString(),
    details: {
      error_type: "Deadlock",
      transaction: "UPDATE users SET balance = balance - 100",
      waiting_for: "transaction_12345",
      retries: 3
    }
  });
});

// Out of Disk Space
app.get("/error/disk-space", (req, res) => {
  res.status(507).json({
    error: "Insufficient Storage",
    message: "Database disk space exhausted - cannot write data",
    timestamp: new Date().toISOString(),
    details: {
      disk_used: "99.8%",
      available: "2GB",
      database: "production_db",
      growth_rate: "500MB/day"
    }
  });
});

// Authentication Failed
app.get("/error/auth-failed", (req, res) => {
  res.status(401).json({
    error: "Unauthorized",
    message: "Database authentication failed - invalid credentials for user 'dbuser'",
    timestamp: new Date().toISOString(),
    details: {
      database: "PostgreSQL",
      user: "dbuser",
      host: "db.prod.example.com",
      port: 5432,
      attempts: 5
    }
  });
});

// ============================================
// APPLICATION ERRORS (Real Issues)
// ============================================

// Memory Leak
app.get("/error/memory", (req, res) => {
  res.status(500).json({
    error: "Internal Server Error",
    message: "Process out of memory - heap size exceeded 2GB limit",
    timestamp: new Date().toISOString(),
    details: {
      heap_used: "2.1GB",
      heap_total: "2GB",
      external_memory: "512MB",
      process_id: 12345,
      uptime_hours: 48
    }
  });
});

// Unhandled Exception
app.get("/error/exception", (req, res) => {
  res.status(500).json({
    error: "Internal Server Error",
    message: "TypeError: Cannot read property 'email' of undefined",
    timestamp: new Date().toISOString(),
    details: {
      file: "controllers/user.js",
      line: 42,
      function: "getUserEmail",
      stack: "at getUserEmail (user.js:42:15)"
    }
  });
});

// Rate Limit
app.get("/error/rate-limit", (req, res) => {
  res.status(429).json({
    error: "Too Many Requests",
    message: "Rate limit exceeded - 1000 requests per minute limit reached",
    timestamp: new Date().toISOString(),
    details: {
      limit: 1000,
      window: "1 minute",
      requests_this_window: 1001,
      retry_after: 45
    }
  });
});

// Validation Error
app.get("/error/validation", (req, res) => {
  res.status(400).json({
    error: "Bad Request",
    message: "Validation failed: password must be at least 8 characters",
    timestamp: new Date().toISOString(),
    details: {
      field: "password",
      rule: "minLength",
      expected: 8,
      received: 5,
      value: "pass"
    }
  });
});

// ============================================
// SERVICE ERRORS (External Dependencies)
// ============================================

// External API Timeout
app.get("/error/external-timeout", (req, res) => {
  res.status(504).json({
    error: "Gateway Timeout",
    message: "External payment API timeout after 10s - service.payment.com",
    timestamp: new Date().toISOString(),
    details: {
      service: "Stripe Payment API",
      endpoint: "https://api.stripe.com/v1/charges",
      timeout: 10000,
      attempts: 2
    }
  });
});

// Cache Miss Cascade
app.get("/error/cache-miss", (req, res) => {
  res.status(500).json({
    error: "Internal Server Error",
    message: "Redis cache connection failed - falling back to database caused slowdown",
    timestamp: new Date().toISOString(),
    details: {
      service: "Redis Cache",
      status: "DOWN",
      fallback: "Direct Database",
      response_time: "2500ms (normal: 50ms)",
      request_id: "req_abc123xyz"
    }
  });
});

// ============================================
// CASCADING FAILURES
// ============================================
let cascadeCount = 0;
app.get("/error/cascade", (req, res) => {
  cascadeCount++;

  if (cascadeCount > 5) {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "System degradation - multiple service failures detected",
      timestamp: new Date().toISOString(),
      details: {
        failed_services: [
          "Database: Connection Pool Exhausted",
          "Cache: Redis Down",
          "Queue: RabbitMQ Overloaded",
          "Logging: Disk Space Low"
        ],
        affected_requests: cascadeCount,
        auto_recovery: "in_progress"
      }
    });
  }

  res.json({ status: "ok", cascade_count: cascadeCount });
});

// ============================================
// TIMEOUT ERRORS (SLOW)
// ============================================
app.get("/error/slow-response", (req, res) => {
  setTimeout(() => {
    res.status(504).json({
      error: "Gateway Timeout",
      message: "Request timeout after 45s - processing complex analytics query",
      timestamp: new Date().toISOString(),
      details: {
        operation: "Calculate monthly revenue by region",
        data_points: 5000000,
        processing_time: 45000,
        expected_time: 5000
      }
    });
  }, 45000);
});

// ============================================
// REALISTIC PARTIAL FAILURES
// ============================================
app.get("/error/partial", (req, res) => {
  const random = Math.random();

  if (random < 0.3) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Database connection timeout - unable to execute query",
      timestamp: new Date().toISOString()
    });
  } else if (random < 0.6) {
    return res.status(503).json({
      error: "Service Unavailable",
      message: "Service temporarily degraded - retry after 30 seconds",
      timestamp: new Date().toISOString()
    });
  } else if (random < 0.9) {
    return res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded",
      timestamp: new Date().toISOString()
    });
  }

  res.json({ status: "ok" });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    backend: "test",
    timestamp: new Date().toISOString()
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = 5002;
app.listen(PORT, () => {
  console.log(`\n🧪 TEST BACKEND running on http://127.0.0.1:${PORT}`);
  console.log("\n📊 REALISTIC ERROR ENDPOINTS:");
  console.log("GET  /api                        (40% random failures)");
  console.log("\n🗄️  DATABASE ERRORS:");
  console.log("GET  /error/db-pool              (Connection pool exhausted)");
  console.log("GET  /error/query-timeout        (Query timeout 30s+)");
  console.log("GET  /error/constraint           (Unique constraint violation)");
  console.log("GET  /error/deadlock             (Database deadlock)");
  console.log("GET  /error/disk-space           (Disk space exhausted)");
  console.log("GET  /error/auth-failed          (DB auth failed)");
  console.log("\n⚙️  APPLICATION ERRORS:");
  console.log("GET  /error/memory               (Out of memory)");
  console.log("GET  /error/exception            (Unhandled exception)");
  console.log("GET  /error/validation           (Validation error)");
  console.log("GET  /error/rate-limit           (Rate limit exceeded)");
  console.log("\n🔗 SERVICE ERRORS:");
  console.log("GET  /error/external-timeout     (External API timeout)");
  console.log("GET  /error/cache-miss           (Cache failure)");
  console.log("\n⛓️  CASCADING:");
  console.log("GET  /error/cascade              (Multiple failures)");
  console.log("GET  /error/partial              (Random failures)");
  console.log("GET  /error/slow-response        (Slow processing)");
  console.log("GET  /health                     (Health check)\n");
});