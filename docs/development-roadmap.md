# Fantasy AI GM Development Roadmap

> Last Updated: 2026-06-29

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

### Sprint 9 — Streaming Engine ⭐⭐⭐⭐⭐
Rank FA pickups by **category priority**, not Yahoo rank (supersedes the current
`FreeAgentList.bestAvailable`). Weigh each candidate's projected category
contribution against what the matchup needs:
```
Christian Walker  +0.35 HR  +1 RBI
Ryan O'Hearn      +0.05 SB  +0.006 AVG
```
Ordered by need, with schedule (remaining games) factored in.

### Sprint 10 — GM Decision Engine ⭐⭐⭐⭐⭐ (first real AI GM milestone)
Explainable add/drop decisions with projected category deltas and win probability:
```
Drop  Jung Hoo Lee
Add   Christian Walker
Reason: this week HR +11%, RBI +9%, AVG −2%
Win probability 52% → 61%
```

### Later
Trade Analyzer, LLM Coach (GPT as a final explanation/decision layer over the
team / FA / matchup / category models), plus the Future Ideas below.

---

## Known Issues / Tech Debt
- Chrome extension `pageKind` misclassifies matchup and player-list pages as `team`, so all rows land in `roster[]` and `matchup` / `freeAgents` are always empty. Parser currently reads `roster[]` regardless. Fix the extension or route by `page.url` before Sprint 7.
- FA stat parsing is mapped to the "All Batters" tab column layout. Pitcher tab (W/K/ERA/WHIP/K/BB/QS/SV+H) is a separate column map — add when the pitcher FA list is needed.

---

## Future Ideas
Injury predictor, waiver priority optimizer, dynasty / keeper support, prospect ranking, trade finder, FAAB optimizer, league trend analyzer, season simulation, AI draft assistant.

## Ultimate Goal
A fully autonomous Fantasy Baseball GM: reads Yahoo pages, understands roster construction, evaluates category needs, recommends pickups, optimizes daily lineup, evaluates trades, and explains its recommendations.
