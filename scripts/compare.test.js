// Sprint 14.2 — Compare CLI.
const assert = require("assert");
const { comparePlayers, formatCompare } = require("./compare");

const a = { name: "Strong Bat", stats: { HR: 20 }, eligiblePositions: ["1B"], status: "" };
const b = { name: "Weak Bat", stats: { HR: 0 }, eligiblePositions: ["1B"], status: "" };
const freeAgents = { find: (n) => ({ "Strong Bat": a, "Weak Bat": b }[n] || null) };
const strategy = { attack: ["HR"] };
const ctx = { freeAgents, strategy, team: null };

const res = comparePlayers("Strong Bat", "Weak Bat", ctx);
assert.strictEqual(res.winner, "Strong Bat", "higher GM score wins");
assert.ok(res.reasons.some((r) => /Category/i.test(r)), "cites the winning component");

const text = formatCompare(res);
["Strong Bat", "Weak Bat", "Winner", "Because"].forEach((l) =>
  assert.ok(text.includes(l), `missing ${l}`)
);

// missing player -> clear error, no winner
const miss = comparePlayers("Strong Bat", "Ghost", ctx);
assert.strictEqual(miss.winner, null);
assert.ok(/not found/i.test(formatCompare(miss)));

console.log("compare.test.js OK");
