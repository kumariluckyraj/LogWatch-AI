const { retrieveRelevantLogs } = require("../rag/retriever");
const { runExecutionAgent } = require("./execute-actions");

class TriggerAgent {
  constructor(errorTracker, config = {}) {
    this.errorTracker = errorTracker;
    this.errorThreshold = config.errorThreshold || 20;
    this.minRequests = config.minRequests || 20;
    this.cooldownMs = config.cooldownMs || 60000;

    this.lastRun = 0;
  }

  async observe(log) {
    try {
      const stats = this.errorTracker.getStats();
      const errorRate = parseFloat(
        stats.errorRatePercent || stats.errorRate || 0
      );

      // ⛔ not enough traffic
      if (stats.totalRequests < this.minRequests) return null;

      // ⛔ below threshold
      if (errorRate < this.errorThreshold) return null;

      // ⛔ cooldown
      if (Date.now() - this.lastRun < this.cooldownMs) return null;

      console.log("🤖 TriggerAgent activated");

      this.lastRun = Date.now();

      let logs = await retrieveRelevantLogs(
        "errors failures crashes 500 502 503 timeout"
      );

      if (!logs || logs.length === 0) return null;

      const ai = await this.callAI(logs, errorRate);

      if (!ai) return null;

      console.log("🧠 Agent Decision:", ai);

      // ⚙️ EXECUTE ACTIONS
      await runExecutionAgent({
        actions: ai.actions,
        errorRate,
        autoRollback: log.autoRollback,
      });

      // 🚨 IMPORTANT: RETURN DECISION TO SERVER
      return this.mapDecision(ai, errorRate);

    } catch (err) {
      console.error("[TRIGGER AGENT ERROR]", err.message);
      return null;
    }
  }

 mapDecision(ai, errorRate) {
  if (ai.actions?.includes("ROLLBACK")) {
    return {
      action: "ROLLBACK_TO_STABLE",   // ← was ROLLBACK_TO_TEST (wrong!)
      reason: ai.recommendation || "AI detected failure spike",
      errorRate,
    };
  }

  return { action: "NO_ACTION", errorRate };
}

  async callAI(logs, errorRate) {
    try {
    const prompt = `
You are an autonomous SRE agent. Error rate is ${errorRate}%.

Rules:
- If error rate > 20% → actions must include "ROLLBACK"
- If error rate < 10% → actions must be ["IGNORE"]
- If 10-20% → actions must be ["RESTART_SERVICE"]

Return ONLY valid JSON, no explanation, no markdown:

{
  "errors": [{"code": "", "backend": "", "cause": "", "fix": "", "severity": "HIGH"}],
  "actions": ["ROLLBACK"],
  "risk": "HIGH",
  "recommendation": ""
}

Logs:
${logs.map(l => `Status:${l.statusCode} Path:${l.path}`).join("\n")}

Error Rate: ${errorRate}%
`;

      const res = await fetch(
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

      const data = await res.json();

      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;

      const raw = content.trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("No JSON object found");
      const cleaned = raw.substring(start, end + 1);

      return JSON.parse(cleaned);
    } catch (err) {
      console.error("[AI ERROR]", err.message);
      return null;
    }
  }
}

module.exports = TriggerAgent;