# Fantasy AI GM Development Roadmap

> Last Updated: 2026-06-29

## Architecture Flow

```
Yahoo Fantasy → Chrome Extension → JSON → Parser → Player Model → Team Model
→ Free Agent Model → Analyzer → Streaming Engine → LLM Coach → Daily Recommendation
```

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

## Upcoming Sprints

### Sprint 6 — Lineup Analyzer ⭐⭐⭐⭐
Roster construction: position depth, bench depth, IL analysis, multi-position eligibility.

### Sprint 7 — Category Analyzer ⭐⭐⭐⭐⭐
Analyze the current matchup (needs matchup-page parsing: 2 players/row, category columns). Output category needs: attack / protect / safe.

### Sprint 8 — Streaming Engine ⭐⭐⭐⭐⭐
Recommend best pickup from FA using schedule + category needs + opponent. Scored, ranked, with reasons.

### Sprint 9 — Schedule Analyzer ⭐⭐⭐
Weekly schedule: games this week, off days, platoon detection.

### Sprint 10 — Daily Recommendation ⭐⭐⭐⭐⭐
Daily report: current matchup, today's starters, today's pickup, win probability.

### Sprint 11 — Trade Analyzer ⭐⭐⭐⭐
Evaluate trades: score, pros / cons.

### Sprint 12 — LLM Coach ⭐⭐⭐⭐⭐
GPT as the final decision layer over team / FA / matchup / schedule JSON.

---

## Known Issues / Tech Debt
- Chrome extension `pageKind` misclassifies matchup and player-list pages as `team`, so all rows land in `roster[]` and `matchup` / `freeAgents` are always empty. Parser currently reads `roster[]` regardless. Fix the extension or route by `page.url` before Sprint 7.
- FA stat parsing is mapped to the "All Batters" tab column layout. Pitcher tab (W/K/ERA/WHIP/K/BB/QS/SV+H) is a separate column map — add when the pitcher FA list is needed.

---

## Future Ideas
Injury predictor, waiver priority optimizer, dynasty / keeper support, prospect ranking, trade finder, FAAB optimizer, league trend analyzer, season simulation, AI draft assistant.

## Ultimate Goal
A fully autonomous Fantasy Baseball GM: reads Yahoo pages, understands roster construction, evaluates category needs, recommends pickups, optimizes daily lineup, evaluates trades, and explains its recommendations.
