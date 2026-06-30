# Fantasy AI GM Development Roadmap

> Last Updated: 2026-06-30

## Architecture Flow

```
Yahoo Extension → Parser → Player → Team → FreeAgent → Lineup Analyzer
→ Matchup Parser → Category Analyzer → Streaming Engine → GM Decision Engine
```

The first six stages are the foundation (done). Sprints 7–10 are where the
project becomes a real AI GM: understand the matchup, turn it into category
priorities, rank pickups by those priorities, and finally make explainable
add/drop decisions with a projected win-probability change.

---

## Current Progress

### ✅ Sprint 1 — Chrome Extension
Yahoo Fantasy DOM extractor: roster / matchup / FA list → JSON export.

### ✅ Sprint 2 — Parser
`analyzer/parser.js` (+ test). Normalize extension JSON, strip DOM fields, standardize player objects.

### ✅ Sprint 2.5 — Parser hardening for real Yahoo data
Rewrote the parser against real `team.json`. Link-driven extraction (clean name + id from the `/mlb/players/<id>` link), `TEAM - POS,POS` for team + multi-position eligibility, injury tokens glued onto the name (`IL10` / `DTD`), game link for start time + opponent, and a player-row filter that drops Yahoo section headers / totals / team-analysis rows. Fixtures: real `data/samples/{team,matchup,player}.json` (the fictional `sample.json` was removed).

### ✅ Sprint 3 — Player Model
`analyzer/models/player.js` (+ test). `isPitcher() / isHitter() / isBench() / isIL() / canPlay() / toJSON()`.

### ✅ Sprint 4 — Team Model
`analyzer/models/team.js` (+ test). Whole roster as a domain model: `hitters() / pitchers() / getBench() / getIL() / getByPosition() / findPlayer() / toJSON()`. Built from the parser's bucketed output or a flat player array.

### ✅ Sprint 5 — Free Agent Model
`analyzer/models/freeAgent.js` (+ test) and `normalizeFreeAgents()` in the parser. `FreeAgent extends Player` with season stats (R/HR/RBI/SB/BB/AVG/OPS), roster status, % rostered, and Yahoo ranks. `FreeAgentList`: `find() / findByPosition() / bestAvailable()` (best = lowest Yahoo current rank).

---

### ✅ Sprint 6 — Lineup Analyzer
`analyzer/lineupAnalyzer.js` (+ test). Deterministic roster-construction analysis on the Team Model: `getPositionDepth` (depth chart by eligible position, multi-position players counted in every slot), `getBenchCandidates`, `getILSummary`, `findEmptyOrWeakSlots` (thin defensive positions), and `analyzeLineup` → `{ positionDepth, bench, IL, weakSlots, notes }`. No scoring / AI yet.

---

## Upcoming Sprints

> Re-planned 2026-06-29: a matchup must be fully parsed and turned into
> category priorities **before** any pickup/decision logic. So Matchup Parser
> and Category Analyzer come first; Streaming and the Decision Engine build on
> them. These four sprints are the project's real differentiator.

### ✅ Sprint 7 — Matchup Parser (done)
`analyzer/matchupParser.js` (+ test). `parseMatchup(export)` → `{ week, score,
teams{mine,opponent}, categories[] }`. Week/teams come from `matchupHeader`;
score + the 14 scoring categories (7 hitting / 7 pitching, with `leader` and
`lowerIsBetter` for ERA/WHIP) are parsed from the stat table. Non-scoring H/AB*
and IP* are dropped; summary rows are ignored and no fake players are created.

Enabled by two extension fixes:
- **Sprint 7.0** — detect matchup pages by URL and scrape the off-table
  `matchupHeader` (week, both teams' id/name/manager/record, games played &
  remaining), with null/"" fallbacks. (manager is best-effort.)
- **Sprint 7.1** — name the popup's JSON download by `page.kind`
  (team/free-agents/matchup) so fixtures drop into `data/samples/`.

Deferred: per-day starters and parsing the two players per row into Team models
(not needed for the Category → Streaming → Decision path).

### ✅ Sprint 8 — Category Analyzer (done)
`analyzer/categoryAnalyzer.js` (+ test). `analyzeCategories(parseMatchup(...))`
adds per-category `margin` / `status` (ahead|behind|tied|unknown) / `priority`
(high|medium|low|ignore), then buckets into `strategy { attack, protect, ignore }`
+ `notes`. Deterministic, lower-is-better aware (ERA/WHIP). Closeness uses crude
fixed per-stat thresholds (a `ponytail:` heuristic to refine with remaining games
/ projections). Consumed by the Streaming + Decision engines.

### ✅ Sprint 9.5 — Evaluator (shared GM scorer)
`analyzer/evaluator.js` (+ test). `evaluatePlayer(player, strategy, team)` is the
single scoring model reused by Streaming / Decision / Trade (and a future NBA GM):
`categoryScore`(≤60, absolute per-stat thresholds vs `strategy.attack`) +
`positionScore`(≤20, fills a weak slot from the Lineup Analyzer) +
`availabilityScore`(≤10, healthy/DTD/IL) + `flexibilityScore`(≤10, multi-position),
plus `reasons` + `risks`. Deterministic; replaces Yahoo rank as the scoring basis.

### ✅ Sprint 9 — Streaming Engine
`analyzer/streamingEngine.js` (+ test). `recommend(freeAgents, strategy, team)` →
`{ recommendations: [{ player, action: "add", score, ...breakdown, reasons, risks }] }`,
sorted by Streaming Score (not Yahoo rank). A thin layer over the Evaluator;
ranks ADD candidates only (drop / swap is Sprint 10).

### ✅ Sprint 10 — GM Decision Engine (first real AI GM milestone)
`analyzer/gmDecisionEngine.js` (+ test). `recommendMoves({ team, freeAgents,
matchup, strategy })` → `{ moves: [{ type:"add_drop", add, drop, confidence,
scoreGain, categoryImpact, explanation, risks }] }`. Pairs Streaming ADD
candidates with the weakest droppable roster spot (Net Gain = Evaluator(add) −
Evaluator(drop)), ranked by gain; confidence from a Net-Gain ladder. Never drops
IL or a protected-core player. Deterministic, structured JSON, no GPT.
ponytail: temporary protected-name list + single-weakest-spot swap — refine with
Evaluator thresholds and position-aware swaps.

---

## Future

### ✅ Sprint 11 — Baseball Savant Integration
`analyzer/providers/statcast.js` (+ test) is the single Statcast source
(`getPlayerStatcast(name)` → fixture from `data/statcast/<slug>.json`, or null).
The Evaluator gains a `statcastScore` (≤~20): star tiers for Barrel %, Hard Hit %,
xwOBA, xSLG summed, with quality reasons + whiff/chase risks. The Evaluator only
knows the Provider interface, not the source — so Streaming / Decision are
unchanged and just rank on the stronger score. ponytail: fixture-backed players
get a data-availability nudge; revisit if it skews.

### ✅ Sprint 12 — Weekly Report Generator
`analyzer/weeklyReport.js` (+ test). `generateWeeklyReport({ team, matchup,
strategy, recommendations })` → `{ summary, strengths, weaknesses,
categoryOutlook, rosterAnalysis, recommendations, notes }`, plus
`renderWeeklyReport(report)` for a plain-text view. Pure aggregation of the
existing analyzers + GM Decision Engine — deterministic, no GPT.

### ✅ Sprint 13 — LLM Coach
`analyzer/coach.js` (+ test) and `analyzer/providers/llm.js`. Claude as a
**presentation layer only** — explain recommendations, compare players, answer
"why". `buildCoachPrompt({ report, moves, question })` → `{ system, user }` is
pure and grounded only in the deterministic engine's output; the system
instruction forbids changing/inventing decisions. `askCoach({ ..., provider })`
calls a `(prompt) => Promise<string>` LLM provider — `createClaudeProvider`
(Claude Opus 4.8, adaptive thinking, raw HTTPS, key from `ANTHROPIC_API_KEY` at
call time, no SDK dependency). Tests inject a fake provider — no network, no key,
no cost. ponytail: testable framework only; real call wired but unexercised.

### ✅ Sprint 13.5 — CLI Analyzer
`scripts/analyze.js` (+ test) wires the whole deterministic pipeline from the
extension fixtures and prints today's recommendation: `npm run analyze`. Reads
team/player/matchup → Parser → Team/FreeAgent → Matchup/Category → Streaming →
GM Decision → Weekly Report → console. `runAnalysis()` returns the structured
result; `formatAnalysis()` renders it. `npm run coach` (optional) explains the
top move via the LLM Coach (needs `ANTHROPIC_API_KEY`). Also: the fixed
extension now files FAs under `freeAgents[]` (was `roster[]`), so
`normalizeFreeAgents` reads `freeAgents` (roster fallback for old fixtures), and
the six fixture-pinned tests were re-baselined against the freshly-extracted
team/player pages.

### ✅ Sprint 13.7 — Normalize free agents filename
Unified the free-agent fixture/working filename to `free-agents.json` (matches
the extension download), replacing the old `player.json`. Renamed
`data/samples/player.json` → `data/samples/free-agents.json` and updated
`scripts/analyze.js` + the five tests that read it. Parser's old-format
backward compatibility (`freeAgents[]` ↔ `roster[]`) is unchanged — that's
payload shape, not filename. Also gitignored top-level `data/*.json` (per-run
import files from Sprint 13.8) while keeping `data/samples/*.json` tracked.

### ✅ Sprint 13.8 — Import CLI
`scripts/import.js` (+ test). `npm run import` moves the three extension
downloads (`team.json` / `matchup.json` / `free-agents.json`) from
`~/Downloads` into `data/`, creating `data/` if absent. `importFiles({from,to})`
is pure (dirs injected, so the test runs against tmp dirs — no real Downloads);
`formatImport()` renders `✓ name` / `✗ name (not found)`. Move = `renameSync`
with a copy+unlink fallback on `EXDEV` (cross-volume). Daily flow is now
`npm run import && npm run analyze`.

### ✅ Sprint 14.1 — Player Lookup CLI
`scripts/player.js` (+ test). `npm run player "Christian Walker"` prints the
full Evaluator breakdown for one free agent: GM / Category / Position /
Availability / Flexibility / Statcast scores + reasons + risks. Reuses
`runAnalysis()` for data + the shared `evaluatePlayer` scorer (no re-scoring).
`lookupPlayer(name, {freeAgents, strategy, team})` returns `{player, evaluation}`
or null; `formatPlayer()` renders it. Name match is case/accent-insensitive via
`FreeAgentList.find`.

### ✅ Sprint 14.2 — Compare CLI
`scripts/compare.js` (+ test). `npm run compare "A" "B"` shows both players'
Evaluator component scores side by side and declares a winner (higher GM score,
or "Tie"). "Because" lists the components where the winner strictly beats the
loser. Reuses `lookupPlayer` + the shared scorer; missing names → clear error.

### ✅ Sprint 14.3 — Free Agent Ranking CLI
`scripts/fa.js` (+ test). `npm run fa` ranks free agents by the shared
Evaluator's GM score (`1. Name — score`). Flags: `--top N` (default 10) and
`--position 3B` (uses `FreeAgentList.findByPosition` / `canPlay`). Note npm
needs the `--` separator to pass flags through:
`npm run fa -- --top 20 --position 3B`. Reuses `runAnalysis()` + `evaluatePlayer`.

### ✅ Sprint 14.4 — KK LLM Gateway Provider
`analyzer/providers/kkGateway.js` (+ test) + `analyzer/providers/index.js`
(`createProvider`). Adds the company KK LLM Gateway as a Coach backend behind the
same `(prompt)=>Promise<string>` interface. `createProvider()` selects by
`LLM_PROVIDER` (`claude` default → Anthropic; `kk` → gateway), so new backends
(openai/gemini) drop in without touching the Coach. `askCoach` default now uses
the factory. KK provider POSTs `${KK_LLM_GATEWAY_URL}/v1/responses` with
`Authorization: Bearer ${KK_LLM_API_KEY}` and `{model, input}`; response parsing
tolerates `output_text` / `output[].content[].text` / `choices[].message.content`,
else throws. 401 → "Authentication failed…"; the API key never appears in any
error. Tests inject a fake fetch (no real network). Config in `.env` (gitignored):
`LLM_PROVIDER=kk`, `KK_LLM_GATEWAY_URL`, `KK_LLM_API_KEY`, `KK_LLM_MODEL`.

### ✅ Sprint 15.1 — Re-baseline matchup fixture (week underway)
**Not a parser bug.** Investigation: the previous `matchup.json` was a
not-yet-started Week 15 snapshot (score 0-0, every category value `-` → null),
so the Category Analyzer correctly bucketed everything into `ignore`. The parser
reads the score/category table from `roster[]` and works on both states. Re-
extracting `matchup.json` mid-week (score 6-6, real values) made `npm run analyze`
produce real attack/protect/ignore with no code change. Per the fixtures rule,
three value-pinned tests were re-baselined against the started-week data:
`matchupParser.test.js` (score 6-6, gamesPlayed 17/15, remaining 92/96, HR 1 vs 2,
ERA leader mine, K/BB still null), `categoryAnalyzer.test.js` (real strategy
buckets), `weeklyReport.test.js` (currentScore 6-6, remaining 92/96). No
`matchupParser.js` / `categoryAnalyzer.js` changes.

### ✅ Sprint 14.5 — Player lookup searches the team roster too
Root cause: the shared `lookupPlayer` (`scripts/player.js`) only called
`freeAgents.find(name)`, so rostered players (e.g. Willi Castro) returned
"not found" in `player` / `compare`. Fix is one line in the shared lookup —
fall back to `team.findPlayer(name)` after the FA search — so every CLI benefits
and `compare.js` is untouched. `FreeAgentList.find` and `Team.findPlayer` already
share the same `normalizeName` (trim + lowercase), so matching is consistent.

---

## Known Issues / Tech Debt
- `getPlayerStatcast` slug splits on the apostrophe (`Ryan O'Hearn` → `ryan-o-hearn`) and misses `ryan-ohearn.json`. Only matters if an apostrophe-named FA needs Statcast; Curtis Mead is the current fixture-backed FA.
- FA stat parsing is mapped to the "All Batters" tab column layout. Pitcher tab (W/K/ERA/WHIP/K/BB/QS/SV+H) is a separate column map — add when the pitcher FA list is needed.

---

## Future Ideas
Injury predictor, waiver priority optimizer, dynasty / keeper support, prospect ranking, trade finder, FAAB optimizer, league trend analyzer, season simulation, AI draft assistant.

## Ultimate Goal
A fully autonomous Fantasy Baseball GM: reads Yahoo pages, understands roster construction, evaluates category needs, recommends pickups, optimizes daily lineup, evaluates trades, and explains its recommendations.
