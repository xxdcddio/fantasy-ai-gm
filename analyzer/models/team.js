const Player = require("./player");

const normalizeName = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

// Accepts either the parser's bucketed output ({ roster, bench, IL, pitchers })
// or a flat array of normalized players. Buckets are disjoint, so flattening
// them yields the full roster exactly once.
const flatten = (input) => {
  if (Array.isArray(input)) return input;
  const { roster = [], bench = [], IL = [], pitchers = [] } = input || {};
  return [...roster, ...bench, ...IL, ...pitchers];
};

class Team {
  constructor(input = {}) {
    this.players = flatten(input).map((p) => (p instanceof Player ? p : new Player(p)));
  }

  hitters() {
    return this.players.filter((p) => p.isHitter());
  }

  pitchers() {
    return this.players.filter((p) => p.isPitcher());
  }

  getBench() {
    return this.players.filter((p) => p.isBench());
  }

  getIL() {
    return this.players.filter((p) => p.isIL());
  }

  getByPosition(position) {
    return this.players.filter((p) => p.canPlay(position));
  }

  findPlayer(name) {
    const target = normalizeName(name);
    return this.players.find((p) => normalizeName(p.name) === target) || null;
  }

  toJSON() {
    return {
      hitters: this.hitters().map((p) => p.toJSON()),
      pitchers: this.pitchers().map((p) => p.toJSON()),
      bench: this.getBench().map((p) => p.toJSON()),
      IL: this.getIL().map((p) => p.toJSON())
    };
  }
}

module.exports = Team;
