// Sprint 14.1 — Player Lookup CLI.
const assert = require("assert");
const { lookupPlayer, formatPlayer } = require("./player");

const player = { name: "Zztest Player", stats: { HR: 20 }, eligiblePositions: ["1B"], status: "" };
const freeAgents = { find: (n) => (n === "Zztest Player" ? player : null) };
const strategy = { attack: ["HR"] };

const result = lookupPlayer("Zztest Player", { freeAgents, strategy, team: null });
assert.ok(result, "player found");
assert.strictEqual(result.player.name, "Zztest Player");
const e = result.evaluation;
// score is the sum of its components (the Evaluator is the single scorer)
assert.strictEqual(
  e.score,
  e.categoryScore + e.positionScore + e.availabilityScore + e.flexibilityScore + e.statcastScore
);
assert.strictEqual(e.categoryScore, 60); // HR=20 hits full scale [0,20]
assert.ok(e.reasons.includes("Improves HR"));

// not found -> null, rendered as a clear message
assert.strictEqual(lookupPlayer("Nobody", { freeAgents, strategy, team: null }), null);
assert.ok(/not found/i.test(formatPlayer("Nobody", null)));

// render includes the breakdown labels
const text = formatPlayer("Zztest Player", result);
["Zztest Player", "GM Score", "Category", "Position", "Availability", "Flexibility", "Statcast", "Reasons"]
  .forEach((label) => assert.ok(text.includes(label), `missing ${label}`));

console.log("player.test.js OK");
