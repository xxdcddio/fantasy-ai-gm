// Optional: ask the LLM Coach for a proactive summary of this week's outlook
// and top recommendation, unprompted (no question). Needs ANTHROPIC_API_KEY.
//
//   npm run briefing   ->  node scripts/briefing.js

const { runAnalysis } = require("./analyze");
const { askBriefing } = require("../analyzer/coach");

const { report, moves } = runAnalysis();

askBriefing({ report, moves })
  .then((answer) => console.log(answer))
  .catch((err) => {
    const provider = process.env.LLM_PROVIDER || "claude";
    console.error(`Coach unavailable: ${err.message}`);
    console.error(`Check your .env (LLM_PROVIDER=${provider}) and run: source .env && npm run briefing`);
    process.exitCode = 1;
  });
