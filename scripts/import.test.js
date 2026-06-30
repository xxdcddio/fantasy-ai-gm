// Sprint 13.8 — Import CLI. Moves the three extension downloads into data/.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { importFiles, formatImport, FILES } = require("./import");

const mkdtemp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

// moves present files, reports missing ones
const from = mkdtemp("from-");
const to = mkdtemp("to-");
fs.writeFileSync(path.join(from, "team.json"), "T");
fs.writeFileSync(path.join(from, "free-agents.json"), "F");
// matchup.json intentionally absent

const results = importFiles({ from, to });

assert.deepStrictEqual(
  results.map((r) => [r.name, r.ok]),
  [["team.json", true], ["matchup.json", false], ["free-agents.json", true]]
);
// moved, not copied: source gone, dest present with same content
assert.ok(!fs.existsSync(path.join(from, "team.json")), "source removed");
assert.strictEqual(fs.readFileSync(path.join(to, "team.json"), "utf8"), "T");
assert.strictEqual(fs.readFileSync(path.join(to, "free-agents.json"), "utf8"), "F");
assert.ok(!fs.existsSync(path.join(to, "matchup.json")), "missing not created");

// creates dest dir if absent
const from2 = mkdtemp("from2-");
const to2 = path.join(mkdtemp("to2-"), "nested", "data");
fs.writeFileSync(path.join(from2, "matchup.json"), "M");
importFiles({ from: from2, to: to2 });
assert.strictEqual(fs.readFileSync(path.join(to2, "matchup.json"), "utf8"), "M");

// the canonical three files, in order
assert.deepStrictEqual(FILES, ["team.json", "matchup.json", "free-agents.json"]);

// render: header + a line per file
const text = formatImport(results);
assert.ok(text.includes("Import complete"));
assert.ok(text.includes("✓ team.json"));
assert.ok(text.includes("✓ free-agents.json"));
assert.ok(/✗ matchup\.json/.test(text), "missing marked with ✗");

console.log("import.test.js OK");
