// Sprint 13.8 — Import CLI. Moves the three Chrome-extension downloads from
// ~/Downloads into data/, so the daily flow is `npm run import && npm run analyze`.
//
//   npm run import  ->  node scripts/import.js

const fs = require("fs");
const os = require("os");
const path = require("path");

const FILES = ["team.json", "matchup.json", "free-agents.json"];

// rename is atomic on the same volume; fall back to copy+unlink across volumes.
const move = (src, dest) => {
  try {
    fs.renameSync(src, dest);
  } catch (e) {
    if (e.code !== "EXDEV") throw e;
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
};

const importFiles = ({ from, to } = {}) => {
  fs.mkdirSync(to, { recursive: true });
  return FILES.map((name) => {
    const src = path.join(from, name);
    if (!fs.existsSync(src)) return { name, ok: false };
    move(src, path.join(to, name));
    return { name, ok: true };
  });
};

const formatImport = (results) =>
  ["Import complete", "", ...results.map(
    (r) => (r.ok ? `✓ ${r.name}` : `✗ ${r.name} (not found)`)
  )].join("\n");

if (require.main === module) {
  const from = path.join(os.homedir(), "Downloads");
  const to = path.join(__dirname, "..", "data");
  console.log(formatImport(importFiles({ from, to })));
}

module.exports = { importFiles, formatImport, FILES };
