// Deterministic weekly GM report. Pure aggregation of the existing analyzers
// and the GM Decision Engine — no new analysis, no GPT.
//
//   generateWeeklyReport({ team, matchup, strategy, recommendations })
//     -> { summary, strengths, weaknesses, categoryOutlook, rosterAnalysis,
//          recommendations, notes }

const { analyzeLineup } = require("./lineupAnalyzer");

const HITTING_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF"];
const DEEP = 4; // eligible non-IL hitters that make a position a strength
const STRONG_STAFF = 8; // pitcher count that makes the staff a strength

const movesOf = (recommendations) =>
  Array.isArray(recommendations) ? recommendations : recommendations?.moves || [];

const name = (x) => (x && typeof x === "object" ? x.name : x);

const generateWeeklyReport = ({ team, matchup, strategy, recommendations } = {}) => {
  const lineup = analyzeLineup(team); // { positionDepth, bench, IL, weakSlots, notes }
  const deepPositions = HITTING_POSITIONS.filter((p) => (lineup.positionDepth[p] || []).length >= DEEP);
  const pitcherCount = team ? team.pitchers().length : 0;

  const strengths = [
    ...deepPositions.map((p) => `Deep ${p}`),
    ...(pitcherCount >= STRONG_STAFF ? ["Deep SP"] : [])
  ];
  const weaknesses = [
    ...lineup.weakSlots.map((p) => `Thin at ${p}`),
    ...(lineup.IL.length ? [`${lineup.IL.length} players on IL`] : [])
  ];

  const strat = strategy || { attack: [], protect: [], ignore: [] };
  const categoryOutlook = {
    attack: strat.attack || [],
    protect: strat.protect || [],
    ignore: strat.ignore || []
  };

  const rosterAnalysis = {
    strengths,
    weakPositions: [...lineup.weakSlots],
    IL: lineup.IL.map((p) => p.name),
    bench: lineup.bench.map((p) => p.name)
  };

  const teams = matchup?.teams || {};
  const summary = {
    week: matchup?.week || "",
    opponent: teams.opponent?.name || "",
    currentScore: `${matchup?.score?.mine ?? 0}-${matchup?.score?.opponent ?? 0}`,
    remainingGames: {
      mine: teams.mine?.remainingGames ?? null,
      opponent: teams.opponent?.remainingGames ?? null
    }
  };

  const recs = movesOf(recommendations).map((m) => ({
    add: name(m.add),
    drop: name(m.drop),
    confidence: m.confidence,
    scoreGain: m.scoreGain
  }));

  const notes = [];
  if (categoryOutlook.attack.length) notes.push(`Prioritize ${categoryOutlook.attack.join("/")}`);
  if (categoryOutlook.protect.length) notes.push(`Protect ${categoryOutlook.protect.join("/")}`);
  if (categoryOutlook.ignore.length) notes.push(`Do not chase ${categoryOutlook.ignore.join("/")} this week`);

  return { summary, strengths, weaknesses, categoryOutlook, rosterAnalysis, recommendations: recs, notes };
};

const BAR = "==============================";
const RULE = "------------------------------";

const renderWeeklyReport = (report) => {
  const { summary, strengths, weaknesses, categoryOutlook, recommendations } = report;
  const top = recommendations[0];
  const lines = [
    BAR, "Fantasy AI GM Weekly Report", summary.week, BAR,
    `Opponent: ${summary.opponent}`,
    `Current Score: ${summary.currentScore}`,
    RULE,
    "Strengths", ...strengths.map((s) => `  ✔ ${s}`),
    "Weaknesses", ...weaknesses.map((w) => `  ⚠ ${w}`),
    RULE,
    `Attack:  ${categoryOutlook.attack.join(" ")}`,
    `Protect: ${categoryOutlook.protect.join(" ")}`,
    `Ignore:  ${categoryOutlook.ignore.join(" ")}`,
    RULE
  ];
  if (top) {
    lines.push(
      "Top Recommendation",
      `  ADD  ${top.add}`,
      `  DROP ${top.drop}`,
      `  Confidence ${Math.round(top.confidence * 100)}%`,
      `  Expected Gain +${top.scoreGain}`
    );
  }
  lines.push(BAR);
  return lines.join("\n");
};

module.exports = { generateWeeklyReport, renderWeeklyReport };
