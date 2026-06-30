// Optional: ask the LLM Coach to explain today's recommendation in plain
// language. Consumes the deterministic analysis; needs ANTHROPIC_API_KEY.
//
//   npm run coach   ->  node scripts/coach.js ["your question"]

const { runAnalysis } = require("./analyze");
const { askCoach } = require("../analyzer/coach");

const { report, moves } = runAnalysis();
const top = report.recommendations[0];
const question =
  process.argv.slice(2).join(" ") ||
  (top ? `Why add ${top.add} and drop ${top.drop} this week?` : "Summarize this week's outlook.");

askCoach({ report, moves, question })
  .then((answer) => console.log(answer))
  .catch((err) => {
    const provider = process.env.LLM_PROVIDER || "claude";
    console.error(`Coach unavailable: ${err.message}`);
    console.error(`Check your .env (LLM_PROVIDER=${provider}) and run: source .env && npm run coach`);
    process.exitCode = 1;
  });
