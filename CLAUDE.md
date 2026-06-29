# Fantasy AI GM — working notes

Deterministic Yahoo Fantasy MLB general-manager tool, built sprint-by-sprint via TDD.

**Current progress: through Sprint 13.5.** Full sprint-by-sprint detail lives in
`docs/development-roadmap.md` — read it first to see what each module does and what's next.

## Pipeline

```
Yahoo Extension → Parser → Player/Team/FreeAgent models → Lineup Analyzer
→ Matchup Parser → Category Analyzer → Evaluator (shared scorer)
→ Streaming Engine → GM Decision Engine → Weekly Report → LLM Coach
```

`npm run analyze` runs the whole thing on `data/samples/*.json` and prints today's
recommendation. `npm run coach` (optional) explains the top move via Claude (needs
`ANTHROPIC_API_KEY`).

## Architecture principle (do not violate)

- **Deterministic-first.** All analysis and decisions are plain Node modules.
  The LLM (Coach) is a **presentation layer only** — it explains/compares/answers
  "why"; it never makes, changes, or invents a recommendation.
- **Evaluator is the single scorer** (`analyzer/evaluator.js`), reused by Streaming /
  Decision / future Trade / NBA. Don't re-score elsewhere.
- **Provider abstraction.** External data sits behind one interface so consumers don't
  know the source — Statcast (`providers/statcast.js`), LLM (`providers/llm.js`).
- **API keys never in the repo** — read from env vars at call time.

## Workflow (the user's rules)

- **main only.** Work directly on `main`; no feature branches unless asked.
- **One Sprint = one commit.** Commit message format: `Sprint X — <feature name>` (English).
- **All related tests green before commit, then push `main`.**
- MR/PR descriptions in 繁體中文; code/commits in English.

## Testing

- No framework. Plain `require("assert")` + top-level asserts. Run with `node <file>.test.js`.
- Success prints `<name>.test.js OK`. `npm test` runs every `*.test.js`.
- TDD: write the failing test first, watch it fail (RED), then minimal code (GREEN).

## Fixtures

`data/samples/{team,player,matchup}.json` are real exports from the (now fixed) Chrome
extension. The extension files free agents under `freeAgents[]` and the roster under
`roster[]`; `page.kind` is `team` / `free_agents` / `matchup`. When fixtures are
re-extracted, tests that pin player names/values must be re-baselined against the new
data (derive expected values from the fixtures — don't guess).
