const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { generateWeeklyReport, renderWeeklyReport } = require("./weeklyReport");
const Team = require("./models/team");
const { FreeAgentList } = require("./models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("./parser");
const { parseMatchup } = require("./matchupParser");
const { recommendMoves } = require("./gmDecisionEngine");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "samples", f), "utf8"));

const team = new Team(normalizeFantasyJson(read("team.json")));
const fa = new FreeAgentList(normalizeFreeAgents(read("free-agents.json")));
const matchup = parseMatchup(read("matchup.json"));
const strategy = { attack: ["HR", "RBI", "OPS"], protect: ["ERA", "WHIP"], ignore: ["SB"] };
const { moves } = recommendMoves({ team, freeAgents: fa, strategy });

const report = generateWeeklyReport({ team, matchup, strategy, recommendations: moves });

// Every top-level field is present
["summary", "strengths", "weaknesses", "categoryOutlook", "rosterAnalysis", "recommendations", "notes"]
  .forEach((k) => assert.ok(k in report, `missing ${k}`));

// Summary
assert.strictEqual(report.summary.week, "Week 18");
assert.strictEqual(report.summary.opponent, "我們是富邦悍將你又是誰");
assert.strictEqual(report.summary.currentScore, "1-10");
assert.deepStrictEqual(report.summary.remainingGames, { mine: 103, opponent: 85 });

// Strengths / weaknesses from roster shape (weak slot: C only; OF/SP are deep)
assert.ok(report.weaknesses.includes("Thin at C"));
assert.ok(report.strengths.includes("Deep OF"));
assert.ok(report.strengths.includes("Deep SP"));

// Category outlook mirrors the strategy
assert.deepStrictEqual(report.categoryOutlook, {
  attack: ["HR", "RBI", "OPS"],
  protect: ["ERA", "WHIP"],
  ignore: ["SB"]
});

// Roster analysis
assert.deepStrictEqual([...report.rosterAnalysis.weakPositions].sort(), ["C"]);
assert.strictEqual(report.rosterAnalysis.IL.length, 3);
assert.ok(report.rosterAnalysis.IL.includes("Will Smith"));
assert.ok(report.rosterAnalysis.IL.includes("Corey Seager"));
assert.strictEqual(report.rosterAnalysis.bench.length, 5);

// Recommendations carried from the GM Decision Engine
assert.ok(report.recommendations.length > 0);
report.recommendations.forEach((r) => {
  assert.ok(typeof r.add === "string" && r.add);
  assert.ok(typeof r.drop === "string" && r.drop);
  assert.strictEqual(typeof r.confidence, "number");
  assert.strictEqual(typeof r.scoreGain, "number");
  assert.strictEqual(typeof r.confidenceSummary, "string");
  assert.ok(Array.isArray(r.components) && r.components.length === 5);
  assert.deepStrictEqual(Object.keys(r.waiverBand).sort(), ["emoji", "key", "label"]);
});

// Notes reflect the strategy
assert.ok(report.notes.some((n) => /Do not chase SB/.test(n)));
assert.ok(report.notes.some((n) => /Protect ERA/.test(n)));

// Text renderer returns a string with the key headline info
const text = renderWeeklyReport(report);
assert.strictEqual(typeof text, "string");
assert.ok(text.includes("Week 18") && text.includes("我們是富邦悍將你又是誰"));
assert.ok(text.includes(report.recommendations[0].confidenceSummary));
assert.ok(text.includes(report.recommendations[0].waiverBand.emoji));
assert.ok(text.includes(report.recommendations[0].waiverBand.label));

// Deterministic
assert.strictEqual(
  JSON.stringify(generateWeeklyReport({ team, matchup, strategy, recommendations: moves })),
  JSON.stringify(report)
);

console.log("weeklyReport.test.js OK");
