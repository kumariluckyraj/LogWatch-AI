const http = require("http");

const API_HOST = "127.0.0.1";
const API_PORT = 4000;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : "";
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(body)
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on("error", (e) => reject(e));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log("🧪 STARTING PROGRESSIVE ROLLOUT AUTOMATED INTEGRATION TESTS...");

  try {
    // 1. Get initial status
    console.log("\n1. Fetching initial status...");
    let statusRes = await makeRequest("GET", "/api/rollout/status");
    console.log("Current Status:", statusRes.data.status);
    
    // Abort if anything left over
    if (statusRes.data.status !== "idle" && statusRes.data.status !== "aborted" && statusRes.data.status !== "completed") {
      console.log("Cleaning up active rollout...");
      await makeRequest("POST", "/api/rollout/abort");
    }

    // 2. Start progressive rollout
    console.log("\n2. Triggering /api/rollout/start...");
    let startRes = await makeRequest("POST", "/api/rollout/start");
    console.log("Start Response:", startRes.statusCode === 200 ? "SUCCESS 🟢" : "FAILED 🔴");

    // 3. Verify status transitioned
    console.log("\n3. Checking status after start...");
    statusRes = await makeRequest("GET", "/api/rollout/status");
    console.log("New Status:", statusRes.data.status);
    console.log("Active Phase:", statusRes.data.activePhaseName);
    console.log("Canary Splits:", statusRes.data.canaryPercent + "%");

    if (statusRes.data.status !== "rolling_out" || statusRes.data.canaryPercent !== 5) {
      throw new Error("Rollout failed to start at Phase 1 (5% Split)");
    }
    console.log("Step 1 Splits verified successfully! ✅");

    // 4. Test Pause
    console.log("\n4. Triggering /api/rollout/pause...");
    let pauseRes = await makeRequest("POST", "/api/rollout/pause");
    statusRes = await makeRequest("GET", "/api/rollout/status");
    console.log("Pause response status:", pauseRes.statusCode);
    console.log("isPaused state:", statusRes.data.isPaused);
    if (!statusRes.data.isPaused) {
      throw new Error("Failed to transition into paused state");
    }
    console.log("Pause state verified successfully! ✅");

    // 5. Test Resume
    console.log("\n5. Triggering /api/rollout/resume...");
    let resumeRes = await makeRequest("POST", "/api/rollout/resume");
    statusRes = await makeRequest("GET", "/api/rollout/status");
    console.log("Resume response status:", resumeRes.statusCode);
    console.log("isPaused state after resume:", statusRes.data.isPaused);
    if (statusRes.data.isPaused) {
      throw new Error("Failed to resume from paused state");
    }
    console.log("Resume state verified successfully! ✅");

    // 6. Test Abort
    console.log("\n6. Triggering Emergency Abort /api/rollout/abort...");
    let abortRes = await makeRequest("POST", "/api/rollout/abort");
    statusRes = await makeRequest("GET", "/api/rollout/status");
    console.log("Abort response status:", abortRes.statusCode);
    console.log("State after Abort:", statusRes.data.status);
    if (statusRes.data.status !== "aborted") {
      throw new Error("Failed to abort rollout");
    }
    console.log("Abort and dynamic rollback verified successfully! ✅");

    console.log("\n🎉 ALL ROLLOUT ENGINE BACKEND API TESTS COMPLETED SUCCESSFULLY! 🟢");

  } catch (err) {
    console.error("\n❌ TESTS FAILED:", err.message);
  }
}

runTests();
