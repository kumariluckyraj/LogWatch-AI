const fs = require("fs");

class AutoRollback {
  constructor(errorThreshold = 20) {
    this.errorThreshold = errorThreshold;
    this.history = []; // ✅ unified naming
    this.maxHistory = 50; // ✅ prevent memory leak
  }

  checkAndRollback(currentErrorRatePercent) {
    const errorRate = parseFloat(currentErrorRatePercent) || 0;

    // ❌ No rollback needed
    if (errorRate <= this.errorThreshold) {
      return {
        success: true,
        rolled: false,
        errorRate,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`\n🚨 ERROR RATE ${errorRate}% > ${this.errorThreshold}%`);
    console.log("⚡ INITIATING AUTO-ROLLBACK...\n");

    try {
      const configData = fs.readFileSync("./config.json", "utf8");
      const config = JSON.parse(configData);

      const previousMode = config.mode;

      // 🛑 Already stable → skip
      if (previousMode === "stable") {
        console.log("ℹ️ Already in stable mode, skipping rollback\n");

        return {
          success: true,
          rolled: false,
          message: "Already in stable mode",
          errorRate,
        };
      }

      // 🔁 Perform rollback
      config.mode = "stable";
      fs.writeFileSync("./config.json", JSON.stringify(config, null, 2), "utf8");

      const rollbackEvent = {
        timestamp: new Date().toISOString(),
        previousMode,
        newMode: "stable",
        errorRate,
        threshold: this.errorThreshold,
      };

      // ✅ Save history
      this.history.push(rollbackEvent);

      // ✅ Limit history size
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      console.log("✅ ROLLBACK COMPLETED");
      console.log(`➡️ ${previousMode} → stable`);
      console.log(`📊 Error Rate: ${errorRate}%\n`);

      return {
        success: true,
        rolled: true,
        ...rollbackEvent,
      };

    } catch (err) {
      console.error("❌ ROLLBACK FAILED:", err.message);

      return {
        success: false,
        error: err.message,
      };
    }
  }

  // 📊 Used by /api/rollback-history
  getRollbackHistory() {
    return this.history;
  }

  // 📈 Extra stats (optional API)
  getStats() {
    return {
      threshold: this.errorThreshold,
      rollbackCount: this.history.length,
      lastRollback:
        this.history.length > 0
          ? this.history[this.history.length - 1]
          : null,
      history: this.history,
    };
  }

  // 🔧 Manual rollback (for testing / admin)
  manualRollback() {
    try {
      const configData = fs.readFileSync("./config.json", "utf8");
      const config = JSON.parse(configData);

      const previousMode = config.mode;

      if (previousMode === "stable") {
        return {
          success: true,
          message: "Already in stable mode",
        };
      }

      config.mode = "stable";
      fs.writeFileSync("./config.json", JSON.stringify(config, null, 2), "utf8");

      const event = {
        timestamp: new Date().toISOString(),
        previousMode,
        newMode: "stable",
        manual: true,
      };

      this.history.push(event);

      console.log(`🔧 MANUAL ROLLBACK: ${previousMode} → stable`);

      return {
        success: true,
        ...event,
      };

    } catch (err) {
      console.error("❌ Manual rollback failed:", err.message);

      return {
        success: false,
        error: err.message,
      };
    }
  }
}

module.exports = AutoRollback;