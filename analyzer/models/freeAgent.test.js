const assert = require("assert");
const fs = require("fs");
const path = require("path");

const Player = require("./player");
const { FreeAgent, FreeAgentList } = require("./freeAgent");
const { normalizeFreeAgents } = require("../parser");

const faPath = path.join(__dirname, "..", "..", "data", "samples", "free-agents.json");
const normalized = normalizeFreeAgents(JSON.parse(fs.readFileSync(faPath, "utf8")));
const list = new FreeAgentList(normalized);

// Parser drops header rows, keeps only real player rows
assert.strictEqual(normalized.length, 24);
assert.strictEqual(list.players.length, 24);
assert.ok(list.players.every((p) => p instanceof FreeAgent && p instanceof Player));

// Batter with full stat line
const ohearn = list.find("Ryan O'Hearn");
assert.ok(ohearn, "Ryan O'Hearn parsed");
assert.strictEqual(ohearn.mlbTeam, "PIT");
assert.deepStrictEqual(ohearn.eligiblePositions, ["1B", "OF"]);
assert.strictEqual(ohearn.rosterStatus, "FA");
assert.strictEqual(ohearn.rank, 105);
assert.strictEqual(ohearn.preSeasonRank, 298);
assert.strictEqual(ohearn.gamesPlayed, 69);
assert.strictEqual(ohearn.percentRostered, 59);
assert.strictEqual(ohearn.opponent, "@ PHI");
assert.strictEqual(ohearn.gameTime, "6:40 am");
assert.deepStrictEqual(ohearn.stats, {
  hAb: "74/259",
  R: 38,
  HR: 13,
  RBI: 50,
  SB: 1,
  BB: 21,
  AVG: 0.286,
  OPS: 0.821
});

// Multi-position eligibility
const arraez = list.find("Luis Arraez");
assert.deepStrictEqual(arraez.eligiblePositions, ["1B", "2B"]);
assert.strictEqual(arraez.rank, 134);

// Injury token glued into the name
const horwitz = list.find("Spencer Horwitz");
assert.strictEqual(horwitz.status, "IL10");
assert.deepStrictEqual(horwitz.eligiblePositions, ["1B"]);

// findByPosition uses eligibility (inherited canPlay)
const secondBase = list.findByPosition("2B").map((p) => p.name);
assert.ok(secondBase.includes("Luis Arraez"));
assert.ok(!secondBase.includes("Ryan O'Hearn"));

// bestAvailable: lowest Yahoo current rank first
const top3 = list.bestAvailable(3).map((p) => p.name);
assert.deepStrictEqual(top3, ["Ryan O'Hearn", "Spencer Horwitz", "Luis Arraez"]);

// find: case/whitespace-insensitive, null when absent
assert.strictEqual(list.find("  ryan o'hearn ").name, "Ryan O'Hearn");
assert.strictEqual(list.find("Nobody Here"), null);

console.log("freeAgent.test.js OK");
