const assert = require("assert");
const { bandFor, MAX_SCORE } = require("./waiverBands");

assert.strictEqual(MAX_SCORE, 120);

// Score-only (no confidence): thresholds at 50/30/15% of MAX_SCORE
assert.strictEqual(bandFor({ score: 65 }).key, "add_now");
assert.strictEqual(bandFor({ score: 40 }).key, "watch");
assert.strictEqual(bandFor({ score: 20 }).key, "hold");
assert.strictEqual(bandFor({ score: 5 }).key, "ignore");

// Boundaries: exact cutoff still qualifies for that band
assert.strictEqual(bandFor({ score: 60 }).key, "add_now");
assert.strictEqual(bandFor({ score: 36 }).key, "watch");
assert.strictEqual(bandFor({ score: 18 }).key, "hold");
assert.strictEqual(bandFor({ score: 0 }).key, "ignore");

// Confidence present: gate can only downgrade, never upgrade
assert.strictEqual(bandFor({ score: 65, confidence: 0.9 }).key, "add_now");
assert.strictEqual(bandFor({ score: 65, confidence: 0.5 }).key, "hold"); // fails both add_now and watch gates
assert.strictEqual(bandFor({ score: 40, confidence: 0.65 }).key, "watch"); // meets watch's 0.6 gate
assert.strictEqual(bandFor({ score: 40, confidence: 0.3 }).key, "hold"); // fails watch's gate

// Shape
const b = bandFor({ score: 65 });
assert.deepStrictEqual(Object.keys(b).sort(), ["emoji", "key", "label"]);
assert.strictEqual(b.emoji, "🔥");
assert.strictEqual(b.label, "Add Now");

// Deterministic
assert.deepStrictEqual(bandFor({ score: 40, confidence: 0.65 }), bandFor({ score: 40, confidence: 0.65 }));

console.log("waiverBands.test.js OK");
