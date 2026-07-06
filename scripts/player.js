// Sprint 14.1 — Player Lookup CLI. Shows the full Evaluator breakdown for one
// free agent. Reuses the single shared scorer; no re-scoring here.
//
//   npm run player "Christian Walker"

const { runAnalysis } = require("./analyze");
const { evaluatePlayer } = require("../analyzer/evaluator");

// Single shared lookup for every CLI: search free agents first, then the team
// roster. A name belongs to one or the other, never both.
const lookupPlayer = (name, { freeAgents, strategy, team } = {}) => {
  const player =
    (freeAgents && freeAgents.find(name)) ||
    (team && team.findPlayer && team.findPlayer(name)) ||
    null;
  if (!player) return null;
  return { player, evaluation: evaluatePlayer(player, strategy, team) };
};

const BAR = "======================================";
const RULE = "--------------------------------------";
const list = (items, prefix) => (items.length ? items.map((x) => `${prefix} ${x}`) : ["(none)"]);

const formatPlayer = (name, result) => {
  if (!result) return `Player not found: ${name}`;
  const { player, evaluation: e } = result;
  return [
    BAR, player.name, BAR,
    `GM Score      ${e.score}`,
    `Category      ${e.categoryScore}`,
    `Position      ${e.positionScore}`,
    `Availability  ${e.availabilityScore}`,
    `Flexibility   ${e.flexibilityScore}`,
    `Statcast      ${e.statcastScore} (Quality ${e.qualityScore} / Skill ${e.skillScore} / Discipline ${e.disciplineScore})`,
    RULE, "Reasons", ...list(e.reasons, "+"),
    RULE, "Risks", ...list(e.risks, "-"),
    BAR
  ].join("\n");
};

if (require.main === module) {
  const name = process.argv.slice(2).join(" ").trim();
  if (!name) {
    console.error('Usage: npm run player "Player Name"');
    process.exit(1);
  }
  const { freeAgents, strategy, team } = runAnalysis();
  console.log(formatPlayer(name, lookupPlayer(name, { freeAgents, strategy, team })));
}

module.exports = { lookupPlayer, formatPlayer };
