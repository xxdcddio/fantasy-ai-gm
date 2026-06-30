// Sprint 14.2 — Compare CLI. Compares two free agents on the shared Evaluator's
// component scores and declares a winner. Deterministic; no re-scoring.
//
//   npm run compare "Christian Walker" "Curtis Mead"

const { runAnalysis } = require("./analyze");
const { lookupPlayer } = require("./player");

const COMPONENTS = [
  ["Final", "score"],
  ["Category", "categoryScore"],
  ["Statcast", "statcastScore"],
  ["Position", "positionScore"],
  ["Flexibility", "flexibilityScore"],
  ["Availability", "availabilityScore"]
];

const comparePlayers = (nameA, nameB, ctx) => {
  const a = lookupPlayer(nameA, ctx);
  const b = lookupPlayer(nameB, ctx);
  const missing = [!a && nameA, !b && nameB].filter(Boolean);
  if (missing.length) return { winner: null, missing, a, b };

  const ea = a.evaluation;
  const eb = b.evaluation;
  const winnerIsA = ea.score >= eb.score;
  const [win, lose] = winnerIsA ? [ea, eb] : [eb, ea];

  // "Because": components where the winner strictly beats the loser.
  const reasons = COMPONENTS.filter(([, k]) => k !== "score" && win[k] > lose[k])
    .map(([label]) => `Better ${label}`);

  return {
    winner: ea.score === eb.score ? "Tie" : winnerIsA ? nameA : nameB,
    a: { name: a.player.name, evaluation: ea },
    b: { name: b.player.name, evaluation: eb },
    reasons
  };
};

const BAR = "======================================";
const RULE = "--------------------------------------";

const formatCompare = (res) => {
  if (res.missing) return `Player not found: ${res.missing.join(", ")}`;
  const { a, b, winner, reasons } = res;
  const rows = COMPONENTS.map(
    ([label, k]) => `${label.padEnd(13)} ${String(a.evaluation[k]).padStart(4)}  vs  ${String(b.evaluation[k]).padStart(4)}`
  );
  return [
    BAR, `${a.name}  vs  ${b.name}`, BAR,
    ...rows,
    RULE, "Winner", winner,
    "Because", ...(reasons.length ? reasons.map((r) => `+ ${r}`) : ["+ Higher overall GM score"]),
    BAR
  ].join("\n");
};

if (require.main === module) {
  const [nameA, nameB] = process.argv.slice(2);
  if (!nameA || !nameB) {
    console.error('Usage: npm run compare "Player A" "Player B"');
    process.exit(1);
  }
  const { freeAgents, strategy, team } = runAnalysis();
  console.log(formatCompare(comparePlayers(nameA, nameB, { freeAgents, strategy, team })));
}

module.exports = { comparePlayers, formatCompare };
