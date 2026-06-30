// KK LLM Gateway provider for the Coach. Same (prompt)->Promise<string>
// interface as the Claude provider, so the Coach is unchanged. Calls the
// company gateway's Responses API; key read from KK_LLM_API_KEY at call time,
// never stored. fetchImpl is injectable for tests (defaults to global fetch).

const DEFAULT_PATH = "/v1/responses";

// The gateway may answer in any of three shapes; accept whichever is present.
const extractText = (data) => {
  if (typeof data.output_text === "string") return data.output_text; // Responses API
  const fromOutput = (data.output || [])
    .flatMap((o) => o.content || [])
    .map((c) => c.text)
    .filter(Boolean)
    .join(""); // Responses content blocks
  if (fromOutput) return fromOutput;
  const fromChoices = (data.choices || [])
    .map((c) => c.message && c.message.content)
    .filter(Boolean)
    .join(""); // Chat Completions
  if (fromChoices) return fromChoices;
  throw new Error("KK Gateway: unrecognized response format");
};

const createKKGatewayProvider = ({ apiKey, baseUrl, model, fetchImpl } = {}) =>
  async ({ system, user }) => {
    const key = apiKey || process.env.KK_LLM_API_KEY;
    if (!key) throw new Error("KK_LLM_API_KEY is not set");

    const url = (baseUrl || process.env.KK_LLM_GATEWAY_URL || "").replace(/\/+$/, "") + DEFAULT_PATH;
    const doFetch = fetchImpl || fetch;
    const input = system ? `${system}\n\n${user}` : user;

    const res = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || process.env.KK_LLM_MODEL, input })
    });

    // Never echo the key in errors. The response body (gateway's error detail)
    // does not carry the auth header, so it's safe and needed for debugging.
    if (res.status === 401) throw new Error("Authentication failed. Please check KK_LLM_API_KEY.");
    if (!res.ok) throw new Error(`KK Gateway request failed (HTTP ${res.status}): ${await res.text()}`);

    return extractText(await res.json());
  };

module.exports = { createKKGatewayProvider };
