const assert = require("assert");
const fs = require("fs");
const path = require("path");

const Team = require("./team");
const Player = require("./player");
const { normalizeFantasyJson } = require("../parser");

const teamPath = path.join(__dirname, "..", "..", "data", "samples", "team.json");
const normalized = normalizeFantasyJson(JSON.parse(fs.readFileSync(teamPath, "utf8")));
const team = new Team(normalized);

// Flattens all buckets into Player instances
assert.strictEqual(team.players.length, 26);
assert.ok(team.players.every((p) => p instanceof Player));

// Views by player type (across all slots)
assert.strictEqual(team.pitchers().length, 12); // 8 active + 4 on bench
assert.strictEqual(team.hitters().length, 14);
assert.ok(team.pitchers().every((p) => p.isPitcher()));
assert.ok(team.hitters().every((p) => p.isHitter()));

// Views by slot
assert.strictEqual(team.getBench().length, 5);
assert.strictEqual(team.getIL().length, 3);
assert.ok(team.getIL().every((p) => p.isIL()));

// Eligibility-based lookup (includes multi-position players)
const ss = team.getByPosition("SS").map((p) => p.name).sort();
assert.deepStrictEqual(ss, ["Corey Seager", "Geraldo Perdomo", "Nick Gonzales"]);

// findPlayer: case/whitespace-insensitive, null when absent
assert.strictEqual(team.findPlayer("Nick Gonzales").name, "Nick Gonzales");
assert.strictEqual(team.findPlayer("  nick gonzales  ").name, "Nick Gonzales");
assert.strictEqual(team.findPlayer("Nobody Here"), null);

// toJSON exposes the four views as plain arrays
const json = team.toJSON();
assert.deepStrictEqual(Object.keys(json), ["hitters", "pitchers", "bench", "IL"]);
assert.strictEqual(json.pitchers.length, 12);
assert.strictEqual(json.hitters[0].name, team.hitters()[0].name);

// Constructor also accepts a flat array of normalized players
const flat = new Team([...normalized.roster, ...normalized.pitchers]);
assert.strictEqual(flat.players.length, 18);

console.log("team.test.js OK");
