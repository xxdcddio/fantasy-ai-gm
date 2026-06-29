const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { evaluatePlayer } = require("./evaluator");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "samples", f), "utf8"));

const team = new Team(normalizeFantasyJson(read("team.json"))); // weak slots: C, 3B
const fa = new FreeAgentList(normalizeFreeAgents(read("player.json")));
const strategy = { attack: ["HR", "RBI", "OPS"], protect: ["ERA"], ignore: ["SB"] };

const ev = (name) => evaluatePlayer(fa.find(name), strategy, team);

// Component shape
const walker = ev("Christian Walker");
assert.deepStrictEqual(Object.keys(walker), [
  "score", "categoryScore", "positionScore", "availabilityScore",
  "flexibilityScore", "reasons", "risks"
]);
assert.strictEqual(
  walker.score,
  walker.categoryScore + walker.positionScore + walker.availabilityScore + walker.flexibilityScore
);

// Category: Walker (HR 19 / RBI 56) beats an AVG-first hitter (Arraez HR 3) on attack cats
const arraez = ev("Luis Arraez");
assert.ok(walker.categoryScore > arraez.categoryScore, "Walker category > Arraez");
assert.ok(walker.reasons.includes("Improves HR"));
assert.ok(walker.reasons.includes("Improves RBI"));
assert.ok(walker.risks.includes("Lower AVG")); // .240 is weak

// Availability: healthy > DTD > IL
assert.strictEqual(ev("Christian Walker").availabilityScore, 10); // healthy
assert.strictEqual(ev("Dominic Canzone").availabilityScore, 3); // DTD
assert.strictEqual(ev("Spencer Horwitz").availabilityScore, 0); // IL10
assert.ok(ev("Spencer Horwitz").risks.some((r) => /IL/.test(r)));

// Flexibility: multi-position > single-position
assert.strictEqual(ev("Christian Walker").flexibilityScore, 0); // 1B only
assert.strictEqual(ev("Luis García Jr.").flexibilityScore, 4); // 1B/2B
assert.ok(ev("Brooks Lee").flexibilityScore === 10); // 2B/3B/SS

// Position: fills a weak slot (3B) > a deep slot
assert.strictEqual(ev("Isaac Paredes").positionScore, 20); // 1B/3B, 3B is weak
assert.strictEqual(ev("Christian Walker").positionScore, 3); // 1B only, not weak
assert.ok(ev("Isaac Paredes").reasons.some((r) => /weak 3B/.test(r)));

// Deterministic
assert.strictEqual(JSON.stringify(ev("Christian Walker")), JSON.stringify(ev("Christian Walker")));

console.log("evaluator.test.js OK");
