const { execSync } = require("child_process");

function createCheckpoint() {
  try {
    execSync("git add .");
    execSync('git commit -m "AUTO CHECKPOINT BEFORE AI PATCH"');

    console.log("📌 Git checkpoint created");
  } catch (err) {
    console.error("Checkpoint failed:", err.message);
  }
}

module.exports = { createCheckpoint };