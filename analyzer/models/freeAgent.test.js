const assert = require("assert");
const fs = require("fs");
const path = require("path");

const Player = require("./player");
const { FreeAgent, FreeAgentList } = require("./freeAgent");
const { normalizeFreeAgents } = require("../parser");

const faPath = path.join(__dirname, "..", "..", "data", "samples", "player.json");
const normalized = normalizeFreeAgents(JSON.parse(fs.readFileSync(faPath, "utf8")));
const list = new FreeAgentList(normalized);

// Parser drops header rows, keeps only real player rows
assert.strictEqual(normalized.length, 25);
assert.strictEqual(list.players.length, 25);
assert.ok(list.players.every((p) => p instanceof FreeAgent && p instanceof Player));

// Batter with full stat line
const walker = list.find("Christian Walker");
assert.ok(walker, "Christian Walker parsed");
assert.strictEqual(walker.mlbTeam, "HOU");
assert.deepStrictEqual(walker.eligiblePositions, ["1B"]);
assert.strictEqual(walker.rosterStatus, "FA");
assert.strictEqual(walker.rank, 98);
assert.strictEqual(walker.preSeasonRank, 113);
assert.strictEqual(walker.gamesPlayed, 84);
assert.strictEqual(walker.percentRostered, 89);
assert.strictEqual(walker.opponent, "vs MIN");
assert.strictEqual(walker.gameTime, "8:10 am");
assert.deepStrictEqual(walker.stats, {
  hAb: "76/317",
  R: 45,
  HR: 19,
  RBI: 56,
  SB: 0,
  BB: 29,
  AVG: 0.24,
  OPS: 0.787
});

// Multi-position eligibility
const garcia = list.find("Luis García Jr.");
assert.deepStrictEqual(garcia.eligiblePositions, ["1B", "2B"]);
assert.strictEqual(garcia.rank, 99);

// Injury token glued into the name
const horwitz = list.find("Spencer Horwitz");
assert.strictEqual(horwitz.status, "IL10");
assert.deepStrictEqual(horwitz.eligiblePositions, ["1B"]);

// findByPosition uses eligibility (inherited canPlay)
const secondBase = list.findByPosition("2B").map((p) => p.name);
assert.ok(secondBase.includes("Luis García Jr."));
assert.ok(!secondBase.includes("Christian Walker"));

// bestAvailable: lowest Yahoo current rank first
const top3 = list.bestAvailable(3).map((p) => p.name);
assert.deepStrictEqual(top3, ["Christian Walker", "Luis García Jr.", "Ryan O'Hearn"]);

// find: case/whitespace-insensitive, null when absent
assert.strictEqual(list.find("  christian walker ").name, "Christian Walker");
assert.strictEqual(list.find("Nobody Here"), null);

console.log("freeAgent.test.js OK");
