const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { recommend } = require("./streamingEngine");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "samples", f), "utf8"));

const team = new Team(normalizeFantasyJson(read("team.json")));
const fa = new FreeAgentList(normalizeFreeAgents(read("player.json")));
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

// Statcast flows through the same evaluator without any Streaming change
assert.strictEqual(recs.find((r) => r.player === "Christian Walker").statcastScore, 16);

// Sorted by Streaming Score, highest first
for (let i = 1; i < recs.length; i += 1) {
  assert.ok(recs[i - 1].score >= recs[i].score, "descending score");
}
assert.strictEqual(recs[0].score, Math.max(...recs.map((r) => r.score)));

// Walker (HR/RBI) ranks above the AVG-first bat Arraez
assert.ok(rank("Christian Walker") < rank("Luis Arraez"));

// Score is the internal Streaming Score, not Yahoo rank: the top pick is not
// simply the best Yahoo current rank.
const walkerRank = fa.find("Christian Walker").rank; // Yahoo #98 (best rank in pool)
assert.notStrictEqual(recs[0].player, "Christian Walker"); // a weak-3B multi-position bat outranks him here
assert.ok(typeof walkerRank === "number");

// Deterministic
assert.strictEqual(JSON.stringify(recommend(fa, strategy, team)), JSON.stringify(out));

console.log("streamingEngine.test.js OK");
