const assert = require("assert");

const Player = require("./player");

const hitter = new Player({
  name: "Aaron Judge",
  mlbTeam: "NYY",
  slot: "OF",
  eligiblePositions: ["OF", "UTIL"],
  opponent: "vs BOS",
  startTime: "7:05 PM",
  status: "Healthy",
  newsLink: "https://sports.yahoo.com/mlb/players/10001/news",
  playerLink: "https://baseball.fantasysports.yahoo.com/b1/player/10001"
});

assert.strictEqual(hitter.name, "Aaron Judge");
assert.strictEqual(hitter.mlbTeam, "NYY");
assert.strictEqual(hitter.slot, "OF");
assert.deepStrictEqual(hitter.eligiblePositions, ["OF", "UTIL"]);
assert.strictEqual(hitter.opponent, "vs BOS");
assert.strictEqual(hitter.gameTime, "7:05 PM");
assert.strictEqual(hitter.status, "Healthy");
assert.strictEqual(hitter.newsLink, "https://sports.yahoo.com/mlb/players/10001/news");
assert.strictEqual(hitter.playerLink, "https://baseball.fantasysports.yahoo.com/b1/player/10001");
assert.strictEqual(hitter.isPitcher(), false);
assert.strictEqual(hitter.isHitter(), true);
assert.strictEqual(hitter.isBench(), false);
assert.strictEqual(hitter.isIL(), false);
assert.strictEqual(hitter.canPlay("OF"), true);
assert.strictEqual(hitter.canPlay("SP"), false);

const pitcher = new Player({
  name: "Gerrit Cole",
  mlbTeam: "NYY",
  slot: "SP",
  eligiblePositions: ["SP"],
  opponent: "vs BOS",
  gameTime: "7:05 PM",
  status: "Healthy",
  newsLink: "",
  playerLink: "https://baseball.fantasysports.yahoo.com/b1/player/10003"
});

assert.strictEqual(pitcher.isPitcher(), true);
assert.strictEqual(pitcher.isHitter(), false);
assert.strictEqual(pitcher.canPlay("sp"), true);

const benchPlayer = new Player({
  name: "Shohei Ohtani",
  mlbTeam: "LAD",
  slot: "BN",
  eligiblePositions: ["UTIL"]
});

assert.strictEqual(benchPlayer.isBench(), true);
assert.strictEqual(benchPlayer.isIL(), false);

const injuredPlayer = new Player({
  name: "Mike Trout",
  mlbTeam: "LAA",
  slot: "IL",
  eligiblePositions: ["OF"],
  status: "IL"
});

assert.strictEqual(injuredPlayer.isIL(), true);
assert.strictEqual(injuredPlayer.isBench(), false);

assert.deepStrictEqual(hitter.toJSON(), {
  name: "Aaron Judge",
  mlbTeam: "NYY",
  slot: "OF",
  eligiblePositions: ["OF", "UTIL"],
  opponent: "vs BOS",
  gameTime: "7:05 PM",
  status: "Healthy",
  newsLink: "https://sports.yahoo.com/mlb/players/10001/news",
  playerLink: "https://baseball.fantasysports.yahoo.com/b1/player/10001"
});
