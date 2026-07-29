// Sprint 14.4 — KK LLM Gateway provider. Same (prompt)->Promise<string>
// interface as the Claude provider; talks to the company gateway instead of
// api.anthropic.com. Fake fetch injected — no real network, key never printed.
const assert = require("assert");
const { createKKGatewayProvider } = require("./kkGateway");
const { createProvider } = require("./index");

const SECRET = "sk-9-secret-key";
// fakeFetch records the request and returns a canned response.
const fakeFetch = (body, status = 200) => {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: status < 400,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body)
    };
  };
  fn.calls = calls;
  return fn;
};

const base = { apiKey: SECRET, baseUrl: "https://gw.example.com", model: "kk-model" };

(async () => {
  // creation -> a function
  assert.strictEqual(typeof createKKGatewayProvider(base), "function");

  // missing key -> clear error, no network. Force-clear the env fallback: a
  // dev shell with a real KK_LLM_API_KEY exported would otherwise mask
  // apiKey: "" and let this attempt a real network call instead of throwing.
  const savedEnvKey = process.env.KK_LLM_API_KEY;
  delete process.env.KK_LLM_API_KEY;
  try {
    await assert.rejects(
      () => createKKGatewayProvider({ ...base, apiKey: "" })({ system: "s", user: "u" }),
      /KK_LLM_API_KEY is not set/
    );
  } finally {
    if (savedEnvKey !== undefined) process.env.KK_LLM_API_KEY = savedEnvKey;
  }

  // Responses API: { output_text }
  let f = fakeFetch({ output_text: "from output_text" });
  assert.strictEqual(
    await createKKGatewayProvider({ ...base, fetchImpl: f })({ system: "S", user: "U" }),
    "from output_text"
  );
  // hits /v1/responses with Bearer auth and model+input body
  assert.ok(f.calls[0].url.endsWith("/v1/responses"));
  assert.strictEqual(f.calls[0].opts.headers.authorization, `Bearer ${SECRET}`);
  const sent = JSON.parse(f.calls[0].opts.body);
  assert.strictEqual(sent.model, "kk-model");
  assert.ok(sent.input.includes("U"));

  // Responses content: { output:[{ content:[{ text }] }] }
  f = fakeFetch({ output: [{ content: [{ text: "a" }, { text: "b" }] }] });
  assert.strictEqual(await createKKGatewayProvider({ ...base, fetchImpl: f })({ user: "U" }), "ab");

  // Chat Completions: { choices:[{ message:{ content } }] }
  f = fakeFetch({ choices: [{ message: { content: "chat reply" } }] });
  assert.strictEqual(await createKKGatewayProvider({ ...base, fetchImpl: f })({ user: "U" }), "chat reply");

  // unrecognized shape -> clear throw
  f = fakeFetch({ something: "else" });
  await assert.rejects(() => createKKGatewayProvider({ ...base, fetchImpl: f })({ user: "U" }), /unrecognized|format/i);

  // 401 -> friendly auth message, and the key must NOT leak into it
  f = fakeFetch({ error: "bad key" }, 401);
  await assert.rejects(
    () => createKKGatewayProvider({ ...base, fetchImpl: f })({ user: "U" }),
    (e) => /Authentication failed/i.test(e.message) && !e.message.includes(SECRET)
  );

  // any other non-ok status also must not leak the key
  f = fakeFetch({ error: "boom" }, 500);
  await assert.rejects(
    () => createKKGatewayProvider({ ...base, fetchImpl: f })({ user: "U" }),
    (e) => !e.message.includes(SECRET)
  );

  // factory selection by LLM_PROVIDER (key read at call time, so no network here)
  assert.strictEqual(typeof createProvider("kk"), "function");
  assert.strictEqual(typeof createProvider("claude"), "function");
  assert.strictEqual(typeof createProvider(undefined), "function"); // defaults to claude
  assert.throws(() => createProvider("nope"), /Unknown LLM_PROVIDER/);

  console.log("kkGateway.test.js OK");
})();
