const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { evaluatePlayer } = require("./evaluator");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "samples", f), "utf8"));

const team = new Team(normalizeFantasyJson(read("team.json"))); // weak slot: C
const fa = new FreeAgentList(normalizeFreeAgents(read("free-agents.json")));
const strategy = { attack: ["HR", "RBI", "OPS"], protect: ["ERA"], ignore: ["SB"] };

const ev = (name) => evaluatePlayer(fa.find(name), strategy, team);

// Component shape (includes Stability Score sub-scores)
const walker = ev("Christian Walker");
assert.deepStrictEqual(Object.keys(walker), [
  "score", "categoryScore", "positionScore", "availabilityScore",
  "flexibilityScore", "statcastScore", "qualityScore", "skillScore",
  "disciplineScore", "reasons", "risks"
]);
assert.strictEqual(
  walker.score,
  walker.categoryScore + walker.positionScore + walker.availabilityScore +
    walker.flexibilityScore + walker.statcastScore
);

// Stability Score: Christian Walker has a fixture (data/statcast/christian-walker.json).
// Note statcastScore is round(quality+skill+discipline) as unrounded floats,
// NOT the sum of the already-rounded sub-scores -- each is rounded independently
// for display.
assert.strictEqual(walker.statcastScore, 13);
assert.strictEqual(walker.qualityScore, 5);
assert.strictEqual(walker.skillScore, 6);
assert.strictEqual(walker.disciplineScore, 2);
// Christian Walker is AVG .232 / OPS .755 (Cold) with a Strong process ->
// "Cold but unlucky" + positive-regression flag.
assert.ok(walker.reasons.includes("Cold but unlucky"));
assert.ok(walker.reasons.includes("Likely positive regression"));

const paredes = ev("Isaac Paredes");
assert.strictEqual(paredes.statcastScore, 0); // no fixture
assert.strictEqual(paredes.qualityScore, 0);
assert.strictEqual(paredes.skillScore, 0);
assert.strictEqual(paredes.disciplineScore, 0);

// Category: Walker (HR 20 / RBI 61) beats an AVG-first hitter (Arraez HR 4) on attack cats
const arraez = ev("Luis Arraez");
assert.ok(walker.categoryScore > arraez.categoryScore, "Walker category > Arraez");
assert.ok(walker.reasons.includes("Improves HR"));
assert.ok(walker.reasons.includes("Improves RBI"));
assert.ok(walker.risks.includes("Lower AVG")); // .232 is weak

// Availability: healthy > DTD > IL
assert.strictEqual(ev("Christian Walker").availabilityScore, 10); // healthy
assert.strictEqual(ev("Casey Schmitt").availabilityScore, 3); // DTD
assert.strictEqual(ev("Cody Bellinger").availabilityScore, 0); // IL10
assert.ok(ev("Cody Bellinger").risks.some((r) => /IL/.test(r)));

// Flexibility: multi-position > single-position
assert.strictEqual(ev("Christian Walker").flexibilityScore, 0); // 1B only
assert.strictEqual(ev("Ryan O'Hearn").flexibilityScore, 4); // 1B/OF
assert.strictEqual(ev("Casey Schmitt").flexibilityScore, 10); // 1B/2B/3B/OF

// Position: fills a weak slot (C) > a deep slot
assert.strictEqual(ev("Ivan Herrera").positionScore, 20); // C, C is weak
assert.strictEqual(ev("Christian Walker").positionScore, 3); // 1B only, not weak
assert.ok(ev("Ivan Herrera").reasons.some((r) => /weak C/.test(r)));

// Deterministic
assert.strictEqual(JSON.stringify(ev("Christian Walker")), JSON.stringify(ev("Christian Walker")));

console.log("evaluator.test.js OK");
