// LLM Coach — a presentation layer over the deterministic GM engine.
// It explains / compares / answers "why" about the engine's output. It never
// participates in the decision: the prompt is built only from the engine's
// own report + moves, and the system instruction forbids changing them.
//
//   buildCoachPrompt({ report, moves, question }) -> { system, user }  (pure)
//   askCoach({ report, moves, question, provider }) -> Promise<string>
//
// `provider(prompt)` is an async fn returning the answer text. Defaults to the
// real Claude provider (reads ANTHROPIC_API_KEY at call time); tests inject a
// fake. No network unless a real call is actually made.

const { createProvider } = require("./providers");

const SYSTEM =
  "You are the presentation layer for a deterministic Fantasy Baseball GM engine. " +
  "Explain, compare, and answer 'why' about the engine's recommendations in plain language. " +
  "Use ONLY the engine output provided below. You never make, change, override, or invent " +
  "a recommendation — the deterministic engine already decided. If asked to decide something " +
  "the data does not cover, say the engine does not provide it.";

const buildCoachPrompt = ({ report, moves, question } = {}) => ({
  system: SYSTEM,
  user:
    `ENGINE OUTPUT:\n${JSON.stringify({ report, moves: moves || [] }, null, 2)}\n\n` +
    `QUESTION: ${question || ""}`
});

const askCoach = ({ report, moves, question, provider } = {}) => {
  const call = provider || createProvider();
  return Promise.resolve(call(buildCoachPrompt({ report, moves, question })));
};

// P8 — proactive briefing: same grounding/guardrails as the Q&A coach, but no
// question is asked. Summarizes the matchup, top recommendation, and why —
// for showing unprompted (e.g. a daily digest) instead of answering "why".
const BRIEFING_SYSTEM =
  "You are the presentation layer for a deterministic Fantasy Baseball GM engine. " +
  "Write a short, proactive briefing of this week's outlook and top recommendation in plain language, " +
  "as if summarizing it for the manager unprompted -- do not phrase it as answering a question. " +
  "Use ONLY the engine output provided below. You never make, change, override, or invent " +
  "a recommendation -- the deterministic engine already decided. If asked to decide something " +
  "the data does not cover, say the engine does not provide it.";

const buildBriefingPrompt = ({ report, moves } = {}) => ({
  system: BRIEFING_SYSTEM,
  user: `ENGINE OUTPUT:\n${JSON.stringify({ report, moves: moves || [] }, null, 2)}`
});

const askBriefing = ({ report, moves, provider } = {}) => {
  const call = provider || createProvider();
  return Promise.resolve(call(buildBriefingPrompt({ report, moves })));
};

module.exports = { buildCoachPrompt, askCoach, buildBriefingPrompt, askBriefing, SYSTEM, BRIEFING_SYSTEM };
