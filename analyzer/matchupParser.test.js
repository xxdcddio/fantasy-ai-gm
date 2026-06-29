const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { parseMatchup } = require("./matchupParser");

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "samples", "matchup.json"), "utf8")
);
const m = parseMatchup(fixture);

// Week + teams come from the extension's matchupHeader
assert.strictEqual(m.week, "Week 15");
assert.strictEqual(m.teams.mine.name, "棒球隊棒球隊");
assert.strictEqual(m.teams.mine.record, "101-89-6");
assert.strictEqual(m.teams.mine.gamesPlayed, 0);
assert.strictEqual(m.teams.mine.remainingGames, 113);
assert.strictEqual(m.teams.opponent.name, "台鋼雄鷹MLB分隊");
assert.strictEqual(m.teams.opponent.remainingGames, 114);

// Score parsed from the "0 vs 0" summary row
assert.deepStrictEqual(m.score, { mine: 0, opponent: 0 });

// 14 scoring categories (7 hitting + 7 pitching); non-scoring H/AB* and IP* dropped
assert.strictEqual(m.categories.length, 14);
assert.strictEqual(m.categories.filter((c) => c.type === "hitting").length, 7);
assert.strictEqual(m.categories.filter((c) => c.type === "pitching").length, 7);
assert.ok(!m.categories.some((c) => c.name.endsWith("*")));
assert.deepStrictEqual(
  m.categories.map((c) => c.name),
  ["R", "HR", "RBI", "SB", "BB", "AVG", "OPS", "W", "K", "ERA", "WHIP", "K/BB", "QS", "SV+H"]
);

// lowerIsBetter only on ERA / WHIP
const era = m.categories.find((c) => c.name === "ERA");
assert.strictEqual(era.type, "pitching");
assert.strictEqual(era.lowerIsBetter, true);
const hr = m.categories.find((c) => c.name === "HR");
assert.strictEqual(hr.type, "hitting");
assert.ok(!("lowerIsBetter" in hr));

// Week not started in this fixture: every value is null and nobody leads
assert.ok(m.categories.every((c) => c.mine === null && c.opponent === null && c.leader === "none"));

// --- leader logic on synthetic data with real numbers ---
const synth = {
  matchupHeader: { week: "Week 1", teams: { mine: { id: "5" }, opponent: { id: "1" } } },
  roster: [
    { name: "3 vs 2", cells: [{ text: "3" }, { text: "vs" }, { text: "2" }], links: [] },
    {
      name: "Team HR SB IP* ERA",
      cells: [{ text: "Team" }, { text: "HR" }, { text: "SB" }, { text: "IP*" }, { text: "ERA" }],
      links: []
    },
    {
      name: "A",
      cells: [{ text: "A" }, { text: "11" }, { text: "5" }, { text: "-" }, { text: "3.20" }],
      links: [{ href: "https://baseball.fantasysports.yahoo.com/b1/95435/5" }]
    },
    {
      name: "B",
      cells: [{ text: "B" }, { text: "12" }, { text: "5" }, { text: "-" }, { text: "4.50" }],
      links: [{ href: "https://baseball.fantasysports.yahoo.com/b1/95435/1" }]
    }
  ]
};
const s = parseMatchup(synth);
assert.deepStrictEqual(s.score, { mine: 3, opponent: 2 });

const sHR = s.categories.find((c) => c.name === "HR");
assert.strictEqual(sHR.type, "hitting");
assert.strictEqual(sHR.mine, 11);
assert.strictEqual(sHR.opponent, 12);
assert.strictEqual(sHR.leader, "opponent"); // higher wins

const sSB = s.categories.find((c) => c.name === "SB");
assert.strictEqual(sSB.leader, "tied"); // 5 vs 5

const sERA = s.categories.find((c) => c.name === "ERA");
assert.strictEqual(sERA.type, "pitching");
assert.strictEqual(sERA.lowerIsBetter, true);
assert.strictEqual(sERA.leader, "mine"); // 3.20 < 4.50, lower wins

assert.ok(!s.categories.some((c) => c.name === "IP*"));

console.log("matchupParser.test.js OK");
