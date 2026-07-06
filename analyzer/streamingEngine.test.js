const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { recommend } = require("./streamingEngine");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "samples", f), "utf8"));

const team = new Team(normalizeFantasyJson(read("team.json")));
const fa = new FreeAgentList(normalizeFreeAgents(read("free-agents.json")));
const strategy = { attack: ["HR", "RBI", "OPS"], protect: ["ERA"], ignore: ["SB"] };

const out = recommend(fa, strategy, team);
const recs = out.recommendations;
const rank = (name) => recs.findIndex((r) => r.player === name);

// One "add" recommendation per FA, with the full score breakdown
assert.strictEqual(recs.length, fa.players.length);
assert.ok(recs.every((r) => r.action === "add"));
assert.ok(
  recs.every((r) =>
    ["player", "action", "score", "categoryScore", "positionScore", "availabilityScore",
      "flexibilityScore", "statcastScore", "reasons", "risks"].every((k) => k in r)
  )
);

// Stability Score flows through the same evaluator without any Streaming change
assert.strictEqual(recs.find((r) => r.player === "Curtis Mead").statcastScore, 10);

// Sorted by Streaming Score, highest first
for (let i = 1; i < recs.length; i += 1) {
  assert.ok(recs[i - 1].score >= recs[i].score, "descending score");
}
assert.strictEqual(recs[0].score, Math.max(...recs.map((r) => r.score)));

// Mead (HR/RBI, fills weak 3B) ranks above the AVG-first bat Arraez
assert.ok(rank("Curtis Mead") < rank("Luis Arraez"));

// Score is the internal Streaming Score, not Yahoo rank: the top pick is not
// simply the best Yahoo current rank.
const ohearnRank = fa.find("Ryan O'Hearn").rank; // Yahoo #105 (best rank in pool)
assert.notStrictEqual(recs[0].player, "Ryan O'Hearn"); // a weak-3B multi-position bat outranks him here
assert.ok(typeof ohearnRank === "number");

// Deterministic
assert.strictEqual(JSON.stringify(recommend(fa, strategy, team)), JSON.stringify(out));

// Sprint 15.2 — a player already on the roster is never recommended (team and
// FA pages can be extracted at different times, so a just-added player can
// appear in both snapshots).
const base = normalizeFantasyJson(read("team.json"));
const teamWithMead = new Team([
  ...base.roster, ...base.bench, ...base.IL, ...base.pitchers,
  { name: "Curtis Mead", eligiblePositions: ["1B", "2B", "3B"] }
]);
const recsOwned = recommend(fa, strategy, teamWithMead).recommendations;
assert.ok(!recsOwned.some((r) => r.player === "Curtis Mead"), "owned player excluded");
assert.strictEqual(recsOwned.length, fa.players.length - 1);

console.log("streamingEngine.test.js OK");
