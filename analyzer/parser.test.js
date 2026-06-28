const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { normalizeFantasyJson } = require("./parser");

const samplePath = path.join(__dirname, "..", "data", "samples", "sample.json");
const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));
const normalized = normalizeFantasyJson(sample);

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

assert.deepStrictEqual(Object.keys(normalized), ["roster", "bench", "IL", "pitchers"]);
assert.strictEqual(normalized.roster.length, 1);
assert.strictEqual(normalized.bench.length, 1);
assert.strictEqual(normalized.IL.length, 1);
assert.strictEqual(normalized.pitchers.length, 1);

const allPlayers = [
  ...normalized.roster,
  ...normalized.bench,
  ...normalized.IL,
  ...normalized.pitchers
];

allPlayers.forEach((player) => {
  assert.deepStrictEqual(Object.keys(player), expectedKeys);
  assert.ok(player.name);
  assert.ok(Array.isArray(player.eligiblePositions));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(player, "raw"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(player, "cells"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(player, "className"), false);
});

assert.strictEqual(normalized.roster[0].name, "Aaron Judge");
assert.strictEqual(normalized.bench[0].slot, "BN");
assert.strictEqual(normalized.IL[0].status, "IL");
assert.strictEqual(normalized.pitchers[0].eligiblePositions[0], "SP");
