const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { recommendMoves } = require("./gmDecisionEngine");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");

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

// Explanation reflects the add's scoring (category reasons carry through)
const top = moves[0];
assert.ok(top.explanation.some((e) => /Improves|Fills|Multi-position|Healthy/.test(e)));
assert.ok(top.explanation.some((e) => /Higher Evaluator score/.test(e)));

// categoryImpact uses +/-/= markers
assert.ok(Object.values(top.categoryImpact).every((v) => ["+", "-", "="].includes(v)));

// Deterministic
assert.strictEqual(JSON.stringify(recommendMoves({ team, freeAgents: fa, strategy })), JSON.stringify(out));

console.log("gmDecisionEngine.test.js OK");
