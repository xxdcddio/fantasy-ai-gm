const assert = require("assert");
const fs = require("fs");
const path = require("path");

const Team = require("./models/team");
const { normalizeFantasyJson } = require("./parser");
const {
  analyzeLineup,
  getPositionDepth,
  getBenchCandidates,
  getILSummary,
  findEmptyOrWeakSlots
} = require("./lineupAnalyzer");

const teamPath = path.join(__dirname, "..", "data", "samples", "team.json");
const team = new Team(normalizeFantasyJson(JSON.parse(fs.readFileSync(teamPath, "utf8"))));

// Count hitters by eligible position (non-IL), as a depth chart of names
const depth = getPositionDepth(team);
assert.strictEqual(depth["C"].length, 1);
assert.strictEqual(depth["1B"].length, 4);
assert.strictEqual(depth["2B"].length, 2);
assert.strictEqual(depth["3B"].length, 1);
assert.strictEqual(depth["SS"].length, 3);
assert.strictEqual(depth["OF"].length, 6);

// Multi-position player (Willi Castro: 1B,2B,3B,SS,OF) counts in every eligible slot
["1B", "2B", "3B", "SS", "OF"].forEach((pos) =>
  assert.ok(depth[pos].includes("Willi Castro"), `Castro in ${pos}`)
);
assert.ok(!depth["C"].includes("Willi Castro"));

// Bench drop candidates (slot BN)
const bench = getBenchCandidates(team);
assert.strictEqual(bench.length, 5);
assert.ok(bench.some((b) => b.name === "Jac Caglianone"));
assert.ok(bench.some((b) => b.name === "Carlos Rodón"));

// IL summary
const il = getILSummary(team);
assert.strictEqual(il.length, 4);
assert.ok(il.some((p) => p.name === "José Ramírez" && p.status === "IL10"));
assert.ok(il.some((p) => p.name === "Will Smith"));

// Empty / weak slots: thin defensive positions (<=1 eligible non-IL hitter)
const weak = findEmptyOrWeakSlots(team);
assert.deepStrictEqual([...weak].sort(), ["3B", "C"]);

// analyzeLineup aggregates everything in a stable shape
const result = analyzeLineup(team);
assert.deepStrictEqual(Object.keys(result), [
  "positionDepth",
  "bench",
  "IL",
  "weakSlots",
  "notes"
]);
assert.strictEqual(result.bench.length, 5);
assert.strictEqual(result.IL.length, 4);
assert.deepStrictEqual([...result.weakSlots].sort(), ["3B", "C"]);
assert.ok(Array.isArray(result.notes));
assert.ok(result.notes.some((n) => /\bC\b.*thin/.test(n)));

// Deterministic output: same team -> byte-identical JSON
assert.strictEqual(JSON.stringify(analyzeLineup(team)), JSON.stringify(analyzeLineup(team)));

console.log("lineupAnalyzer.test.js OK");
