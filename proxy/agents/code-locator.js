const fs = require("fs");
const path = require("path");

function searchCodebase(keyword, dir = "./") {
  let matches = [];

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);

    for (const file of files) {
      const fullPath = path.join(currentDir, file);

      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith(".js")) {
        const content = fs.readFileSync(fullPath, "utf8");

        if (content.includes(keyword)) {
          matches.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return matches;
}

module.exports = { searchCodebase };