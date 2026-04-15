const { retrieveRelevantLogs } = require("../rag/retriever");
const { runExecutionAgent } = require("./execute-actions");
const { setAIState } = require("./ai-state");

// ==============================
// SMART FALLBACK LOG BUILDER
// Constructs synthetic log entries from live stats
// when both filesystem and Pinecone have nothing
// ==============================
function buildFallbackLogs(stats, errorRate) {
  const logs = [];

  const totalRequests = stats.totalRequests || 0;
  const totalErrors = stats.totalErrors || 0;
  const successCount = totalRequests - totalErrors;

  // Derive status code distribution heuristically from error rate
  // High error rate (>40%) → likely 500s (server crash / backend down)
  // Medium (20-40%) → mix of 500 and 502/503 (proxy/timeout)
  // Low but present (<20%) → mostly 404s or occasional 400s

  if (errorRate >= 40) {
    logs.push({
      statusCode: 500,
      path: "/api",
      responseBody: {
        message: `Internal Server Error — ${totalErrors} failures out of ${totalRequests} requests (${errorRate}% error rate)`,
      },
    });
    logs.push({
      statusCode: 503,
      path: "/api/health",
      responseBody: {
        message: `Service Unavailable — backend returning repeated 5xx errors`,
      },
    });
    logs.push({
      statusCode: 500,
      path: "/api/data",
      responseBody: {
        message: `Upstream server error — possible crash or OOM on canary backend`,
      },
    });
  } else if (errorRate >= 20) {
    logs.push({
      statusCode: 502,
      path: "/api",
      responseBody: {
        message: `Bad Gateway — proxy cannot reach upstream backend (${totalErrors} errors recorded)`,
      },
    });
    logs.push({
      statusCode: 500,
      path: "/api/process",
      responseBody: {
        message: `Internal error on canary server — ${errorRate}% of ${totalRequests} requests failing`,
      },
    });
    logs.push({
      statusCode: 504,
      path: "/api/query",
      responseBody: {
        message: `Gateway Timeout — upstream did not respond in time`,
      },
    });
  } else if (errorRate > 0) {
    logs.push({
      statusCode: 404,
      path: "/api/unknown",
      responseBody: {
        message: `Not Found — some routes returning 404 (${totalErrors} errors, ${errorRate}% error rate)`,
      },
    });
    logs.push({
      statusCode: 400,
      path: "/api/request",
      responseBody: {
        message: `Bad Request — malformed inputs detected on ${totalErrors} requests`,
      },
    });
  } else {
    // No errors at all — still run analysis as a health check
    logs.push({
      statusCode: 200,
      path: "/api",
      responseBody: {
        message: `All ${totalRequests} requests successful — system healthy, no errors detected`,
      },
    });
  }

  // Always add a summary entry
  logs.push({
    statusCode: errorRate > 20 ? 500 : 200,
    path: "/summary",
    responseBody: {
      message: `Traffic summary: ${totalRequests} total requests, ${totalErrors} errors, ${successCount} successes, error rate ${errorRate}%`,
    },
  });

  return logs;
}

// ==============================
// MAIN ANALYSIS AGENT
// ==============================
async function runAnalysisAgent({ errorRate, stats }) {
  console.log("🧠 AnalysisAgent: starting analysis...");
  console.log("📊 Input — errorRate:", errorRate, "stats:", stats);

  try {
    // ==============================
    // STEP 1: Try Pinecone RAG first
    // ==============================
    let relevantLogs = [];

    try {
      relevantLogs = await retrieveRelevantLogs(
        "errors failures crashes 500 502 503 504 timeout database db error exception"
      );
      console.log("🔍 RAG logs retrieved:", relevantLogs.length);
    } catch (e) {
      console.warn("[AnalysisAgent] RAG failed:", e.message);
    }

    // ==============================
    // STEP 2: Smart fallback if RAG empty
    // Uses live stats to build realistic log entries
    // ==============================
    if (!relevantLogs || relevantLogs.length === 0) {
      console.warn(
        "[AnalysisAgent] RAG returned nothing — building smart fallback from live stats"
      );
      relevantLogs = buildFallbackLogs(stats, errorRate);
      console.log(
        "🔧 Fallback logs built:",
        relevantLogs.length,
        "entries from live stats"
      );
    }

    const topLogs = relevantLogs.slice(0, 20);

    // ==============================
    // STEP 3: Build log summary for Groq
    // ==============================
    const logSummary = topLogs
      .map((l) => {
        let msg = "Unknown";

        if (typeof l.responseBody === "string") {
          msg = l.responseBody;
        } else if (l.responseBody?.message) {
          msg = l.responseBody.message;
        } else if (l.responseBody?.error) {
          msg = l.responseBody.error;
        } else if (l.text) {
          msg = l.text;
        }

        return `Status:${l.statusCode} Path:${l.path || "/api"} Message:"${msg.substring(0, 150)}"`;
      })
      .join("\n");

    console.log("📋 Log summary for AI:\n", logSummary);

    // ==============================
    // STEP 4: Build Groq prompt
    // ==============================
    const prompt = `
You are an autonomous SRE incident analysis agent for a production proxy system called LogWatchAI.

Analyze these error logs and return ONLY valid JSON — no markdown, no explanation, no text before or after.

CURRENT SYSTEM STATE:
- Error Rate: ${errorRate}%
- Total Requests: ${stats.totalRequests || 0}
- Total Errors: ${stats.totalErrors || 0}
- Successful Requests: ${(stats.totalRequests || 0) - (stats.totalErrors || 0)}

ERROR LOGS:
${logSummary}

RULES:
1. Output EXACTLY this JSON structure, nothing else
2. "errors" array must have 2-4 entries based on what you see in the logs
3. "cause" must reference the actual error message in the logs above
4. "fix" must be a concrete, specific action — not generic advice
5. "backend" is either "stable" (port 5001) or "canary" (port 5002/test)
6. If errorRate > 20 → actions MUST include "ROLLBACK"
7. If repeated 500/503 errors → actions MUST include "RESTART_SERVICE"
8. If errorRate < 5 → actions should be ["IGNORE"] or ["MONITOR"]
9. "risk" must match: LOW if errorRate<10, MEDIUM if 10-30, HIGH if >30

REQUIRED JSON FORMAT:
{
  "errors": [
    {
      "code": "500",
      "backend": "canary",
      "cause": "specific cause extracted from the log message above",
      "fix": "specific actionable fix for this exact error",
      "severity": "HIGH"
    }
  ],
  "actions": ["ROLLBACK"],
  "risk": "HIGH",
  "recommendation": "one specific sentence about what to do right now based on the actual errors"
}
`;

    // ==============================
    // STEP 5: Call Groq
    // ==============================
    console.log("📡 Calling Groq API...");

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1, // Lower = more deterministic JSON output
          max_tokens: 1000,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[AnalysisAgent] Groq HTTP error:", response.status, errText);
      return null;
    }

    const data = await response.json();

    if (!data.choices?.length) {
      console.error("[AnalysisAgent] Groq returned no choices:", JSON.stringify(data));
      return null;
    }

    // ==============================
    // STEP 6: Safe JSON parse
    // ==============================
    let ai;

    try {
      const raw = data.choices[0].message.content.trim();
      console.log("🤖 Raw Groq output:", raw);

      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");

      if (start === -1 || end === -1) throw new Error("No JSON object found in response");

      const cleaned = raw.substring(start, end + 1);
      ai = JSON.parse(cleaned);
    } catch (e) {
      console.error("[AnalysisAgent] JSON parse failed:", e.message);
      console.log("RAW OUTPUT:", data.choices[0].message.content);
      return null;
    }

    if (!ai || !ai.actions || !ai.errors) {
      console.warn("[AnalysisAgent] AI response missing required fields:", ai);
      return null;
    }

    console.log("✅ AI Decision:\n", JSON.stringify(ai, null, 2));

    // ==============================
    // STEP 7: Update AI state
    // ==============================
    setAIState({
      ...ai,
      errorRate,
      stats,
      logsAnalyzed: topLogs.length,
      timestamp: Date.now(),
    });

    // ==============================
    // STEP 8: Execute actions
    // ==============================
    await runExecutionAgent({
      actions: ai.actions,
      errors: ai.errors,
      risk: ai.risk,
      recommendation: ai.recommendation,
      errorRate,
      stats,
    });

    console.log("✅ AnalysisAgent complete → ExecutionAgent triggered");

    return ai;
  } catch (err) {
    console.error("[AnalysisAgent ERROR]", err.message, err.stack);
    return null;
  }
}

module.exports = { runAnalysisAgent };