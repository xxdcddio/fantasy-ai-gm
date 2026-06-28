const fs = require("fs");

const EMPTY_PLAYER = {
  name: "",
  mlbTeam: "",
  slot: "",
  eligiblePositions: [],
  opponent: "",
  status: "",
  startTime: "",
  newsLink: "",
  playerLink: ""
};

const SLOT_ALIASES = {
  BN: "bench",
  BENCH: "bench",
  IL: "IL",
  IL10: "IL",
  IL15: "IL",
  IL60: "IL",
  NA: "IL"
};

const PITCHER_POSITIONS = new Set(["P", "SP", "RP"]);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
};

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const firstNonEmpty = (...values) => values.map(clean).find(Boolean) || "";

const splitPositions = (value) =>
  toArray(value)
    .flatMap((entry) => clean(entry).split(/[,/| ]+/))
    .map((entry) => entry.toUpperCase())
    .filter(Boolean);

const linkByPattern = (player, pattern) => {
  const links = toArray(player.links);
  const found = links.find((link) => pattern.test(`${link.href || ""} ${link.text || ""}`));
  return found?.href || "";
};

const cellText = (player, index) => clean(toArray(player.cells)[index]?.text);

const inferSlot = (player) =>
  firstNonEmpty(
    player.slot,
    player.rosterSlot,
    player.lineupSlot,
    player.position,
    cellText(player, 0)
  ).toUpperCase();

const inferMlbTeam = (player) =>
  firstNonEmpty(
    player.mlbTeam,
    player.team,
    player.proTeam,
    player.editorialTeamAbbr,
    cellText(player, 2)
  );

const inferEligiblePositions = (player, slot) => {
  const positions = splitPositions(
    firstNonEmpty(
      player.eligiblePositions,
      player.eligiblePosition,
      player.positions,
      player.positionType,
      player.position
    )
  );

  return Array.from(new Set([...positions, ...splitPositions(slot)])).filter(
    (position) => !["BN", "BENCH", "IL", "IL10", "IL15", "IL60", "NA"].includes(position)
  );
};

const normalizePlayer = (player) => {
  const slot = inferSlot(player);
  const eligiblePositions = inferEligiblePositions(player, slot);

  return {
    ...EMPTY_PLAYER,
    name: firstNonEmpty(player.name, player.playerName, cellText(player, 1)),
    mlbTeam: inferMlbTeam(player),
    slot,
    eligiblePositions,
    opponent: firstNonEmpty(player.opponent, player.opp, player.matchup, cellText(player, 3)),
    status: firstNonEmpty(player.status, player.playerStatus, player.injuryStatus),
    startTime: firstNonEmpty(player.startTime, player.gameTime, player.time),
    newsLink: firstNonEmpty(player.newsLink, linkByPattern(player, /news|playernote|note/i)),
    playerLink: firstNonEmpty(player.playerLink, linkByPattern(player, /\/player\/|players\?/i))
  };
};

const bucketForPlayer = (player) => {
  const slot = player.slot.toUpperCase();
  const status = player.status.toUpperCase();
  const alias = SLOT_ALIASES[slot] || SLOT_ALIASES[status];

  if (alias) return alias;
  if (player.eligiblePositions.some((position) => PITCHER_POSITIONS.has(position))) return "pitchers";
  return "roster";
};

const normalizeFantasyJson = (input) => {
  const normalized = {
    roster: [],
    bench: [],
    IL: [],
    pitchers: []
  };

  const players = toArray(input?.roster).map(normalizePlayer).filter((player) => player.name);

  players.forEach((player) => {
    normalized[bucketForPlayer(player)].push(player);
  });

  return normalized;
};

const parseFantasyJson = (jsonText) => normalizeFantasyJson(JSON.parse(jsonText));

if (require.main === module) {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Usage: node analyzer/parser.js <extension-output.json>");
    process.exit(1);
  }

  const jsonText = fs.readFileSync(inputPath, "utf8");
  process.stdout.write(`${JSON.stringify(parseFantasyJson(jsonText), null, 2)}\n`);
}

module.exports = {
  normalizeFantasyJson,
  normalizePlayer,
  parseFantasyJson
};
