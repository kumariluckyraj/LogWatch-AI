const fs = require("fs");

function isValidPatch(content) {
  if (!content || typeof content !== "string") return false;
  if (content.includes("TODO")) return false;
  if (content.trim().length < 10) return false;
  return true;
}

function backupFile(file) {
  const backupPath = `${file}.bak-${Date.now()}`;
  fs.copyFileSync(file, backupPath);
  return backupPath;
}

function applyPatch(patch) {
  if (!patch?.file) return;

  const content = fs.readFileSync(patch.file, "utf8");

  let newContent = content;

  if (patch.type === "replace") {
    if (!isValidPatch(patch.replacement)) {
      throw new Error("Invalid AI patch - aborting write");
    }

    backupFile(patch.file);
    newContent = patch.replacement;
  }

  fs.writeFileSync(patch.file, newContent, "utf8");

  console.log("🩹 Patch applied to:", patch.file);
}

module.exports = { applyPatch };