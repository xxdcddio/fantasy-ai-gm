const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { evaluatePlayer, categoryDelta } = require("./evaluator");
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

// P2 — Weak Position reclassification: the current fixture's only weak slot
// (C, 1 eligible non-IL hitter) is a scarce position -> "Permanent weakness",
// not the generic flat bonus.
assert.ok(ev("Ivan Herrera").reasons.some((r) => r.includes("Permanent weakness")));

// P2 — Replacement Cost: SS is deep on this roster (not a weak slot), but
// still a scarce position -- eligibility there alone is worth more than a
// non-scarce deep slot, even without filling a need.
assert.strictEqual(ev("Brayan Rocchio").positionScore, 8); // 2B/SS, SS scarce
assert.ok(ev("Brayan Rocchio").reasons.some((r) => /Scarce position \(SS\)/.test(r)));

// Deterministic
assert.strictEqual(JSON.stringify(ev("Christian Walker")), JSON.stringify(ev("Christian Walker")));

// Move Evaluator (PRD v2, P1) — Category Delta regression guard: adding a
// zero-SB power bat over a real SB source must show SB as a real loss, not a
// gain (the bug this feature exists to fix). Walker: HR20/RBI61/SB0/AVG.232;
// Arraez: HR4/RBI41/SB9/AVG.326.
const delta = categoryDelta(fa.find("Christian Walker").stats, fa.find("Luis Arraez").stats, strategy);
assert.strictEqual(delta.perCategory.HR.marker, "+");
assert.strictEqual(delta.perCategory.RBI.marker, "+");
assert.strictEqual(delta.perCategory.SB.marker, "-"); // giving up Arraez's 9 SB, not "improving" it
assert.strictEqual(delta.perCategory.SB.delta, -9);
assert.strictEqual(delta.perCategory.AVG.marker, "-");

// P3 — Breakout Bonus: rank far ahead of preseason expectation, on a real
// AB sample, adds +10 to categoryScore. Herrera #268 preseason -> #128 now
// (gap 140, AB 389); Arraez #328 -> #117 (gap 211, AB 399).
assert.strictEqual(ev("Ivan Herrera").categoryScore, 43); // 33 base + 10 breakout
assert.ok(ev("Ivan Herrera").reasons.includes("Breakout (#268 preseason -> #128)"));
assert.strictEqual(ev("Luis Arraez").categoryScore, 42); // 32 base + 10 breakout
assert.ok(ev("Luis Arraez").reasons.includes("Breakout (#328 preseason -> #117)"));

// P3 — Established Star Protection: no real fixture star is currently
// slumping, so this uses a synthetic player (same pattern as the PRD bug
// regression) -- a preseason top-50 pick with a cold stat line still floors
// to categoryScore 30 instead of reading as fully replaceable.
const slumpingStar = {
  name: "Slumping Star", eligiblePositions: ["OF"], status: "",
  preSeasonRank: 10, rank: 300, stats: { HR: 1, RBI: 5, OPS: 0.5 }
};
const starEval = evaluatePlayer(slumpingStar, { attack: ["HR", "RBI", "OPS"], protect: [], ignore: [] }, null);
assert.strictEqual(starEval.categoryScore, 30);
assert.ok(starEval.reasons.includes("Established star (floor applied)"));

console.log("evaluator.test.js OK");
