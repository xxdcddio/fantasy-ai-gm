const Player = require("./player");

const normalizeName = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

// A free agent is a Player plus the season stats / roster metadata Yahoo shows
// on the Player List page.
class FreeAgent extends Player {
  constructor(normalized = {}) {
    super(normalized);
    this.rosterStatus = String(normalized.rosterStatus ?? "").trim();
    this.gamesPlayed = normalized.gamesPlayed ?? null;
  }
}

class FreeAgentList {
  constructor(items = []) {
    this.players = (Array.isArray(items) ? items : []).map((item) =>
      item instanceof FreeAgent ? item : new FreeAgent(item)
    );
  }

  find(name) {
    const target = normalizeName(name);
    return this.players.find((p) => normalizeName(p.name) === target) || null;
  }

  findByPosition(position) {
    return this.players.filter((p) => p.canPlay(position));
  }

  // Best = lowest Yahoo current rank. Unranked players sort last.
  bestAvailable(limit = 10) {
    return [...this.players]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .slice(0, limit);
  }
}

module.exports = { FreeAgent, FreeAgentList };
