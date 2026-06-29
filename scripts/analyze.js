// Daily CLI analyzer. Wires the deterministic pipeline end to end from the
// extension fixtures and prints today's recommendation. No AI.
//
//   npm run analyze   ->  node scripts/analyze.js
//
// runAnalysis() returns the structured result; formatAnalysis() renders it.

const fs = require("fs");
const path = require("path");

const Team = require("../analyzer/models/team");
const { FreeAgentList } = require("../analyzer/models/freeAgent");
const { normalizeFantasyJson, normalizeFreeAgents } = require("../analyzer/parser");
const { parseMatchup } = require("../analyzer/matchupParser");
const { analyzeCategories } = require("../analyzer/categoryAnalyzer");
const { recommend } = require("../analyzer/streamingEngine");
const { recommendMoves } = require("../analyzer/gmDecisionEngine");
const { generateWeeklyReport } = require("../analyzer/weeklyReport");

const SAMPLES = path.join(__dirname, "..", "data", "samples");
const read = (f) => JSON.parse(fs.readFileSync(path.join(SAMPLES, f), "utf8"));

const runAnalysis = () => {
  const team = new Team(normalizeFantasyJson(read("team.json")));
  const freeAgents = new FreeAgentList(normalizeFreeAgents(read("player.json")));
  const matchup = parseMatchup(read("matchup.json"));

  const { strategy } = analyzeCategories(matchup);
  const streaming = recommend(freeAgents, strategy, team).recommendations;
  const { moves } = recommendMoves({ team, freeAgents, matchup, strategy });
  const report = generateWeeklyReport({ team, matchup, strategy, recommendations: moves });

  return { team, freeAgents, matchup, strategy, streaming, moves, report };
};

const BAR = "======================================";
const RULE = "--------------------------------------";

const formatAnalysis = ({ report, streaming }) => {
  const { summary, categoryOutlook, recommendations, rosterAnalysis } = report;
  const lines = [
    BAR, "Fantasy AI GM", summary.week, BAR,
    "Opponent", summary.opponent,
    "Current Score", summary.currentScore,
    RULE,
    "Attack", ...categoryOutlook.attack,
    "Protect", ...categoryOutlook.protect,
    "Ignore", ...categoryOutlook.ignore,
    RULE
  ];

  const top = recommendations[0];
  if (top) {
    lines.push(
      "Top Recommendation",
      "ADD", top.add,
      "DROP", top.drop,
      "Confidence", `${Math.round(top.confidence * 100)}%`,
      RULE
    );
  }

  lines.push("Top 5 Streaming");
  streaming.slice(0, 5).forEach((r, i) => lines.push(`${i + 1}. ${r.player}`));
  lines.push(RULE);

  lines.push("Weak Positions", ...rosterAnalysis.weakPositions, RULE);
  lines.push("Finished", BAR);
  return lines.join("\n");
};

if (require.main === module) {
  console.log(formatAnalysis(runAnalysis()));
}

module.exports = { runAnalysis, formatAnalysis };
