const fs = require("fs");

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync("./config.json", "utf8"));
  } catch (err) {
    console.error("❌ Failed to read config:", err.message);

    return {
      mode: "stable",
      stable_url: "http://127.0.0.1:5001",
      test_url: "http://127.0.0.1:5002",
      canary_percent: 10,
    };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Failed to save config:", err.message);
  }
}

function getTarget() {
  const config = getConfig();

  switch (config.mode) {
    case "stable":
      return config.stable_url;

    case "test":
      return config.test_url;

    case "canary":
      return Math.random() * 100 < config.canary_percent
        ? config.test_url
        : config.stable_url;

    default:
      console.warn(`⚠️ Unknown mode "${config.mode}", falling back to stable`);

      return config.stable_url;
  }
}

module.exports = {
  getTarget,
  getConfig,
  saveConfig,
};
