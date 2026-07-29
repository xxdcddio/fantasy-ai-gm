// Shared per-player GM scorer. Streaming Engine, Decision Engine, Trade
// Analyzer (and a future NBA GM) all consume this — one scoring model, not
// Yahoo rank. Deterministic, no AI.
//
//   evaluatePlayer(player, strategy, team)
//     -> { score, categoryScore, positionScore, availabilityScore,
//          flexibilityScore, statcastScore, qualityScore, skillScore,
//          disciplineScore, reasons, risks }
//
//   score = categoryScore(<=60) + positionScore(<=20)
//         + availabilityScore(<=10) + flexibilityScore(<=10)

const { classifyWeakSlots, SCARCE_POSITIONS } = require("./lineupAnalyzer");
const { getPlayerStatcast } = require("./providers/statcast");

// P2 — Weak Position Bonus is no longer flat: how badly a slot needs help
// depends on *why* it's weak. Temporary injuries resolve themselves, so they
// get a smaller bonus than a genuine, hard-to-fix weakness.
const WEAK_SLOT_BONUS = {
  "No starter": 20,
  "Permanent weakness": 20,
  "No backup": 15,
  "Temporary injury": 8
};

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
const clampSigned = (n) => Math.max(-1, Math.min(1, n));
const strengthOf = (cat, value) => {
  const scale = STAT_SCALE[cat];
  if (!scale || value == null) return null;
  return clamp01((value - scale[0]) / (scale[1] - scale[0]));
};

// P3 — Established Star Protection: a preseason top-tier pick in a slump
// still projects better than a bad stretch of stats alone implies -- floor
// their category score instead of letting it read as fully replaceable.
const STAR_PRESEASON_RANK = 50;
const STAR_CATEGORY_FLOOR = 30;

// P3 — Breakout Bonus: reward a rank far ahead of preseason expectation --
// a real performance change worth chasing, not rank noise. Gated on a
// meaningful at-bat sample (from stats.hAb, "H/AB") so a tiny-sample hot
// streak doesn't qualify; players with no hAb (pitchers -- no innings data
// yet) simply don't qualify.
const BREAKOUT_RANK_GAP = 100;
const BREAKOUT_MIN_AB = 100;
const BREAKOUT_BONUS = 10;

const atBatsOf = (player) => {
  const ab = Number(String(player.stats?.hAb || "").split("/")[1]);
  return Number.isFinite(ab) ? ab : null;
};

// Move Evaluator (PRD v2, P1) — what ADDing this player instead of DROPping the
// other one actually does per category, not just the add's own absolute
// strength. Fixes the "recommends a zero-SB bat over a real SB source and
// claims it improves SB" class of bug: delta is computed against the real
// drop, not against an implicit empty roster spot.
const CATEGORY_DELTA_CATS = ["R", "HR", "RBI", "SB", "BB", "AVG", "OPS"];

const categoryDelta = (addStats = {}, dropStats = {}, strategy = {}) => {
  const attack = new Set(strategy?.attack || []);
  const perCategory = {};
  let weightedSum = 0;
  let weightTotal = 0;

  CATEGORY_DELTA_CATS.forEach((cat) => {
    const scale = STAT_SCALE[cat];
    const addValue = addStats[cat];
    const dropValue = dropStats[cat];
    if (!scale || addValue == null || dropValue == null) return;

    const width = scale[1] - scale[0];
    const delta = addValue - dropValue;
    const normalized = clampSigned(delta / width);
    const marker = normalized > 0.15 ? "+" : normalized < -0.15 ? "-" : "=";
    perCategory[cat] = { add: addValue, drop: dropValue, delta, marker };

    const weight = attack.has(cat) ? 2 : 1;
    weightedSum += normalized * weight;
    weightTotal += weight;
  });

  const score = weightTotal ? Math.round(clampSigned(weightedSum / weightTotal) * 60) : 0;
  return { score, perCategory };
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

  let score = strengths.length
    ? Math.round((strengths.reduce((a, b) => a + b.s, 0) / strengths.length) * 60)
    : 0;

  if (player.preSeasonRank != null && player.preSeasonRank <= STAR_PRESEASON_RANK && score < STAR_CATEGORY_FLOOR) {
    score = STAR_CATEGORY_FLOOR;
    reasons.push("Established star (floor applied)");
  }

  const rankGap = player.preSeasonRank != null && player.rank != null
    ? player.preSeasonRank - player.rank
    : null;
  const ab = atBatsOf(player);
  if (rankGap != null && rankGap >= BREAKOUT_RANK_GAP && ab != null && ab >= BREAKOUT_MIN_AB) {
    score += BREAKOUT_BONUS;
    reasons.push(`Breakout (#${player.preSeasonRank} preseason -> #${player.rank})`);
  }

  score = Math.min(60, score);

  return { score, reasons, risks };
};

const positionComponent = (player, team) => {
  const weak = team ? classifyWeakSlots(team) : {};
  const positions = player.eligiblePositions || [];

  const hit = positions.find((p) => weak[p]);
  if (hit) {
    const classification = weak[hit];
    return {
      score: WEAK_SLOT_BONUS[classification],
      reasons: [`Fills weak ${hit} position (${classification})`],
      risks: []
    };
  }

  // P2 — Replacement Cost: even when your own roster isn't thin there right
  // now, scarce positions (C/SS/RP/SP) are harder to replace later than deep
  // ones, so eligibility there carries a small bonus on its own.
  const scarcePosition = positions.find((p) => SCARCE_POSITIONS.has(p));
  return scarcePosition
    ? { score: 8, reasons: [`Scarce position (${scarcePosition})`], risks: [] }
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

// Stability Score (Sprint 16, see docs/stability-score.md). statcastScore is no
// longer a sum of 4 star ratings -- it's a 0-20 Underlying Skill score built
// from three buckets: Quality (contact), Skill (expected outcomes), Discipline
// (chase/whiff risk). Hot/Cold classification compares real AVG/OPS production
// against this Skill/Quality process score. Thresholds below are initial
// calibration; ponytail: revisit once more Statcast fixtures exist.
const SCALE = {
  xwOBA: [0.3, 0.4],
  xSLG: [0.38, 0.56],
  xBA: [0.23, 0.3],
  barrelRate: [6, 16],
  hardHitRate: [32, 52],
  exitVelocity: [86, 94],
  chaseRate: [35, 20], // lower is better
  whiffRate: [32, 18] // lower is better
};

const gradeOf = (metric, value) => {
  const [floor, full] = SCALE[metric];
  if (value == null) return 0;
  return clamp01((value - floor) / (full - floor));
};

const resultLevel = (stats) => {
  const avg = strengthOf("AVG", stats.AVG);
  const ops = strengthOf("OPS", stats.OPS);
  if (avg == null || ops == null) return null;
  const level = (avg + ops) / 2;
  return level >= 0.65 ? "hot" : level <= 0.35 ? "cold" : "neutral";
};

const processLevel = (quality, skill) => {
  const level = (quality + skill) / 16; // Quality max 6 + Skill max 10
  return level >= 0.65 ? "strong" : level <= 0.35 ? "weak" : "neutral";
};

// Fixed set of 4 labels -- no 5th bucket. Anything not clearly hot+strong,
// hot+weak, or cold+strong falls back to "Stable producer".
const classify = (result, process) => {
  if (result === "hot" && process === "strong") return "Hot and sustainable";
  if (result === "hot" && process === "weak") return "Hot but lucky";
  if (result === "cold" && process === "strong") return "Cold but unlucky";
  return "Stable producer";
};

const statcastComponent = (player) => {
  const sc = getPlayerStatcast(player.name);
  if (!sc) return { score: 0, quality: 0, skill: 0, discipline: 0, reasons: [], risks: [] };

  const quality = (gradeOf("barrelRate", sc.barrelRate) * 3)
    + (gradeOf("hardHitRate", sc.hardHitRate) * 2)
    + (gradeOf("exitVelocity", sc.exitVelocity) * 1);
  const skill = (gradeOf("xwOBA", sc.xwOBA) * 5)
    + (gradeOf("xSLG", sc.xSLG) * 3)
    + (gradeOf("xBA", sc.xBA) * 2);
  const discipline = (gradeOf("chaseRate", sc.chaseRate) * 2)
    + (gradeOf("whiffRate", sc.whiffRate) * 2);

  const reasons = [];
  const risks = [];

  if (quality / 6 >= 0.8) reasons.push("Elite contact quality");
  if (skill / 10 >= 0.7) reasons.push("Strong underlying metrics");
  if (sc.chaseRate != null && sc.chaseRate <= 25 && sc.whiffRate != null && sc.whiffRate <= 20) {
    reasons.push("Excellent plate discipline");
  }
  if (sc.chaseRate != null && sc.chaseRate >= 32) risks.push("High chase risk");
  if (sc.whiffRate != null && sc.whiffRate >= 30) risks.push("High whiff risk");

  const stats = player.stats || {};
  const result = resultLevel(stats);
  if (result != null) {
    const label = classify(result, processLevel(quality, skill));
    reasons.push(label);
    if (label === "Hot but lucky") reasons.push("Likely negative regression");
    if (label === "Cold but unlucky") reasons.push("Likely positive regression");
  }

  return {
    score: Math.round(quality + skill + discipline),
    quality: Math.round(quality),
    skill: Math.round(skill),
    discipline: Math.round(discipline),
    reasons,
    risks
  };
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
    qualityScore: statcast.quality,
    skillScore: statcast.skill,
    disciplineScore: statcast.discipline,
    reasons: [
      ...category.reasons, ...statcast.reasons, ...position.reasons,
      ...availability.reasons, ...flexibility.reasons
    ],
    risks: [...category.risks, ...statcast.risks, ...position.risks, ...availability.risks, ...flexibility.risks]
  };
};

module.exports = { evaluatePlayer, strengthOf, categoryDelta };
