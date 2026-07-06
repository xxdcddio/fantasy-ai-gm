# Waiver Timing (P6)

## Problem

Every consumer today shows a raw Evaluator `score` (`fa.js`) or a raw score +
confidence % (`gmDecisionEngine.js` moves via `weeklyReport.js`), but nothing
tells the manager "is this actually worth acting on right now." P6 adds a
4-band recommendation label on top of the existing score/confidence — no new
data source, no new scorer.

## Bands

| Band | Emoji | Meaning |
|---|---|---|
| Add Now | 🔥 | Score is strong; if confidence is known, it's high too |
| Watch List | 👀 | Decent score; worth tracking, not urgent |
| Hold | 🤝 | Marginal score, or a good score with unproven confidence |
| Ignore | ❌ | Score too low to matter this week |

## Where thresholds come from

`analyzer/evaluator.js`'s `score` is the sum of five documented component
maxes: `categoryScore`(≤60) + `positionScore`(≤20) + `availabilityScore`(≤10)
+ `flexibilityScore`(≤10) + `statcastScore`(≤20) = **`MAX_SCORE` = 120**.

Score cutoffs are fractions of that max, not numbers picked to fit one week's
data: **50% (60) / 30% (36) / 15% (18)**. Fractions of the theoretical max
stay meaningful even as `categoryScore` swings week to week with the current
attack strategy — a fixed absolute cutoff tuned to one week's fixture would
drift out of calibration the moment the strategy changes.

Reality check: `npm run fa -- --top 30` against the current fixtures shows
real scores in the 3–23 range this week (a thin attack-category list this
week means `categoryScore` is 0 for most free agents). Nearly everyone lands
in Hold/Ignore — which is the correct read: nothing on waivers urgently fills
a category need this particular week. The bands aren't miscalibrated; the
week is just quiet.

Confidence gates (0.75 for Add Now, 0.6 for Watch List) are **not** new
semantics — they reuse the exact rungs `gmDecisionEngine.js`'s
`confidenceFor(gain)` already defines (`gain>=10` → 0.75, `gain>=5` → 0.6).

## Confidence is optional

Only `gmDecisionEngine.js` moves have a `confidence` (it compares an add
against a specific drop candidate). `fa.js`'s free-agent ranking and the raw
streaming list have no such pairing, so `bandFor({ score, confidence })`
treats `confidence` as optional:

- **Absent** → band is decided by score alone (used by `fa.js` and the
  streaming list).
- **Present** → acts as an additional gate that can only **downgrade** a
  band, never upgrade one. A high score with low confidence lands in Hold,
  not Ignore — still worth watching, just not a proven swap yet.

## API

```js
// analyzer/waiverBands.js
bandFor({ score, confidence }) // -> { key, emoji, label }
```

Pure, deterministic, same input → same output. `MAX_SCORE` and `BANDS` are
also exported so thresholds live in one place, not hard-coded at each call
site.

## Consumers

- `scripts/fa.js` — each ranked entry gets `waiverBand: bandFor({ score })`.
- `analyzer/gmDecisionEngine.js` — each move gets
  `waiverBand: bandFor({ score: add.score, confidence })`.
- `analyzer/weeklyReport.js` — passes `waiverBand` through the `recs`
  mapping; `renderWeeklyReport` prints it on the top recommendation.
- `scripts/analyze.js` — prints the top move's `waiverBand` and tags each
  "Top 5 Streaming" entry with a score-only band.
- `npm run briefing` / `coach.js` — no code change. Both prompts already
  `JSON.stringify` the full `report`/`moves` object, so `waiverBand` (an
  additive field) flows through automatically.

## Backward compatibility

`waiverBand` is an additive field on existing objects (moves, weekly-report
recommendations, fa rankings). No existing key is renamed, removed, or
reshaped. `evaluator.js` itself is untouched — `waiverBand` is computed
downstream of `score` by a separate module, so "Evaluator is the single
scorer" still holds: the Evaluator scores, this module labels.
