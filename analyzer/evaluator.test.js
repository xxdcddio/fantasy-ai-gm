const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { evaluatePlayer } = require("./evaluator");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "samples", f), "utf8"));

const team = new Team(normalizeFantasyJson(read("team.json"))); // weak slots: C, 3B
const fa = new FreeAgentList(normalizeFreeAgents(read("free-agents.json")));
const strategy = { attack: ["HR", "RBI", "OPS"], protect: ["ERA"], ignore: ["SB"] };

const ev = (name) => evaluatePlayer(fa.find(name), strategy, team);

// Component shape (includes Statcast)
const mead = ev("Curtis Mead");
assert.deepStrictEqual(Object.keys(mead), [
  "score", "categoryScore", "positionScore", "availabilityScore",
  "flexibilityScore", "statcastScore", "reasons", "risks"
]);
assert.strictEqual(
  mead.score,
  mead.categoryScore + mead.positionScore + mead.availabilityScore +
    mead.flexibilityScore + mead.statcastScore
);

// Statcast: Curtis Mead has a fixture (4 metrics x 3 stars = 12); a player
// without a fixture scores 0.
assert.strictEqual(mead.statcastScore, 12);
assert.strictEqual(ev("Isaac Paredes").statcastScore, 0); // no fixture

// Category: Mead (HR 14 / RBI 39) beats an AVG-first hitter (Arraez HR 3) on attack cats
const arraez = ev("Luis Arraez");
assert.ok(mead.categoryScore > arraez.categoryScore, "Mead category > Arraez");
assert.ok(mead.reasons.includes("Improves HR"));
assert.ok(mead.reasons.includes("Improves RBI"));
assert.ok(mead.risks.includes("Lower AVG")); // .222 is weak

// Availability: healthy > DTD > IL
assert.strictEqual(ev("Curtis Mead").availabilityScore, 10); // healthy
assert.strictEqual(ev("Dominic Canzone").availabilityScore, 3); // DTD
assert.strictEqual(ev("Spencer Horwitz").availabilityScore, 0); // IL10
assert.ok(ev("Spencer Horwitz").risks.some((r) => /IL/.test(r)));

// Flexibility: multi-position > single-position
assert.strictEqual(ev("Paul Goldschmidt").flexibilityScore, 0); // 1B only
assert.strictEqual(ev("Luis Arraez").flexibilityScore, 4); // 1B/2B
assert.strictEqual(ev("Brooks Lee").flexibilityScore, 10); // 2B/3B/SS

// Position: fills a weak slot (3B) > a deep slot
assert.strictEqual(ev("Isaac Paredes").positionScore, 20); // 1B/3B, 3B is weak
assert.strictEqual(ev("Paul Goldschmidt").positionScore, 3); // 1B only, not weak
assert.ok(ev("Isaac Paredes").reasons.some((r) => /weak 3B/.test(r)));

// Deterministic
assert.strictEqual(JSON.stringify(ev("Curtis Mead")), JSON.stringify(ev("Curtis Mead")));

console.log("evaluator.test.js OK");
