// Sprint 14.3 — Free Agent Ranking CLI. Ranks available free agents by the
// shared Evaluator's GM score. Deterministic; no re-scoring.
//
//   npm run fa
//   npm run fa --top 20
//   npm run fa --position 3B

const { runAnalysis } = require("./analyze");
const { evaluatePlayer } = require("../analyzer/evaluator");

const rankFreeAgents = ({ freeAgents, strategy, team } = {}, { top = 10, position } = {}) => {
  const pool = (position ? freeAgents.findByPosition(position) : freeAgents.players)
    .filter((p) => !(team && team.findPlayer(p.name)));
  return pool
    .map((p) => ({ name: p.name, score: evaluatePlayer(p, strategy, team).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
};

const formatFa = (ranked, { position } = {}) => {
  const header = position ? `Top Free Agents — ${position}` : "Top Free Agents";
  return [header, "", ...ranked.map((r, i) => `${i + 1}. ${r.name} — ${r.score}`)].join("\n");
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const top = Number(opt("--top")) || 10;
  const position = opt("--position");

  const { freeAgents, strategy, team } = runAnalysis();
  const ranked = rankFreeAgents({ freeAgents, strategy, team }, { top, position });
  console.log(formatFa(ranked, { position }));
}

module.exports = { rankFreeAgents, formatFa };
