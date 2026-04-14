const fs = require("fs");
const path = require("path");

async function callAI(fileContent, errorMessage) {
  const prompt = `
You are an expert backend engineer.

Fix the following code based on the error.

ERROR:
${errorMessage}

CODE:
${fileContent}

IMPORTANT RULES:
- Return ONLY full corrected file code
- No explanations
- No markdown
- No backticks
- No comments like TODO
`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from Groq");

    let output = content.trim();

    // 🧠 CLEAN RESPONSE
    output = output.replace(/^```[a-z]*\n?/gm, "").replace(/```$/gm, "").trim();

    // ❌ VALIDATION (prevents bad patches)
    if (!output || output.length < 20) {
      throw new Error("AI returned empty or invalid code");
    }

    if (output.includes("TODO")) {
      throw new Error("AI returned placeholder code");
    }

    return output;
  } catch (err) {
    console.error("[AI ERROR]", err.message);
    throw err;
  }
}

async function runPatchAgent({ analysis, stats }) {
  if (!analysis || !analysis.errors || analysis.errors.length === 0) {
    return null;
  }

  const primaryError = analysis.errors[0];
  console.log("🛠️ PatchAgent analyzing root cause:", primaryError.cause);

  // Defaulting to the backend-test server.js for auto-patching demonstration
  const targetFile = path.resolve(__dirname, "../../backend-test/server.js");

  let fileContent;
  try {
    fileContent = fs.readFileSync(targetFile, "utf8");
  } catch (err) {
    console.error("❌ Failed to read target file for patching.");
    return null;
  }

  // Generate patch code using Llama-3.1
  const newlyGeneratedAiCode = await callAI(fileContent, primaryError.cause + " - " + primaryError.fix);

  return {
    file: targetFile,
    replacement: newlyGeneratedAiCode,
    type: "replace"
  };
}

module.exports = { runPatchAgent };