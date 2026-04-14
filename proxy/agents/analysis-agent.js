const { retrieveRelevantLogs } = require("../rag/retriever");
const { runExecutionAgent } = require("./execute-actions");
const { setAIState } = require("./ai-state");

async function runAnalysisAgent({ errorRate, stats }) {
  console.log("🧠 AnalysisAgent: starting analysis...");

  try {
    // ==============================
    // STEP 1: Retrieve logs via RAG
    // ==============================
    let relevantLogs = [];

    try {
      relevantLogs = await retrieveRelevantLogs(
        "errors failures crashes 500 502 503 504 timeout database db error exception"
      );
      console.log("🔍 Logs retrieved:", relevantLogs.length);
    } catch (e) {
      console.warn("[AnalysisAgent] RAG failed:", e.message);
    }

    if (!relevantLogs || relevantLogs.length === 0) {
      console.warn("[AnalysisAgent] No logs to analyze");
      return null;
    }

    // ==============================
    // STEP 1.1: FILTER IMPORTANT LOGS ONLY
    // ==============================
    const importantLogs = (relevantLogs || []).filter((l) => {
      const code = l.statusCode;

      return (
        code >= 500 ||
        code === 404 ||
        (l.responseBody?.message &&
          String(l.responseBody.message).toLowerCase().includes("error"))
      );
    });

    const topLogs = importantLogs.slice(0, 20);

    if (!topLogs.length) {
      console.warn("[AnalysisAgent] No important logs found");
      return null;
    }

    // ==============================
    // STEP 2: AI PROMPT (STRUCTURED INCIDENT REPORT)
    // ==============================
    const prompt = `
You are an autonomous SRE incident analysis agent.

Analyze logs and return ONLY valid JSON.

RULES:
- You MUST output exactly 4 error entries in the array. If there are fewer than 4 distinct real errors, creatively extract minor issues, performance warnings, database context, or break down the main error into multiple sub-issues to guarantee AT LEAST 4 errors are returned.
- Rank by severity (HIGH first)
- Never return fewer than 4 errors. Provide realistic SRE insights for any padded errors.
- Do NOT output any words, markdown, or conversational text before or after the JSON. Return ONLY the JSON object starting with { and ending with }.

STRICT FORMAT:

{
  "errors": [
    {
      "code": "",
      "backend": "",
      "cause": "",
      "fix": "",
      "severity": "LOW | MEDIUM | HIGH"
    }
  ],
  "actions": ["ROLLBACK", "RESTART_SERVICE", "IGNORE"],
  "risk": "LOW | MEDIUM | HIGH",
  "recommendation": ""
}

IMPORTANT RULES:
- If errorRate > 20 → include "ROLLBACK"
- If repeated 500 errors → include "RESTART_SERVICE"
- Always include at least one action

LOGS:
${topLogs
        .map(
          (l) =>
            `Status:${l.statusCode} Path:${l.path} Msg:${l.responseBody?.message ||
            (typeof l.responseBody === "string" ? l.responseBody : "Unknown")
            }`
        )
        .join("\n")}

Error Rate: ${errorRate}%
`;

    // ==============================
    // STEP 3: CALL GROQ
    // ==============================
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
          temperature: 0.2,
        }),
      }
    );

    const data = await response.json();

    if (!data.choices?.length) {
      console.error("[AnalysisAgent] Groq failed:", data);
      return null;
    }

    // ==============================
    // STEP 4: SAFE JSON PARSE
    // ==============================
    let ai;

    try {
      const raw = data.choices[0].message.content.trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("No JSON object found");
      const cleaned = raw.substring(start, end + 1);
      ai = JSON.parse(cleaned);
    } catch (e) {
      console.error("[AnalysisAgent] JSON parse failed");
      console.log("RAW OUTPUT:", data.choices[0].message.content);
      return null;
    }

    if (!ai || !ai.actions) {
      console.warn("[AnalysisAgent] Invalid AI response");
      return null;
    }

    console.log("🧠 AI Decision:\n", JSON.stringify(ai, null, 2));

    // ==============================
    // STEP 5: UPDATE AI STATE (FOR UI)
    // ==============================
    setAIState({
      ...ai,
      errorRate,
      stats,
      logsAnalyzed: topLogs.length,
      timestamp: Date.now(),
    });

    // ==============================
    // STEP 6: EXECUTE ACTIONS
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

    // ==============================
    // STEP 7: RETURN RESULT (IMPORTANT)
    // ==============================
    return ai;

  } catch (err) {
    console.error("[AnalysisAgent ERROR]", err.message);
    return null;
  }
}

module.exports = { runAnalysisAgent };