const fs = require("fs");
const path = require("path");

class RolloutManager {
  constructor(errorTracker, autoRollback) {
    this.errorTracker = errorTracker;
    this.autoRollback = autoRollback;
    this.stateFile = path.join(__dirname, "rollout-state.json");
    
    // Default phase config
    this.phases = [
      { percent: 5, durationSeconds: 60 },
      { percent: 25, durationSeconds: 120 },
      { percent: 50, durationSeconds: 120 }
    ];

    this.resetState();
    this.loadState();
    
    // If server restarted mid-rollout, resume progression
    if (this.status === "rolling_out" && !this.isPaused) {
      this.startTimer();
    }
  }

  resetState() {
    this.status = "idle"; // idle, rolling_out, paused, completed, aborted
    this.activePhaseIndex = null;
    this.elapsedSecondsInPhase = 0;
    this.isPaused = false;
    this.abortReason = "";
    this.timer = null;
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, "utf8");
        const parsed = JSON.parse(raw);
        this.status = parsed.status || "idle";
        this.activePhaseIndex = parsed.activePhaseIndex;
        this.elapsedSecondsInPhase = parsed.elapsedSecondsInPhase || 0;
        this.isPaused = parsed.isPaused || false;
        this.abortReason = parsed.abortReason || "";
        console.log("📥 Rollout state loaded successfully. Status:", this.status);
      }
    } catch (err) {
      console.error("⚠️ Failed to load rollout state:", err.message);
      this.resetState();
    }
  }

  saveState() {
    try {
      const state = {
        status: this.status,
        activePhaseIndex: this.activePhaseIndex,
        elapsedSecondsInPhase: this.elapsedSecondsInPhase,
        isPaused: this.isPaused,
        abortReason: this.abortReason
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error("⚠️ Failed to save rollout state:", err.message);
    }
  }

  start() {
    if (this.status === "rolling_out") return { success: false, error: "Rollout already in progress" };
    
    this.status = "rolling_out";
    this.activePhaseIndex = 0;
    this.elapsedSecondsInPhase = 0;
    this.isPaused = false;
    this.abortReason = "";
    
    console.log("🚀 Progressive rollout initialized. Step 1: 5% traffic.");
    this.saveState();
    this.startTimer();
    return { success: true };
  }

  pause() {
    if (this.status !== "rolling_out" || this.isPaused) {
      return { success: false, error: "No active rollout to pause" };
    }
    this.isPaused = true;
    this.stopTimer();
    this.saveState();
    console.log("⏸️ Rollout progression paused.");
    return { success: true };
  }

  resume() {
    if (this.status !== "rolling_out" || !this.isPaused) {
      return { success: false, error: "Rollout is not paused" };
    }
    this.isPaused = false;
    this.startTimer();
    this.saveState();
    console.log("▶️ Rollout progression resumed.");
    return { success: true };
  }

  abort(reason = "Manual abort") {
    if (this.status === "idle" || this.status === "aborted" || this.status === "completed") {
      return { success: false, error: "No active rollout to abort" };
    }
    
    this.status = "aborted";
    this.stopTimer();
    this.abortReason = reason;
    this.activePhaseIndex = null;
    this.elapsedSecondsInPhase = 0;
    this.isPaused = false;
    
    console.warn(`🚨 ROLLOUT ABORTED. Reason: ${reason}. Returning all traffic to stable URL.`);
    this.saveState();
    
        // Explicit fail-safe back to stable URL in proxy config
    if (this.autoRollback) {
      try {
        this.autoRollback.manualRollback();
      } catch (err) {
        console.error("Failed to trigger auto-rollback inside manager:", err.message);
      }
    }
    return { success: true };
  }

  promote() {
    this.status = "completed";
    this.stopTimer();
    this.activePhaseIndex = null;
    this.elapsedSecondsInPhase = 0;
    this.isPaused = false;
    
    console.log("🎉 Progressive rollout completed. 100% traffic promoted to canary/test backend.");
    this.saveState();
    return { success: true };
  }

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick() {
    if (this.status !== "rolling_out" || this.isPaused) {
      this.stopTimer();
      return;
    }

    this.elapsedSecondsInPhase++;
    
    const currentPhase = this.phases[this.activePhaseIndex];
    if (!currentPhase) {
      this.promote();
      return;
    }

    // Proactive health checking based on proxy stats
    if (this.errorTracker) {
      const stats = this.errorTracker.getStats();
      const errorRate = parseFloat(stats.errorRatePercent || 0);
      if (errorRate >= 20) {
        this.abort("System error rate exceeded 20% threshold");
        return;
      }
    }

    // Check if phase interval complete, transition to next phase
    if (this.elapsedSecondsInPhase >= currentPhase.durationSeconds) {
      this.activePhaseIndex++;
      this.elapsedSecondsInPhase = 0;
      
      if (this.activePhaseIndex >= this.phases.length) {
        this.promote();
      } else {
        const nextPhase = this.phases[this.activePhaseIndex];
        console.log(`➔ Progressive rollout transitioned to Phase ${this.activePhaseIndex + 1}: ${nextPhase.percent}% traffic.`);
        this.saveState();
      }
    } else {
      // Save state every 5 seconds to reduce write load, or on transition
      if (this.elapsedSecondsInPhase % 5 === 0) {
        this.saveState();
      }
    }
  }

  getCanaryPercent() {
    if (this.status === "completed") return 100;
    if (this.status !== "rolling_out") return 0;
    
    const phase = this.phases[this.activePhaseIndex];
    return phase ? phase.percent : 0;
  }

  getStatus() {
    const currentPhase = this.status === "rolling_out" ? this.phases[this.activePhaseIndex] : null;
    return {
      status: this.status,
      activePhaseIndex: this.activePhaseIndex,
      activePhaseName: this.status === "rolling_out" ? `Phase ${this.activePhaseIndex + 1}` : this.status,
      canaryPercent: this.getCanaryPercent(),
      elapsedSecondsInPhase: this.elapsedSecondsInPhase,
      durationSeconds: currentPhase ? currentPhase.durationSeconds : 0,
      isPaused: this.isPaused,
      abortReason: this.abortReason,
      phases: this.phases
    };
  }
}

module.exports = RolloutManager;
