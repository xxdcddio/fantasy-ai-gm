// LLM provider factory. Selects the Coach's provider by LLM_PROVIDER so new
// backends (openai / gemini) drop in here without touching the Coach.
//   LLM_PROVIDER=claude (default) -> Anthropic API
//   LLM_PROVIDER=kk               -> company KK LLM Gateway

const { createClaudeProvider } = require("./llm");
const { createKKGatewayProvider } = require("./kkGateway");

const createProvider = (which = process.env.LLM_PROVIDER) => {
  switch ((which || "claude").toLowerCase()) {
    case "claude": return createClaudeProvider();
    case "kk": return createKKGatewayProvider();
    default: throw new Error(`Unknown LLM_PROVIDER: ${which}`);
  }
};

module.exports = { createProvider };
