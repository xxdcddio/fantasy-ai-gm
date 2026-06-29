// Turn parsed matchup categories into a weekly strategy. Deterministic — no AI.
// Consumes parseMatchup() output (or any { categories: [...] }).

// "Close" margins per category. Counting stats use a flat gap; rate stats need
// much smaller thresholds. ponytail: crude fixed thresholds — refine later with
// remaining games / projections instead of raw current margin.
const CLOSE_THRESHOLD = { AVG: 0.02, OPS: 0.02, ERA: 0.5, WHIP: 0.1 };
const DEFAULT_CLOSE = 3;
const closeThreshold = (name) =>
  Object.prototype.hasOwnProperty.call(CLOSE_THRESHOLD, name) ? CLOSE_THRESHOLD[name] : DEFAULT_CLOSE;

const round3 = (n) => Math.round(n * 1000) / 1000;

const analyzeCategory = (c) => {
  const lowerIsBetter = Boolean(c.lowerIsBetter);
  const { mine = null, opponent = null } = c;
  const known = mine != null && opponent != null;

  const margin = known ? round3(mine - opponent) : null;
  // advantage > 0 means I'm winning the category (handles lower-is-better).
  // Rounded so float noise (1.2 - 1.3) doesn't tip a boundary margin out of "close".
  const advantage = known ? round3(lowerIsBetter ? opponent - mine : mine - opponent) : null;

  let status = "unknown";
  if (known) status = advantage > 0 ? "ahead" : advantage < 0 ? "behind" : "tied";

  const close = known && Math.abs(advantage) <= closeThreshold(c.name);

  let priority;
  if (!known) priority = "ignore";
  else if (status === "tied") priority = "high";
  else if (status === "behind") priority = close ? "high" : "ignore"; // close behind vs far behind
  else priority = close ? "medium" : "low"; // close ahead (protect) vs safely ahead

  return { name: c.name, type: c.type, mine, opponent, margin, status, priority, lowerIsBetter };
};

const analyzeCategories = (matchup) => {
  const categories = (matchup?.categories || []).map(analyzeCategory);

  const attack = [];
  const protect = [];
  const ignore = [];

  categories.forEach((c) => {
    if (c.status === "unknown") ignore.push(c.name);
    else if (c.status === "ahead") (c.priority === "medium" ? protect : ignore).push(c.name);
    else (c.priority === "high" ? attack : ignore).push(c.name); // behind or tied
  });

  const notes = [
    ...attack.map((n) => `Attack ${n}`),
    ...protect.map((n) => `Protect ${n}`)
  ];

  return { categories, strategy: { attack, protect, ignore }, notes };
};

module.exports = { analyzeCategories, analyzeCategory };
