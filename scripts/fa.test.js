// Sprint 14.3 — Free Agent Ranking CLI.
const assert = require("assert");
const { rankFreeAgents, formatFa } = require("./fa");
const Team = require("../analyzer/models/team");

const players = [
  { name: "Power 3B", stats: { HR: 20 }, eligiblePositions: ["3B"], status: "", canPlay(p) { return this.eligiblePositions.includes(p); } },
  { name: "Weak 1B", stats: { HR: 0 }, eligiblePositions: ["1B"], status: "", canPlay(p) { return this.eligiblePositions.includes(p); } },
  { name: "Mid 3B", stats: { HR: 10 }, eligiblePositions: ["3B"], status: "", canPlay(p) { return this.eligiblePositions.includes(p); } }
];
const freeAgents = {
  players,
  findByPosition: (pos) => players.filter((p) => p.canPlay(pos))
};
const ctx = { freeAgents, strategy: { attack: ["HR"] }, team: null };

// ranked by GM score desc
const ranked = rankFreeAgents(ctx, {});
assert.strictEqual(ranked[0].name, "Power 3B");
assert.ok(ranked[0].score >= ranked[1].score && ranked[1].score >= ranked[2].score);

// P6: every ranked entry carries a score-only waiverBand
ranked.forEach((r) => assert.deepStrictEqual(Object.keys(r.waiverBand).sort(), ["emoji", "key", "label"]));

// --top limits
assert.strictEqual(rankFreeAgents(ctx, { top: 2 }).length, 2);

// --position filters
const only3b = rankFreeAgents(ctx, { position: "3B" });
assert.deepStrictEqual(only3b.map((r) => r.name), ["Power 3B", "Mid 3B"]);

// render: numbered with scores
const text = formatFa(ranked);
assert.ok(/1\. .* Power 3B/.test(text));
assert.ok(/—\s*\d+/.test(text), "shows a score");
assert.ok(text.includes(ranked[0].waiverBand.emoji), "shows the waiver band");

// Sprint 15.2 — owned players are excluded from the FA ranking.
const teamOwns = new Team([{ name: "Power 3B", eligiblePositions: ["3B"] }]);
const rankedOwned = rankFreeAgents({ freeAgents, strategy: { attack: ["HR"] }, team: teamOwns }, {});
assert.ok(!rankedOwned.some((r) => r.name === "Power 3B"), "owned player excluded");
assert.strictEqual(rankedOwned.length, players.length - 1);

console.log("fa.test.js OK");
