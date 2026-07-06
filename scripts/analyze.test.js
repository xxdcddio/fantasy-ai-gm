const assert = require("assert");
const { execFileSync } = require("child_process");
const path = require("path");

const { runAnalysis, formatAnalysis } = require("./analyze");

// Reads the real fixtures and runs the whole pipeline without throwing.
const out = runAnalysis();

// Weekly Report was produced and is grounded in the matchup fixture.
assert.ok(out.report, "report missing");
assert.strictEqual(out.report.summary.week, "Week 15");
assert.strictEqual(out.report.summary.opponent, "台鋼雄鷹MLB分隊");

// Strategy buckets exist (a not-yet-started week is legitimately all-ignore);
// streaming + a recommendation have content.
assert.ok(out.strategy && Array.isArray(out.strategy.attack) && Array.isArray(out.strategy.ignore));
assert.ok(out.streaming.length > 0);
assert.ok(out.report.recommendations.length > 0);
const top = out.report.recommendations[0];
assert.ok(typeof top.add === "string" && top.add);
assert.ok(typeof top.drop === "string" && top.drop);

// Console formatter is a string with the headline info.
const text = formatAnalysis(out);
assert.strictEqual(typeof text, "string");
assert.ok(text.includes("Fantasy AI GM") && text.includes("Week 15"));
assert.ok(text.includes("Top 5 Streaming") && text.includes("Finished"));
// P6: waiver band shown for the top recommendation
assert.ok(text.includes(top.waiverBand.emoji) && text.includes(top.waiverBand.label));

// Running the script end-to-end exits 0 (execFileSync throws on non-zero).
const stdout = execFileSync("node", [path.join(__dirname, "analyze.js")], { encoding: "utf8" });
assert.ok(stdout.includes("Finished"));

console.log("analyze.test.js OK");
