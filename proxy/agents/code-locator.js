const fs = require("fs");
const path = require("path");

const VALID_EXTENSIONS = [".js", ".ts", ".tsx"];

function extractKeywords(text) {
  return text
    .split(/[\s:'"()]+/)
    .filter(w => w.length > 3);
}

function searchCodebase(errorMessage, dir = "./") {
  const keywords = extractKeywords(errorMessage);
  let scoredMatches = [];

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);

    for (const file of files) {
      const fullPath = path.join(currentDir, file);

      try {
        if (fs.statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else if (VALID_EXTENSIONS.some(ext => file.endsWith(ext))) {
          const content = fs.readFileSync(fullPath, "utf8");

          const score = keywords.reduce((acc, k) => {
            return acc + (content.includes(k) ? 1 : 0);
          }, 0);

          if (score > 0) {
            scoredMatches.push({ file: fullPath, score });
          }
        }
      } catch (e) {}
    }
  }

  walk(dir);

  return scoredMatches
    .sort((a, b) => b.score - a.score)
    .map(m => m.file);
}

module.exports = { searchCodebase };