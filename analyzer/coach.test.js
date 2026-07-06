const assert = require("assert");

const { buildCoachPrompt, askCoach, buildBriefingPrompt, askBriefing } = require("./coach");
const { createClaudeProvider } = require("./providers/llm");

// Deterministic engine output the Coach explains (never re-derives).
const report = {
  summary: { week: "Week 15", opponent: "台鋼雄鷹MLB分隊", currentScore: "0-0" },
  categoryOutlook: { attack: ["HR", "RBI", "OPS"], protect: ["ERA", "WHIP"], ignore: ["SB"] },
  rosterAnalysis: { weakPositions: ["C", "3B"] }
};
const moves = [
  { add: "Isaac Paredes", drop: "Brooks Lee", confidence: 0.75, scoreGain: 12, categoryImpact: "+HR/+RBI" }
];

// --- buildCoachPrompt: deterministic, grounded only in engine output ---
const p = buildCoachPrompt({ report, moves, question: "Why add Isaac Paredes?" });
assert.deepStrictEqual(p, buildCoachPrompt({ report, moves, question: "Why add Isaac Paredes?" }));
assert.ok("system" in p && "user" in p);

// Guardrail: explains, never decides.
assert.ok(/explain/i.test(p.system));
assert.ok(/never|not/i.test(p.system) && /decid|decision|change|override|invent/i.test(p.system));

// Grounded: the prompt carries the engine's data + the question, and nothing invented.
assert.ok(p.user.includes("Isaac Paredes"));
assert.ok(p.user.includes("Brooks Lee"));
assert.ok(p.user.includes("Week 15"));
assert.ok(p.user.includes("Why add Isaac Paredes?"));
assert.ok(!/Mike Trout|Shohei/.test(p.user)); // no fabricated players

// --- askCoach: calls the injected provider once with the built prompt ---
(async () => {
  const calls = [];
  const fake = async (prompt) => { calls.push(prompt); return "He fills weak 3B and adds HR/RBI."; };

  const answer = await askCoach({ report, moves, question: "Why add Isaac Paredes?", provider: fake });
  assert.strictEqual(answer, "He fills weak 3B and adds HR/RBI.");
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0], buildCoachPrompt({ report, moves, question: "Why add Isaac Paredes?" }));

  // --- Claude provider: real call deferred to runtime; no key => clear error, no network ---
  const provider = createClaudeProvider({ apiKey: "" });
  assert.strictEqual(typeof provider, "function");
  await assert.rejects(() => provider({ system: "s", user: "u" }), /ANTHROPIC_API_KEY/);

  // --- P8: proactive briefing (no question) — same grounding rules, different framing ---
  const b = buildBriefingPrompt({ report, moves });
  assert.deepStrictEqual(b, buildBriefingPrompt({ report, moves })); // deterministic
  assert.ok("system" in b && "user" in b);
  assert.ok(/never|not/i.test(b.system) && /decid|decision|change|override|invent/i.test(b.system));
  assert.ok(b.user.includes("Isaac Paredes"));
  assert.ok(b.user.includes("Week 15"));
  assert.ok(!/Mike Trout|Shohei/.test(b.user)); // no fabricated players
  assert.ok(!/QUESTION:/.test(b.user)); // proactive, not Q&A framed

  const briefingCalls = [];
  const fakeBriefing = async (prompt) => { briefingCalls.push(prompt); return "This week: attack HR/RBI, add Isaac Paredes."; };
  const briefing = await askBriefing({ report, moves, provider: fakeBriefing });
  assert.strictEqual(briefing, "This week: attack HR/RBI, add Isaac Paredes.");
  assert.strictEqual(briefingCalls.length, 1);
  assert.deepStrictEqual(briefingCalls[0], buildBriefingPrompt({ report, moves }));

  console.log("coach.test.js OK");
})();
