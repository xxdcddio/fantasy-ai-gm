const PITCHER_POSITIONS = new Set(["P", "SP", "RP"]);
const BENCH_SLOTS = new Set(["BN", "BENCH"]);
const IL_SLOTS = new Set(["IL", "IL10", "IL15", "IL60", "NA"]);

const clean = (value) => String(value ?? "").trim();

const normalizePosition = (position) => clean(position).toUpperCase();

class Player {
  constructor(normalizedPlayer = {}) {
    this.name = clean(normalizedPlayer.name);
    this.mlbTeam = clean(normalizedPlayer.mlbTeam);
    this.slot = normalizePosition(normalizedPlayer.slot);
    this.eligiblePositions = Array.isArray(normalizedPlayer.eligiblePositions)
      ? normalizedPlayer.eligiblePositions.map(normalizePosition).filter(Boolean)
      : [];
    this.opponent = clean(normalizedPlayer.opponent);
    this.gameTime = clean(normalizedPlayer.gameTime || normalizedPlayer.startTime);
    this.status = clean(normalizedPlayer.status);
    this.newsLink = clean(normalizedPlayer.newsLink);
    this.playerLink = clean(normalizedPlayer.playerLink);
  }

  isPitcher() {
    return this.eligiblePositions.some((position) => PITCHER_POSITIONS.has(position));
  }

  isHitter() {
    return !this.isPitcher();
  }

  isBench() {
    return BENCH_SLOTS.has(this.slot);
  }

  isIL() {
    return IL_SLOTS.has(this.slot) || IL_SLOTS.has(normalizePosition(this.status));
  }

  canPlay(position) {
    return this.eligiblePositions.includes(normalizePosition(position));
  }

  toJSON() {
    return {
      name: this.name,
      mlbTeam: this.mlbTeam,
      slot: this.slot,
      eligiblePositions: [...this.eligiblePositions],
      opponent: this.opponent,
      gameTime: this.gameTime,
      status: this.status,
      newsLink: this.newsLink,
      playerLink: this.playerLink
    };
  }
}

module.exports = Player;
