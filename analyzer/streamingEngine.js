// Rank free agents by internal Streaming Score (NOT Yahoo rank). Thin layer
// over the shared evaluator: score every FA, sort, format. Deterministic, no AI.
//
// Sprint 9 only ranks ADD candidates; drop/swap decisions come in Sprint 10.

const { evaluatePlayer } = require("./evaluator");

const playersOf = (freeAgents) =>
  Array.isArray(freeAgents) ? freeAgents : freeAgents?.players || [];

const recommend = (freeAgents, strategy, team) => {
  const recommendations = playersOf(freeAgents)
    .map((player) => ({
      player: player.name,
      action: "add",
      ...evaluatePlayer(player, strategy, team)
    }))
    // Highest score first; name break keeps the order stable.
    .sort((a, b) => b.score - a.score || a.player.localeCompare(b.player));

  return { recommendations };
};

module.exports = { recommend };
