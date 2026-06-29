// Combine ADD candidates (Streaming Engine) with droppable roster spots into
// complete add/drop moves, ranked by net Evaluator gain. Deterministic, no AI.
//
//   recommendMoves({ team, freeAgents, matchup, strategy }) -> { moves: [...] }

const { recommend } = require("./streamingEngine");
const { evaluatePlayer, strengthOf } = require("./evaluator");
const { analyzeCategories } = require("./categoryAnalyzer");

const MOVE_LIMIT = 5;
const IMPACT_CATS = ["R", "HR", "RBI", "SB", "BB", "AVG", "OPS"];

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

// What adding this player does to each category, from its own stat strengths.
// (Roster players lack season stats, so the drop side can't be compared yet.)
const categoryImpact = (player) => {
  const stats = player?.stats || {};
  const impact = {};
  IMPACT_CATS.forEach((cat) => {
    const s = strengthOf(cat, stats[cat]);
    if (s == null) return;
    impact[cat] = s >= 0.6 ? "+" : s < 0.3 ? "-" : "=";
  });
  return impact;
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
    .map((p) => ({ name: p.name, evaluation: evaluatePlayer(p, activeStrategy, team) }))
    .sort((a, b) => a.evaluation.score - b.evaluation.score);

  const worst = drops[0];
  if (!worst || recommendations.length === 0) return { moves: [] };

  // Step 3 & 4: pair each add with the weakest droppable spot, keep upgrades,
  // already ordered by add Streaming Score (drop is constant), take the top.
  // ponytail: always swaps the single weakest spot; position-aware swaps later.
  const moves = recommendations
    .map((add) => {
      const scoreGain = add.score - worst.evaluation.score;
      const risks = [...add.risks];
      if (scoreGain < 5) risks.push("Small upgrade only");
      return {
        type: "add_drop",
        add: { name: add.player },
        drop: { name: worst.name },
        confidence: confidenceFor(scoreGain),
        scoreGain,
        categoryImpact: categoryImpact(faByName.get(add.player)),
        explanation: [...add.reasons, `Higher Evaluator score than ${worst.name}`],
        risks
      };
    })
    .filter((m) => m.scoreGain > 0)
    .slice(0, MOVE_LIMIT);

  return { moves };
};

module.exports = { recommendMoves, PROTECTED };
