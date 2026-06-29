const assert = require("assert");
const { getPlayerStatcast } = require("./statcast");

// Reads a fixture by player name
const walker = getPlayerStatcast("Christian Walker");
assert.ok(walker, "Walker statcast found");
assert.strictEqual(walker.xwOBA, 0.361);
assert.strictEqual(walker.barrelRate, 14.8);
assert.strictEqual(walker.hardHitRate, 49.7);

// Name with accent + punctuation resolves to its slug fixture
assert.ok(getPlayerStatcast("Luis García Jr."), "accented name resolves");

// Unknown player -> null (never throws, never fabricates)
assert.strictEqual(getPlayerStatcast("Nobody Here"), null);
assert.strictEqual(getPlayerStatcast(""), null);

console.log("statcast.test.js OK");
