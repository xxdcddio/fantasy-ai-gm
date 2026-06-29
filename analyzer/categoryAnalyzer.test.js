const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { analyzeCategories } = require("./categoryAnalyzer");
const { parseMatchup } = require("./matchupParser");

// --- real Week 15 fixture: values not in yet -> everything unknown ---
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "samples", "matchup.json"), "utf8")
);
const real = analyzeCategories(parseMatchup(fixture));

assert.strictEqual(real.categories.length, 14);
assert.ok(real.categories.every((c) => c.status === "unknown" && c.priority === "ignore"));
assert.deepStrictEqual(real.strategy.attack, []);
assert.deepStrictEqual(real.strategy.protect, []);
assert.strictEqual(real.strategy.ignore.length, 14);

// --- synthetic matchup with real category values ---
const synth = {
  categories: [
    { name: "R", type: "hitting", mine: 5, opponent: 5 }, // tied -> high attack
    { name: "HR", type: "hitting", mine: 11, opponent: 12 }, // behind by 1 -> high attack
    { name: "SB", type: "hitting", mine: 10, opponent: 2 }, // safely ahead -> low / ignore
    { name: "ERA", type: "pitching", mine: 3.2, opponent: 3.4, lowerIsBetter: true }, // close ahead -> protect
    { name: "WHIP", type: "pitching", mine: 1.3, opponent: 1.2, lowerIsBetter: true } // behind -> high attack
  ]
};
const a = analyzeCategories(synth);
const cat = (n) => a.categories.find((c) => c.name === n);

// HR: behind by 1, close -> high / attack
assert.strictEqual(cat("HR").status, "behind");
assert.strictEqual(cat("HR").margin, -1);
assert.strictEqual(cat("HR").priority, "high");
assert.strictEqual(cat("HR").lowerIsBetter, false);

// R: tied -> high / attack
assert.strictEqual(cat("R").status, "tied");
assert.strictEqual(cat("R").priority, "high");

// SB: safely ahead -> low, ignored
assert.strictEqual(cat("SB").status, "ahead");
assert.strictEqual(cat("SB").priority, "low");

// ERA: ahead by small margin (lower is better) -> medium / protect
assert.strictEqual(cat("ERA").status, "ahead");
assert.strictEqual(cat("ERA").priority, "medium");
assert.strictEqual(cat("ERA").lowerIsBetter, true);
assert.strictEqual(cat("ERA").margin, -0.2); // 3.2 - 3.4, rounded

// WHIP: behind (lower is better) -> high / attack
assert.strictEqual(cat("WHIP").status, "behind");
assert.strictEqual(cat("WHIP").priority, "high");

// strategy buckets
assert.deepStrictEqual(a.strategy.attack, ["R", "HR", "WHIP"]);
assert.deepStrictEqual(a.strategy.protect, ["ERA"]);
assert.deepStrictEqual(a.strategy.ignore, ["SB"]);

// every category lands in exactly one bucket
const total =
  a.strategy.attack.length + a.strategy.protect.length + a.strategy.ignore.length;
assert.strictEqual(total, a.categories.length);

// notes is an array; stable (deterministic) output
assert.ok(Array.isArray(a.notes));
assert.strictEqual(JSON.stringify(analyzeCategories(synth)), JSON.stringify(analyzeCategories(synth)));

console.log("categoryAnalyzer.test.js OK");
