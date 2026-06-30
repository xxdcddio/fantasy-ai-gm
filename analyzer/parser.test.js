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
  "playerLink"
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
assert.strictEqual(allPlayers.length, 27);
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
assert.strictEqual(normalized.IL.length, 4);
assert.strictEqual(normalized.pitchers.length, 8);

// Multi-position hitter: team + all eligible positions from "TEAM - p,p,p"
const castro = byName("Willi Castro");
assert.ok(castro, "Willi Castro parsed");
assert.strictEqual(castro.mlbTeam, "COL");
assert.strictEqual(castro.slot, "3B");
assert.deepStrictEqual(castro.eligiblePositions, ["1B", "2B", "3B", "SS", "OF"]);

// Injury token glued into the name string
const ramirez = byName("José Ramírez");
assert.ok(ramirez, "José Ramírez parsed");
assert.strictEqual(ramirez.slot, "IL");
assert.strictEqual(ramirez.status, "IL10");
assert.strictEqual(ramirez.mlbTeam, "CLE");
assert.deepStrictEqual(ramirez.eligiblePositions, ["3B"]);

const cag = byName("Jac Caglianone");
assert.ok(cag, "Jac Caglianone parsed");
assert.strictEqual(cag.slot, "BN");
assert.strictEqual(cag.status, "DTD");
assert.strictEqual(cag.mlbTeam, "KC");
assert.deepStrictEqual(cag.eligiblePositions, ["1B", "OF"]);

// Pitcher with game info parsed from the game link (now on the bench)
const rodon = byName("Carlos Rodón");
assert.ok(rodon, "Carlos Rodón parsed");
assert.strictEqual(rodon.slot, "BN");
assert.strictEqual(rodon.mlbTeam, "NYY");
assert.deepStrictEqual(rodon.eligiblePositions, ["SP"]);
assert.strictEqual(rodon.startTime, "7:05 am");
assert.strictEqual(rodon.opponent, "vs DET");

// Player with no game today: no game link -> empty time/opponent
const harris = byName("Michael Harris II");
assert.ok(harris, "Michael Harris II parsed");
assert.strictEqual(harris.startTime, "");
assert.strictEqual(harris.opponent, "");
assert.strictEqual(harris.mlbTeam, "ATL");

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
