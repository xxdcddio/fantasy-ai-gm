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

// Injury / availability tokens Yahoo glues onto the player name (e.g. "GelofIL10").
const STATUS_RE = /^(IL\d*|DTD|NA|DL\d*|SUSP|GTD|NRI|O|Q)/;
// A player's profile link (NOT the ".../news" note link).
const PROFILE_HREF_RE = /\/mlb\/players\/\d+$/;
// Game link text, e.g. "9:40 am @ ATH" / " 8:05 am vs SD".
const GAME_TEXT_RE = /^(\d{1,2}:\d{2}\s*[ap]m)\s+((?:@|vs)\s*[A-Z]{2,3})$/i;
// "TEAM - POS,POS,..." inside the player cell, e.g. "COL - 1B,2B,3B,SS,OF".
const TEAM_POS_RE = /\b([A-Z]{2,3})\s*-\s*([A-Z0-9]+(?:,[A-Z0-9]+)*)/;

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
};

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const links = (player) => toArray(player.links);

const profileLink = (player) =>
  links(player).find((link) => PROFILE_HREF_RE.test(link.href || ""));

const cellByClass = (player, name) =>
  toArray(player.cells).find((cell) => new RegExp(`\\b${name}\\b`).test(cell.className || ""));

const playerCellText = (player) =>
  clean(cellByClass(player, "player")?.text ?? toArray(player.cells)[2]?.text);

const inferSlot = (player) =>
  clean(cellByClass(player, "pos")?.text ?? player.slot ?? player.position ?? toArray(player.cells)[0]?.text).toUpperCase();

const inferGame = (player) => {
  const link = links(player).find((l) => GAME_TEXT_RE.test(clean(l.text)));
  const match = link && clean(link.text).match(GAME_TEXT_RE);
  return match ? { startTime: clean(match[1]), opponent: clean(match[2]) } : { startTime: "", opponent: "" };
};

const inferStatus = (cellText, name) => {
  const idx = cellText.indexOf(name);
  const rest = idx >= 0 ? cellText.slice(idx + name.length) : cellText;
  const match = rest.match(STATUS_RE);
  return match ? match[1] : "";
};

// A row is a player only if it has a profile link; this drops Yahoo's section
// headers, "Starting Lineup Totals", and the team-analysis summary rows.
const isPlayerRow = (player) => Boolean(profileLink(player));

const normalizePlayer = (player) => {
  const link = profileLink(player);
  const name = clean(link?.text);
  const cellText = playerCellText(player);
  const teamPos = cellText.match(TEAM_POS_RE);
  const { startTime, opponent } = inferGame(player);
  const newsLink = links(player).find((l) => /\/news$/.test(l.href || ""));

  return {
    ...EMPTY_PLAYER,
    name,
    mlbTeam: teamPos ? teamPos[1] : "",
    slot: inferSlot(player),
    eligiblePositions: teamPos ? teamPos[2].split(",").map((p) => p.toUpperCase()).filter(Boolean) : [],
    opponent,
    status: inferStatus(cellText, name),
    startTime,
    newsLink: newsLink?.href || "",
    playerLink: link?.href || ""
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

// Team page ("My Team" -> Stats -> 2026 Season) carries the same 7 batting
// categories as the free-agent list, in a different column layout: Pre-Season
// rank, Current rank, %Start, %Ros, then H/AB, R, HR, RBI, SB, BB, AVG, OPS.
// ponytail: pitcher rows share these column *positions* but the columns mean
// IP/W/K/ERA/WHIP/K-BB/QS/SV+H there, not batting stats -- stats stays {}
// for pitchers until a Move Evaluator use case needs pitching categories.
const normalizeRosterPlayer = (player) => {
  const base = normalizePlayer(player);
  const cells = toArray(player.cells);
  const cellIndex = playerCellIndex(player);
  const at = (offset) => clean(cells[cellIndex + offset]?.text);

  const isPitcher = base.eligiblePositions.some((position) => PITCHER_POSITIONS.has(position));

  return {
    ...base,
    preSeasonRank: toNum(at(2)),
    rank: toNum(at(3)),
    percentStart: toNum(at(4)),
    percentRostered: toNum(at(5)),
    stats: isPitcher
      ? {}
      : {
          hAb: at(6),
          R: toNum(at(7)),
          HR: toNum(at(8)),
          RBI: toNum(at(9)),
          SB: toNum(at(10)),
          BB: toNum(at(11)),
          AVG: toNum(at(12)),
          OPS: toNum(at(13))
        }
  };
};

const normalizeFantasyJson = (input) => {
  const normalized = {
    roster: [],
    bench: [],
    IL: [],
    pitchers: []
  };

  const players = toArray(input?.roster).filter(isPlayerRow).map(normalizeRosterPlayer);

  players.forEach((player) => {
    normalized[bucketForPlayer(player)].push(player);
  });

  return normalized;
};

// --- Free Agent (Player List page) ---------------------------------------
// FA rows carry season stats in fixed columns to the right of the player cell.
// Offsets are relative to the player cell, matching the "All Batters" tab.
// ponytail: batter-tab column layout; pitcher tab (W/K/ERA/...) is a separate map, add when needed.
const toNum = (value) => {
  const s = clean(value).replace(/%/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

const playerCellIndex = (player) => {
  const cells = toArray(player.cells);
  const i = cells.findIndex((cell) => /\bplayer\b/.test(cell.className || ""));
  return i >= 0 ? i : 2;
};

const normalizeFreeAgent = (player) => {
  const cells = toArray(player.cells);
  const base = playerCellIndex(player);
  const at = (offset) => clean(cells[base + offset]?.text);

  return {
    ...normalizePlayer(player),
    rosterStatus: at(2),
    gamesPlayed: toNum(at(3)),
    preSeasonRank: toNum(at(4)),
    rank: toNum(at(5)),
    percentRostered: toNum(at(6)),
    stats: {
      hAb: at(7),
      R: toNum(at(8)),
      HR: toNum(at(9)),
      RBI: toNum(at(10)),
      SB: toNum(at(11)),
      BB: toNum(at(12)),
      AVG: toNum(at(13)),
      OPS: toNum(at(14))
    }
  };
};

// The fixed extension puts FAs in `freeAgents`; old fixtures (misclassified
// pages) put them in `roster`. Prefer freeAgents, fall back to roster.
const normalizeFreeAgents = (input) =>
  toArray(input?.freeAgents?.length ? input.freeAgents : input?.roster)
    .filter(isPlayerRow)
    .map(normalizeFreeAgent);

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
  normalizeFreeAgents,
  parseFantasyJson
};
