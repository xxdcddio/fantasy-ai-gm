// P6 — Waiver Timing: a presentation-layer label over the Evaluator's own
// `score` (and, where available, gmDecisionEngine's `confidence`). Never
// re-scores — see docs/waiver-timing.md for the threshold rationale.

const MAX_SCORE = 120; // categoryScore(60)+positionScore(20)+availabilityScore(10)+flexibilityScore(10)+statcastScore(20)

// Score cutoffs: 50%/30%/15% of the Evaluator's documented max. Confidence
// gates reuse gmDecisionEngine's own confidenceFor rungs (0.75/0.6) instead
// of inventing new confidence semantics.
const BANDS = [
  { key: "add_now", emoji: "🔥", label: "Add Now", minScore: Math.round(MAX_SCORE * 0.5), minConfidence: 0.75 },
  { key: "watch", emoji: "👀", label: "Watch List", minScore: Math.round(MAX_SCORE * 0.3), minConfidence: 0.6 },
  { key: "hold", emoji: "🤝", label: "Hold", minScore: Math.round(MAX_SCORE * 0.15) },
  { key: "ignore", emoji: "❌", label: "Ignore", minScore: 0 }
];

const bandFor = ({ score, confidence } = {}) => {
  const hit = BANDS.find(
    (b) => score >= b.minScore && (b.minConfidence == null || confidence == null || confidence >= b.minConfidence)
  );
  return { key: hit.key, emoji: hit.emoji, label: hit.label };
};

module.exports = { bandFor, BANDS, MAX_SCORE };
