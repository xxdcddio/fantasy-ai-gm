// Claude provider for the LLM Coach. Single source of the LLM call, behind a
// `(prompt) => Promise<string>` interface so the Coach never knows the source
// (same pattern as the Statcast provider). The real call is made only when
// invoked; the key is read from ANTHROPIC_API_KEY at call time, never stored
// in the repo.
//
// Uses raw HTTPS (Node 18+ global fetch) — no SDK dependency. Model defaults to
// Claude Opus 4.8 with adaptive thinking.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";

const createClaudeProvider = ({ apiKey, model = MODEL, maxTokens = 1024 } = {}) =>
  async ({ system, user }) => {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: user }]
      })
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);

    const data = await res.json();
    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
  };

module.exports = { createClaudeProvider, MODEL };
