const fs = require("fs");

function applyPatch(patch) {
  if (!patch?.file) return;

  const content = fs.readFileSync(patch.file, "utf8");

  let newContent = content;

  if (patch.type === "replace") {
    newContent = patch.replacement;
  }

  fs.writeFileSync(patch.file, newContent, "utf8");

  console.log("🩹 Patch applied to:", patch.file);
}

module.exports = { applyPatch };