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
assert.strictEqual(report.summary.week, "Week 15");
assert.strictEqual(report.summary.opponent, "台鋼雄鷹MLB分隊");
assert.strictEqual(report.summary.currentScore, "6-6");
assert.deepStrictEqual(report.summary.remainingGames, { mine: 92, opponent: 96 });

// Strengths / weaknesses from roster shape (weak slots: C, 3B; OF is deep)
assert.ok(report.weaknesses.includes("Thin at C"));
assert.ok(report.weaknesses.includes("Thin at 3B"));
assert.ok(report.strengths.includes("Deep OF"));

// Category outlook mirrors the strategy
assert.deepStrictEqual(report.categoryOutlook, {
  attack: ["HR", "RBI", "OPS"],
  protect: ["ERA", "WHIP"],
  ignore: ["SB"]
});

// Roster analysis
assert.deepStrictEqual([...report.rosterAnalysis.weakPositions].sort(), ["3B", "C"]);
assert.strictEqual(report.rosterAnalysis.IL.length, 4);
assert.ok(report.rosterAnalysis.IL.includes("Will Smith"));
assert.ok(report.rosterAnalysis.IL.includes("José Ramírez"));
assert.strictEqual(report.rosterAnalysis.bench.length, 5);

// Recommendations carried from the GM Decision Engine
assert.ok(report.recommendations.length > 0);
report.recommendations.forEach((r) => {
  assert.ok(typeof r.add === "string" && r.add);
  assert.ok(typeof r.drop === "string" && r.drop);
  assert.strictEqual(typeof r.confidence, "number");
  assert.strictEqual(typeof r.scoreGain, "number");
});

// Notes reflect the strategy
assert.ok(report.notes.some((n) => /Do not chase SB/.test(n)));
assert.ok(report.notes.some((n) => /Protect ERA/.test(n)));

// Text renderer returns a string with the key headline info
const text = renderWeeklyReport(report);
assert.strictEqual(typeof text, "string");
assert.ok(text.includes("Week 15") && text.includes("台鋼雄鷹MLB分隊"));

// Deterministic
assert.strictEqual(
  JSON.stringify(generateWeeklyReport({ team, matchup, strategy, recommendations: moves })),
  JSON.stringify(report)
);

console.log("weeklyReport.test.js OK");
