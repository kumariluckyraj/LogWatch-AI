const runExecutionAgent = async ({ actions = [], errorRate, autoRollback }) => {
  const results = [];

  if (!autoRollback) {
    console.error("❌ AutoRollback instance missing");
    return results;
  }

  const uniqueActions = [...new Set(actions)];

  for (const action of uniqueActions) {
    try {
      switch (action) {
        case "ROLLBACK":
          if (errorRate < 10) {
            console.log("🚫 Skipping rollback (low error rate)");
            results.push({ action, status: "skipped" });
            break;
          }

          console.log("⚠️ Agent triggering rollback", { errorRate });

          const result = autoRollback.checkAndRollback(errorRate);

          results.push({
            action,
            status: result?.rolled ? "executed" : "no-change",
            details: result,
          });

          break;

        case "RESTART_SERVICE":
          console.log("🔁 Restart service (not implemented yet)");
          results.push({ action, status: "pending" });
          break;

        case "IGNORE":
          console.log("✅ Agent ignored issue");
          results.push({ action, status: "ignored" });
          break;

        default:
          console.log("❓ Unknown action:", action);
          results.push({ action, status: "unknown" });
      }
    } catch (err) {
      console.error("[ExecutionAgent ERROR]", err.message);
      results.push({ action, status: "failed" });
    }
  }

  console.log("⚙️ Execution results:", results);

  return results;
};

module.exports = { runExecutionAgent };