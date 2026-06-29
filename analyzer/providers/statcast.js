// The single source of Statcast / Baseball Savant data. Today it reads local
// fixtures; swapping in a live source later changes only this file — nothing
// upstream (Evaluator) knows where the numbers come from.

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "data", "statcast");

// "Luis García Jr." -> "luis-garcia-jr"
const slug = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getPlayerStatcast = (playerName) => {
  const id = slug(playerName);
  if (!id) return null;
  const file = path.join(DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

module.exports = { getPlayerStatcast };
