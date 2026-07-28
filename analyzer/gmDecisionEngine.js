// Combine ADD candidates (Streaming Engine) with droppable roster spots into
// complete add/drop moves, ranked by net Evaluator gain. Deterministic, no AI.
//
//   recommendMoves({ team, freeAgents, matchup, strategy }) -> { moves: [...] }

const { recommend } = require("./streamingEngine");
const { evaluatePlayer, categoryDelta } = require("./evaluator");
const { analyzeCategories } = require("./categoryAnalyzer");
const { bandFor } = require("./waiverBands");

const MOVE_LIMIT = 5;

// P1 — Recommendation Threshold: bands the net Move Score into an actionable
// call, independent of the numeric confidence ladder below.
const recommendationFor = (moveScore) =>
  moveScore >= 30 ? "Add Now" : moveScore >= 15 ? "Watch" : "No Move";

// Obvious core players we never auto-drop yet.
// ponytail: temporary name list; replaced by Evaluator thresholds once roster
// players carry real stats.
const PROTECTED = new Set([
  "Freddie Freeman", "Ketel Marte", "Corey Seager", "Yordan Alvarez",
  "José Ramírez", "Tarik Skubal", "Joe Ryan"
]);

const playersOf = (freeAgents) =>
  Array.isArray(freeAgents) ? freeAgents : freeAgents?.players || [];

const confidenceFor = (gain) =>
  gain >= 20 ? 0.9 : gain >= 10 ? 0.75 : gain >= 5 ? 0.6 : 0.4;

// P10 — Confidence Reasons: expose the Evaluator components behind the add
// candidate's score, plus a one-line human-readable summary of why the
// confidence % is what it is. Additive only; confidenceFor's scale/thresholds
// are untouched.
const COMPONENTS = [
  ["categoryScore", "Category Fit", 60],
  ["positionScore", "Position Fit", 20],
  ["availabilityScore", "Availability", 10],
  ["flexibilityScore", "Flexibility", 10],
  ["statcastScore", "Stability", 20]
];

const componentsOf = (add) =>
  COMPONENTS.map(([key, label, max]) => ({ label, score: add[key], max }));

const confidenceSummaryFor = ({ reasons, risks, worst, scoreGain, confidence }) => {
  const positives = reasons.slice(0, 2);
  const negatives = risks.slice(0, 2);
  const parts = [
    `${Math.round(confidence * 100)}% confidence`,
    `+${scoreGain} score gain over ${worst.name}`
  ];
  if (positives.length) parts.push(`driven by ${positives.join(", ")}`);
  if (negatives.length) parts.push(`tempered by ${negatives.join(", ")}`);
  return parts.join(" — ");
};

const isDroppable = (player) =>
  !player.isIL() && !PROTECTED.has(player.name) && !/^NA$/i.test(player.status || "");

const recommendMoves = ({ team, freeAgents, matchup, strategy } = {}) => {
  const activeStrategy =
    strategy || (matchup ? analyzeCategories(matchup).strategy : { attack: [], protect: [], ignore: [] });

  // Step 1: ranked ADD candidates from the Streaming Engine.
  const { recommendations } = recommend(freeAgents, activeStrategy, team);
  const faByName = new Map(playersOf(freeAgents).map((p) => [p.name, p]));

  // Step 2: evaluate droppable roster spots with the same Evaluator.
  const drops = (team?.players || [])
    .filter(isDroppable)
    .map((p) => ({ name: p.name, player: p, evaluation: evaluatePlayer(p, activeStrategy, team) }))
    .sort((a, b) => a.evaluation.score - b.evaluation.score);

  const worst = drops[0];
  if (!worst || recommendations.length === 0) return { moves: [] };

  // Step 3 & 4: pair each add with the weakest droppable spot, keep upgrades,
  // already ordered by add Streaming Score (drop is constant), take the top.
  // ponytail: always swaps the single weakest spot; position-aware swaps later.
  const moves = recommendations
    .map((add) => {
      const addPlayer = faByName.get(add.player);

      // Move Evaluator (P1): score this category by what the add actually
      // gains over what THIS drop already contributes, not the add's own
      // absolute strength -- an add's own categoryScore assumes an empty
      // roster spot, which is wrong once we know the real drop.
      const { score: categoryDeltaScore, perCategory } =
        categoryDelta(addPlayer?.stats, worst.player.stats, activeStrategy);

      const categoryReasons = Object.entries(perCategory)
        .filter(([, v]) => v.marker === "+")
        .map(([cat]) => `Improves ${cat}`);
      const categoryRisks = Object.entries(perCategory)
        .filter(([, v]) => v.marker === "-")
        .map(([cat]) => `Worsens ${cat}`);
      const categoryImpact = {};
      Object.entries(perCategory).forEach(([cat, v]) => { categoryImpact[cat] = v.marker; });

      // P2 — Explain Score: the numeric add/drop/delta behind each marker,
      // for callers (Coach output) that need more than +/-/=.
      const categoryBreakdown = Object.entries(perCategory).map(([cat, v]) => ({ cat, ...v }));

      // Non-category reasons/risks (position/availability/flexibility/stability)
      // describe the add candidate itself, not a comparison -- keep as-is.
      const nonCategoryReasons = add.reasons.filter((r) => !/^Improves /.test(r));
      const nonCategoryRisks = add.risks.filter((r) => r !== "Lower AVG");

      const reasons = [...categoryReasons, ...nonCategoryReasons];
      const moveScore = categoryDeltaScore + add.positionScore + add.availabilityScore
        + add.flexibilityScore + add.statcastScore;
      const scoreGain = moveScore - worst.evaluation.score;

      const risks = [...categoryRisks, ...nonCategoryRisks];
      if (scoreGain < 5) risks.push("Small upgrade only");
      const confidence = confidenceFor(scoreGain);

      return {
        type: "add_drop",
        add: { name: add.player },
        drop: { name: worst.name },
        confidence,
        scoreGain,
        recommendation: recommendationFor(scoreGain),
        categoryImpact,
        categoryBreakdown,
        explanation: [...reasons, `Higher Evaluator score than ${worst.name}`],
        risks,
        components: componentsOf({ ...add, categoryScore: categoryDeltaScore }),
        confidenceSummary: confidenceSummaryFor({ reasons, risks, worst: { name: worst.name }, scoreGain, confidence }),
        waiverBand: bandFor({ score: moveScore, confidence })
      };
    })
    .filter((m) => m.scoreGain > 0)
    // Category Delta breaks the old add.score ordering (it's no longer
    // monotonic with the add's absolute streaming score), so re-sort by the
    // real net gain for this specific pairing.
    .sort((a, b) => b.scoreGain - a.scoreGain || a.add.name.localeCompare(b.add.name))
    .slice(0, MOVE_LIMIT);

  return { moves };
};

module.exports = { recommendMoves, PROTECTED };
