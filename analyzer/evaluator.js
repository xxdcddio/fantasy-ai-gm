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
const { getPlayerStatcast } = require("./providers/statcast");

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

// Statcast star tiers (Sprint 11). Each metric -> 1..5; statcastScore is their
// sum, so a fixture-backed player gains up to ~20. Players without a fixture get
// 0 (neutral). ponytail: availability of data nudges score; revisit if it skews.
const barrelStars = (b) => (b >= 15 ? 5 : b >= 12 ? 4 : b >= 10 ? 3 : b >= 8 ? 2 : 1);
const hardHitStars = (h) => (h >= 50 ? 5 : h >= 45 ? 4 : h >= 40 ? 3 : h >= 35 ? 2 : 1);
const xwobaStars = (x) => (x >= 0.38 ? 5 : x >= 0.36 ? 4 : x >= 0.34 ? 3 : x >= 0.32 ? 2 : 1);
const xslgStars = (s) => (s >= 0.55 ? 5 : s >= 0.5 ? 4 : s >= 0.47 ? 3 : s >= 0.43 ? 2 : 1);

const statcastComponent = (player) => {
  const sc = getPlayerStatcast(player.name);
  if (!sc) return { score: 0, reasons: [], risks: [] };

  const stars = [];
  const reasons = [];
  const risks = [];
  const grade = (value, starsFn, label) => {
    if (value == null) return;
    const s = starsFn(value);
    stars.push(s);
    if (s >= 5) reasons.push(`Elite ${label}`);
    else if (s >= 4) reasons.push(`Strong ${label}`);
  };

  grade(sc.barrelRate, barrelStars, "Barrel %");
  grade(sc.hardHitRate, hardHitStars, "Hard Hit %");
  grade(sc.xwOBA, xwobaStars, "xwOBA");
  grade(sc.xSLG, xslgStars, "xSLG");

  if (sc.whiffRate != null && sc.whiffRate >= 30) risks.push("High Whiff Rate");
  if (sc.chaseRate != null && sc.chaseRate >= 32) risks.push("High Chase Rate");

  return { score: stars.reduce((a, b) => a + b, 0), reasons, risks };
};

const evaluatePlayer = (player, strategy, team) => {
  const category = categoryComponent(player, strategy);
  const position = positionComponent(player, team);
  const availability = availabilityComponent(player);
  const flexibility = flexibilityComponent(player);
  const statcast = statcastComponent(player);

  return {
    score:
      category.score + position.score + availability.score + flexibility.score + statcast.score,
    categoryScore: category.score,
    positionScore: position.score,
    availabilityScore: availability.score,
    flexibilityScore: flexibility.score,
    statcastScore: statcast.score,
    reasons: [
      ...category.reasons, ...statcast.reasons, ...position.reasons,
      ...availability.reasons, ...flexibility.reasons
    ],
    risks: [...category.risks, ...statcast.risks, ...position.risks, ...availability.risks, ...flexibility.risks]
  };
};

module.exports = { evaluatePlayer, strengthOf };
