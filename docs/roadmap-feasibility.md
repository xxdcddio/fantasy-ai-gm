# Roadmap Feasibility Assessment

Evaluates the 10-priority roadmap (pasted 2026-07-06) against what the project
can actually see today. No code changes in this pass — this is the decomposition
step before writing any spec.

## Current data inventory (what we have to work with)

- **Yahoo team/roster page** (`data/samples/team.json`): rank, eligible
  positions, slot, IL/bench state, next single-day opponent + time, %rostered/
  %started. Stat cells are `-` unless the week is underway (Sprint 15.1).
  **No batting order, no multi-day schedule, no PA.**
- **Yahoo free-agent page** (`data/samples/free-agents.json`): roster status,
  season GP, pre-season/current rank, %rostered, H/AB, R, HR, RBI, SB, BB, AVG,
  OPS. **Season-cumulative only — no K, no BB rate (no PA to divide by), no
  recent-N-day split.**
- **Yahoo matchup page**: category score mine-vs-opponent, remaining team games
  (team total, not per player).
- **Statcast provider** (`analyzer/providers/statcast.js`): xwOBA, xBA, xSLG,
  barrelRate, hardHitRate, exitVelocity, chaseRate, whiffRate — but only for 4
  manually-curated fixture files (`data/statcast/*.json`). Not automated, not
  all players.
- **LLM Coach**: presentation-only, reasons from engine output, no external
  facts of its own.
- **No persistence layer** — nothing is stored between runs except gitignored
  per-run import files.

## Per-feature assessment

| # | Feature | Have today | Missing | New provider needed? | Difficulty (1-5) | Value (1-5) |
|---|---|---|---|---|---|---|
| 1a | Playing Time Score | IL/bench slot, next-day opponent | Multi-day schedule, projected PA, everyday/platoon signal, rest days | Yes — schedule + role feed | 4 | 5 |
| 1b | Lineup Position Score | Nothing | Projected batting order | Yes — lineup source (none scraped today) | 4 | 5 |
| 1c | Opportunity Score | Own-roster IL only | League-wide IL/promotion/trade transactions | Yes — MLB transactions feed | 5 | 5 |
| 1d | Rest-of-Season Ceiling | Nothing | Prospect/projection ranking | Yes, but can reuse the Statcast fixture pattern (manual JSON per player) | 3 | 4 |
| 1e | Stability Score | Statcast whiff/chase already flagged as risk; xBA vs AVG gap approximates BABIP luck | K%, BB% (no PA denominator) | No — extend existing Statcast provider | 2 | 4 |
| 2 | Weekly Matchup Strategy | **Already built** (`categoryAnalyzer.js` → attack/protect/ignore, consumed by report + decision engine) | Evaluator's `categoryComponent` only reads `strategy.attack`, ignores `protect` | No | 2 | 3 |
| 3 | Category Delta | `gmDecisionEngine.categoryImpact()` gives qualitative +/-/= from the add candidate's own stats | Numeric weekly delta needs projected PA (1a) + roster-side stats (currently roster players carry no season stats) | Depends on 1a | 3 | 4 |
| 4 | Weekly Schedule | Team-level remaining games only | Per-player games-this-week, park factor, weather | Yes — MLB public schedule API (no key) for games/park; weather optional | 3 | 4 |
| 5 | Pitcher Matchup | Category-level ERA/WHIP/QS only | Opponent splits, Vegas implied runs, projected IP/QS%, weather | Yes, several — Vegas odds likely a paid API | 5 | 4 |
| 6 | Waiver Timing | Evaluator score already ranks free agents | Just needs score-band → Add Now/Watch/Hold labeling | No | 2 | 4 |
| 7 | Weekly Report | **Mostly built** (`weeklyReport.js`) — summary/strengths/weaknesses/categoryOutlook/recommendations/notes | Win probability %, best-streaming/most-droppable/hold lists (can resurface existing engine output) | No | 2 | 4 |
| 8 | AI Coach (proactive briefing) | `coach.js` already answers Q&A grounded in engine output | Just a new prompt template that summarizes report+moves without a question | No | 1 | 4 |
| 9 | League Memory | Nothing persists between runs | Storage for past decisions + a way to know which ones the user actually took (no Yahoo write-back today) | Yes — local store + capture mechanism | 4 | 3 |
| 10 | Confidence Score reasons | Evaluator already returns `reasons[]` per component; decision engine already has a numeric confidence ladder | Just wire `reasons[]` into the move's explanation | No | 1 | 4 |

## Suggested implementation order (value density first, respect dependencies)

1. **P10** Confidence reasons — wire existing `reasons[]` into moves. Trivial.
2. **P8** AI Coach proactive briefing — new prompt template, reuses everything.
3. **P1e** Stability Score — extend Statcast provider, no new source.
4. **P6** Waiver Timing labels — threshold bands on existing score.
5. **P7** Weekly Report polish — resurface existing engine outputs + one win% heuristic.
6. **P2** Feed `protect`/`ignore` into `categoryComponent`, not just `attack`.
7. **P1d** Ceiling Score — manual fixture file, same pattern as Statcast.
8. **P4** Weekly Schedule — MLB public schedule API + static park-factor table.
9. **P3** Category Delta — needs roster-side stats + 1a's playing-time projection.
10. **P1a** Playing Time Score — needs a real schedule/role data source.
11. **P1b** Lineup Position Score — needs a lineup data source (biggest unknown).
12. **P9** League Memory — new persistence + decision-capture mechanism.
13. **P1c** Opportunity Score — league-wide transactions feed (hardest).
14. **P5** Pitcher Matchup — multiple new sources, Vegas odds likely paid.

## Phased plan

**Phase 1 — zero new data sources.** #1–6 above (P10, P8, P1e, P6, P7, P2).
Pure wiring + formulas on data the pipeline already has. Ships fastest, and
P1e/P2/P6/P7/P10 all directly strengthen the Evaluator or its consumers, which
per `roadmap.md`'s architecture principle is the one place all scoring should
live.

**Phase 2 — one lightweight provider each, no live/paid APIs.** #7–9 (P1d
Ceiling via manual fixture, P4 Schedule via MLB's free public API, P3 Category
Delta once roster stats + 1a exist — first check whether the extension can
even capture roster stat columns mid-week, same investigation as Sprint 15.1).

**Phase 3 — real new external data, bigger unknowns.** #10–14 (P1a/P1b
schedule+lineup source, P9 League Memory persistence, P1c league-wide
transactions, P5 pitcher matchup incl. possible paid Vegas odds API). Each of
these needs its own brainstorming/spec pass — they're independent subsystems,
not incremental Evaluator tweaks.
