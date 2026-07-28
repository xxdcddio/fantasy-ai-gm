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
  findEmptyOrWeakSlots,
  classifyWeakSlots
} = require("./lineupAnalyzer");

const teamPath = path.join(__dirname, "..", "data", "samples", "team.json");
const team = new Team(normalizeFantasyJson(JSON.parse(fs.readFileSync(teamPath, "utf8"))));

// Count hitters by eligible position (non-IL), as a depth chart of names
const depth = getPositionDepth(team);
assert.strictEqual(depth["C"].length, 1);
assert.strictEqual(depth["1B"].length, 2);
assert.strictEqual(depth["2B"].length, 3);
assert.strictEqual(depth["3B"].length, 3);
assert.strictEqual(depth["SS"].length, 2);
assert.strictEqual(depth["OF"].length, 4);

// Multi-position player (Curtis Mead: 1B,2B,3B) counts in every eligible slot
["1B", "2B", "3B"].forEach((pos) =>
  assert.ok(depth[pos].includes("Curtis Mead"), `Mead in ${pos}`)
);
assert.ok(!depth["C"].includes("Curtis Mead"));

// Bench drop candidates (slot BN)
const bench = getBenchCandidates(team);
assert.strictEqual(bench.length, 5);
assert.ok(bench.some((b) => b.name === "Curtis Mead"));
assert.ok(bench.some((b) => b.name === "Nolan McLean"));

// IL summary
const il = getILSummary(team);
assert.strictEqual(il.length, 3);
assert.ok(il.some((p) => p.name === "Corey Seager" && p.status === "IL10"));
assert.ok(il.some((p) => p.name === "Will Smith"));

// Empty / weak slots: thin defensive positions (<=1 eligible non-IL hitter)
const weak = findEmptyOrWeakSlots(team);
assert.deepStrictEqual([...weak].sort(), ["C"]);

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
assert.strictEqual(result.IL.length, 3);
assert.deepStrictEqual([...result.weakSlots].sort(), ["C"]);
assert.ok(Array.isArray(result.notes));
assert.ok(result.notes.some((n) => /\bC\b.*thin/.test(n)));

// P2 — Weak Position reclassification: C has exactly 1 eligible non-IL
// hitter (Gabriel Moreno) and is a scarce position -> "Permanent weakness",
// even though Will Smith (C, IL60) is also on this roster.
assert.deepStrictEqual(classifyWeakSlots(team), { C: "Permanent weakness" });

// Deterministic output: same team -> byte-identical JSON
assert.strictEqual(JSON.stringify(analyzeLineup(team)), JSON.stringify(analyzeLineup(team)));

console.log("lineupAnalyzer.test.js OK");
