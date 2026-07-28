const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { normalizeFantasyJson } = require("./parser");

const teamPath = path.join(__dirname, "..", "data", "samples", "team.json");
const team = JSON.parse(fs.readFileSync(teamPath, "utf8"));
const normalized = normalizeFantasyJson(team);

const expectedKeys = [
  "name",
  "mlbTeam",
  "slot",
  "eligiblePositions",
  "opponent",
  "status",
  "startTime",
  "newsLink",
  "playerLink",
  "preSeasonRank",
  "rank",
  "percentStart",
  "percentRostered",
  "stats"
];

const allPlayers = [
  ...normalized.roster,
  ...normalized.bench,
  ...normalized.IL,
  ...normalized.pitchers
];

const byName = (name) => allPlayers.find((p) => p.name === name);

// Output shape
assert.deepStrictEqual(Object.keys(normalized), ["roster", "bench", "IL", "pitchers"]);

// Junk rows (Rank Fantasy Batting/Pitching, Starting Lineup Totals, Team analysis,
// team summary) must be dropped — only rows with a real player profile link survive.
assert.strictEqual(allPlayers.length, 26);
allPlayers.forEach((player) => {
  assert.deepStrictEqual(Object.keys(player), expectedKeys);
  assert.ok(player.name, "player has a name");
  assert.ok(!/Player Note|Rank Fantasy|Starting Lineup|Team analysis/.test(player.name),
    `name is clean: ${player.name}`);
  assert.ok(player.playerLink, `playerLink present: ${player.name}`);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(player, "raw"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(player, "cells"), false);
});

// Bucketing
assert.strictEqual(normalized.roster.length, 10);
assert.strictEqual(normalized.bench.length, 5);
assert.strictEqual(normalized.IL.length, 3);
assert.strictEqual(normalized.pitchers.length, 8);

// Multi-position hitter: team + all eligible positions from "TEAM - p,p,p"
const gonzales = byName("Nick Gonzales");
assert.ok(gonzales, "Nick Gonzales parsed");
assert.strictEqual(gonzales.mlbTeam, "PIT");
assert.strictEqual(gonzales.slot, "UTIL");
assert.deepStrictEqual(gonzales.eligiblePositions, ["2B", "3B", "SS"]);

// Season stats: same 7 batting categories as the free-agent list, read from
// the Team page's "2026 Season" column layout (Pre-Season/Current rank,
// %Start/%Ros, then H/AB, R, HR, RBI, SB, BB, AVG, OPS).
assert.strictEqual(gonzales.preSeasonRank, 312);
assert.strictEqual(gonzales.rank, 122);
assert.strictEqual(gonzales.percentStart, 45);
assert.strictEqual(gonzales.percentRostered, 50);
assert.deepStrictEqual(gonzales.stats, {
  hAb: "120/381",
  R: 58,
  HR: 6,
  RBI: 47,
  SB: 4,
  BB: 28,
  AVG: 0.315,
  OPS: 0.782
});

// Pitcher rows share the same column positions, but those columns are
// pitching stats there (IP/W/K/...) -- stats is deliberately {} for now.
const imanaga = byName("Shota Imanaga");
assert.ok(imanaga, "Shota Imanaga parsed");
assert.deepStrictEqual(imanaga.stats, {});
assert.strictEqual(imanaga.rank, 87);

// Injury token glued into the name string
const seager = byName("Corey Seager");
assert.ok(seager, "Corey Seager parsed");
assert.strictEqual(seager.slot, "IL");
assert.strictEqual(seager.status, "IL10");
assert.strictEqual(seager.mlbTeam, "TEX");
assert.deepStrictEqual(seager.eligiblePositions, ["SS"]);

const mead = byName("Curtis Mead");
assert.ok(mead, "Curtis Mead parsed");
assert.strictEqual(mead.slot, "BN");
assert.strictEqual(mead.status, "DTD");
assert.strictEqual(mead.mlbTeam, "BOS");
assert.deepStrictEqual(mead.eligiblePositions, ["1B", "2B", "3B"]);

// Pitcher with game info parsed from the game link (now on the bench)
const mcclean = byName("Nolan McLean");
assert.ok(mcclean, "Nolan McLean parsed");
assert.strictEqual(mcclean.slot, "BN");
assert.strictEqual(mcclean.mlbTeam, "NYM");
assert.deepStrictEqual(mcclean.eligiblePositions, ["SP"]);
assert.strictEqual(mcclean.startTime, "7:10 am");
assert.strictEqual(mcclean.opponent, "vs ATL");

// Player with no game today: no game link -> empty time/opponent (synthetic;
// every rostered player in the current fixture has a game scheduled)
const { normalizePlayer } = require("./parser");
const noGame = normalizePlayer({
  cells: [{ className: "player", text: "No Game Player NYY - OF" }],
  links: [{ href: "https://sports.yahoo.com/mlb/players/1", text: "No Game Player" }]
});
assert.strictEqual(noGame.startTime, "");
assert.strictEqual(noGame.opponent, "");

// Sprint 15.2 — Free Agent hardening: non-player sidebar rows (Trade suggestions,
// Research Assistant, Compare) carry no profile link, so they never become FAs.
const { normalizeFreeAgents } = require("./parser");
const junk = normalizeFreeAgents({
  freeAgents: [
    { cells: [{ className: "player", text: "Trade suggestions" }], links: [] },
    { cells: [{ className: "player", text: "Research Assistant" }], links: [] },
    { cells: [{ className: "player", text: "Compare" }], links: [] },
    {
      cells: [{ className: "Alt Ta-start player", text: "Real Player WSH - 1B" }],
      links: [{ href: "https://sports.yahoo.com/mlb/players/999", text: "Real Player" }]
    }
  ]
});
assert.strictEqual(junk.length, 1, "only the row with a real profile link survives");
assert.strictEqual(junk[0].name, "Real Player");

console.log("parser.test.js OK");
