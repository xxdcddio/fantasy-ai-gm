// Shared per-player GM scorer. Streaming Engine, Decision Engine, Trade
// Analyzer (and a future NBA GM) all consume this — one scoring model, not
// Yahoo rank. Deterministic, no AI.
//
//   evaluatePlayer(player, strategy, team)
//     -> { score, categoryScore, positionScore, availabilityScore,
//          flexibilityScore, reasons, risks }
//
//   score = categoryScore(<=60) + positionScore(<=20)
//         + availabilityScore(<=10) + flexibilityScore(<=10)

const { findEmptyOrWeakSlots } = require("./lineupAnalyzer");

// Absolute reference scales: [floor, full]. value >= full -> strength 1.
// ponytail: crude season-total thresholds; refine with projections / pace.
const STAT_SCALE = {
  R: [0, 60],
  HR: [0, 20],
  RBI: [0, 60],
  SB: [0, 20],
  BB: [0, 50],
  AVG: [0.23, 0.3],
  OPS: [0.7, 0.85]
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const strengthOf = (cat, value) => {
  const scale = STAT_SCALE[cat];
  if (!scale || value == null) return null;
  return clamp01((value - scale[0]) / (scale[1] - scale[0]));
};

const categoryComponent = (player, strategy) => {
  const stats = player.stats || {};
  const reasons = [];
  const risks = [];

  const strengths = (strategy?.attack || [])
    .map((cat) => ({ cat, s: strengthOf(cat, stats[cat]) }))
    .filter((x) => x.s != null);

  strengths.filter((x) => x.s >= 0.6).forEach((x) => reasons.push(`Improves ${x.cat}`));

  // Adding a weak-average bat dilutes AVG — flag it as a risk.
  const avg = strengthOf("AVG", stats.AVG);
  if (avg != null && avg < 0.3) risks.push("Lower AVG");

  const score = strengths.length
    ? Math.round((strengths.reduce((a, b) => a + b.s, 0) / strengths.length) * 60)
    : 0;

  return { score, reasons, risks };
};

const positionComponent = (player, team) => {
  const weak = team ? findEmptyOrWeakSlots(team) : [];
  const hit = (player.eligiblePositions || []).find((p) => weak.includes(p));
  return hit
    ? { score: 20, reasons: [`Fills weak ${hit} position`], risks: [] }
    : { score: 3, reasons: [], risks: [] };
};

const availabilityComponent = (player) => {
  const status = String(player.status || "").toUpperCase();
  if (/^IL|^DL|^NA$|^O$|^SUSP/.test(status)) {
    return { score: 0, reasons: [], risks: [`On IL (${status})`] };
  }
  if (/^DTD|^GTD|^Q$/.test(status)) {
    return { score: 3, reasons: [], risks: [`Day-to-day (${status})`] };
  }
  return { score: 10, reasons: ["Healthy"], risks: [] };
};

const flexibilityComponent = (player) => {
  const positions = player.eligiblePositions || [];
  const score = positions.length >= 3 ? 10 : positions.length === 2 ? 4 : 0;
  return {
    score,
    reasons: positions.length >= 2 ? [`Multi-position (${positions.join("/")})`] : [],
    risks: []
  };
};

const evaluatePlayer = (player, strategy, team) => {
  const category = categoryComponent(player, strategy);
  const position = positionComponent(player, team);
  const availability = availabilityComponent(player);
  const flexibility = flexibilityComponent(player);

  return {
    score: category.score + position.score + availability.score + flexibility.score,
    categoryScore: category.score,
    positionScore: position.score,
    availabilityScore: availability.score,
    flexibilityScore: flexibility.score,
    reasons: [...category.reasons, ...position.reasons, ...availability.reasons, ...flexibility.reasons],
    risks: [...category.risks, ...position.risks, ...availability.risks, ...flexibility.risks]
  };
};

module.exports = { evaluatePlayer };
