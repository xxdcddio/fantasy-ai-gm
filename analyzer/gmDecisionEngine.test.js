const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { recommendMoves } = require("./gmDecisionEngine");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");
const { bandFor } = require("./waiverBands");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "samples", f), "utf8"));

const team = new Team(normalizeFantasyJson(read("team.json")));
const fa = new FreeAgentList(normalizeFreeAgents(read("free-agents.json")));
const strategy = { attack: ["HR", "RBI", "OPS"], protect: ["ERA"], ignore: ["SB"] };

const PROTECTED = [
  "Freddie Freeman", "Ketel Marte", "Corey Seager", "Yordan Alvarez",
  "José Ramírez", "Tarik Skubal", "Joe Ryan"
];
const ilNames = team.getIL().map((p) => p.name);

const out = recommendMoves({ team, freeAgents: fa, strategy });
const moves = out.moves;

// Valid add/drop moves
assert.ok(Array.isArray(moves) && moves.length > 0);
moves.forEach((m) => {
  assert.strictEqual(m.type, "add_drop");
  assert.ok(m.add && m.add.name);
  assert.ok(m.drop && m.drop.name);
  assert.strictEqual(typeof m.confidence, "number");
  assert.strictEqual(typeof m.scoreGain, "number");
  assert.ok(m.categoryImpact && typeof m.categoryImpact === "object");
  assert.ok(Array.isArray(m.explanation) && m.explanation.length > 0);
  assert.ok(Array.isArray(m.risks));
});

// Never drop an IL player or a protected core player
moves.forEach((m) => {
  assert.ok(!ilNames.includes(m.drop.name), `must not drop IL ${m.drop.name}`);
  assert.ok(!PROTECTED.includes(m.drop.name), `must not drop protected ${m.drop.name}`);
});

// Highest Net Gain first
for (let i = 1; i < moves.length; i += 1) {
  assert.ok(moves[i - 1].scoreGain >= moves[i].scoreGain, "descending scoreGain");
}
assert.strictEqual(moves[0].scoreGain, Math.max(...moves.map((m) => m.scoreGain)));

// Confidence follows the Net Gain ladder and never increases as gain drops
const conf = (g) => (g >= 20 ? 0.9 : g >= 10 ? 0.75 : g >= 5 ? 0.6 : 0.4);
moves.forEach((m) => assert.strictEqual(m.confidence, conf(m.scoreGain)));
for (let i = 1; i < moves.length; i += 1) {
  assert.ok(moves[i - 1].confidence >= moves[i].confidence);
}

// P1 — Recommendation Threshold: <15 No Move, 15-30 Watch, 30+ Add Now
const recBand = (g) => (g >= 30 ? "Add Now" : g >= 15 ? "Watch" : "No Move");
moves.forEach((m) => assert.strictEqual(m.recommendation, recBand(m.scoreGain)));

// Explanation reflects the add's scoring (category reasons carry through)
const top = moves[0];
assert.ok(top.explanation.some((e) => /Improves|Fills|Multi-position|Healthy/.test(e)));
assert.ok(top.explanation.some((e) => /Higher Evaluator score/.test(e)));

// categoryImpact uses +/-/= markers
assert.ok(Object.values(top.categoryImpact).every((v) => ["+", "-", "="].includes(v)));

// P10: component breakdown + human-readable confidence summary on every move
const COMPONENT_LABELS = ["Category Fit", "Position Fit", "Availability", "Flexibility", "Stability"];
moves.forEach((m) => {
  assert.ok(Array.isArray(m.components) && m.components.length === 5);
  assert.deepStrictEqual(m.components.map((c) => c.label), COMPONENT_LABELS);
  m.components.forEach((c) => {
    assert.strictEqual(typeof c.score, "number");
    assert.strictEqual(typeof c.max, "number");
  });
  assert.strictEqual(typeof m.confidenceSummary, "string");
  assert.ok(m.confidenceSummary.includes(`${Math.round(m.confidence * 100)}% confidence`));
  assert.ok(m.confidenceSummary.includes(`+${m.scoreGain} score gain over ${m.drop.name}`));
});

// P6: waiverBand matches bandFor({score: add's own score, confidence}) — the
// add's score is the sum of its own component breakdown (categoryScore +
// positionScore + availabilityScore + flexibilityScore + statcastScore).
moves.forEach((m) => {
  const addScore = m.components.reduce((sum, c) => sum + c.score, 0);
  assert.deepStrictEqual(m.waiverBand, bandFor({ score: addScore, confidence: m.confidence }));
  assert.deepStrictEqual(Object.keys(m.waiverBand).sort(), ["emoji", "key", "label"]);
});

// Deterministic
assert.strictEqual(JSON.stringify(recommendMoves({ team, freeAgents: fa, strategy })), JSON.stringify(out));

// Sprint 15.2 — never recommend ADDing a player already on the roster.
const teamWithMead = new Team([
  ...normalizeFantasyJson(read("team.json")).roster,
  ...normalizeFantasyJson(read("team.json")).bench,
  ...normalizeFantasyJson(read("team.json")).IL,
  ...normalizeFantasyJson(read("team.json")).pitchers,
  { name: "Curtis Mead", eligiblePositions: ["1B", "2B", "3B"] }
]);
const ownedMoves = recommendMoves({ team: teamWithMead, freeAgents: fa, strategy }).moves;
assert.ok(!ownedMoves.some((m) => m.add.name === "Curtis Mead"), "owned player not added");

// PRD v2 regression: adding a zero-SB power bat over a real SB source must
// show SB as worsened, never "Improves SB" (the reported bug -- categoryImpact
// used to reflect the add's own absolute strength, ignoring what it replaced).
const syntheticTeam = new Team([
  { name: "Weak Bat", eligiblePositions: ["OF"], slot: "BN", status: "",
    stats: { R: 40, HR: 2, RBI: 20, SB: 9, BB: 15, AVG: 0.3, OPS: 0.76 } }
]);
const syntheticFA = new FreeAgentList([
  { name: "Power Bat", eligiblePositions: ["OF"], rosterStatus: "FA",
    stats: { R: 50, HR: 25, RBI: 70, SB: 0, BB: 30, AVG: 0.24, OPS: 0.78 } }
]);
const synthMove = recommendMoves({
  team: syntheticTeam,
  freeAgents: syntheticFA,
  strategy: { attack: ["HR", "RBI"], protect: [], ignore: ["SB"] }
}).moves[0];
assert.strictEqual(synthMove.add.name, "Power Bat");
assert.strictEqual(synthMove.drop.name, "Weak Bat");
assert.strictEqual(synthMove.categoryImpact.HR, "+");
assert.strictEqual(synthMove.categoryImpact.SB, "-");
assert.ok(!synthMove.explanation.includes("Improves SB"));
assert.ok(synthMove.risks.includes("Worsens SB"));

// P2 — Explain Score: categoryBreakdown carries the real numbers behind
// each marker, not just +/-/=.
const sbRow = synthMove.categoryBreakdown.find((r) => r.cat === "SB");
assert.deepStrictEqual(sbRow, { cat: "SB", add: 0, drop: 9, delta: -9, marker: "-" });
moves.forEach((m) => {
  assert.ok(Array.isArray(m.categoryBreakdown));
  m.categoryBreakdown.forEach((row) => {
    assert.deepStrictEqual(Object.keys(row), ["cat", "add", "drop", "delta", "marker"]);
  });
});

console.log("gmDecisionEngine.test.js OK");
