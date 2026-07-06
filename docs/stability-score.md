# Stability Score 設計文件（P1e）— 已核准，實作中

升級既有 `analyzer/evaluator.js` 的 `statcastComponent`，讓它從「四項指標星等相加」
變成能分辨 **真實力 vs 運氣** 的 Stability Score。**不新增元件、不新增欄位**——
`statcastScore` 這個 key、0~20 分尺度、Evaluator 對外介面全部不變，只換內部公式。

**`statcastScore` 現在代表的意義**：它不再是「四項指標各自星等的總和」，而是這位球員
**Underlying Skill（真實打擊能力）的綜合分數**——由 Quality（擊球品質）、
Skill（真實打擊能力）、Discipline（穩定性/風險）三桶加總而成。分數越高代表底層數據
支撐得越穩，而不是單純「今天打得好不好」。

## 設計目標

- 同一批 Statcast 指標只在一個地方計分（Evaluator「唯一評分器」原則），避免雙重加權。
- 把現有「四指標星等相加」的粗略公式，換成能區分三種訊號的公式：
  擊球品質（Quality）、真實打擊能力（Skill）、穩定性/風險（Risk）。
- 在有實際生產數據（AVG/OPS）時，額外判斷「表現 vs 實力」的落差，
  輸出 Hot/Cold/Stable 分類與對應的 regression 提示。
- `reasons[]` 要能被 Weekly Report 與 AI Coach 直接引用成一句人話。

## 評分目的（解決哪些誤判）

現況只看 Barrel%/HardHit%/xwOBA/xSLG 四項是否達標給星星，會有兩個誤判：

1. **看不出「爆種是不是曇花一現」**：一個 AVG .300 的球員，如果 xBA 只有 .240，
   代表目前的高打擊率主要是運氣（BABIP 偏高），現有公式不會抓到這個落差，
   容易高估他接下來的產出。
2. **看不出「低潮是不是被低估」**：反過來，一個 AVG .220 但 xBA .280、xwOBA 也高的球員，
   現有公式只看到低分項目少，不會特別加分，容易錯過「即將反彈」的機會。

Stability Score 要解決的就是這兩種誤判，讓 Waiver / Streaming 決策不只看錶面數字。

## 資料限制與「Hot/Cold」的實際定義

目前 Statcast fixture（`data/statcast/*.json`）**沒有時間窗欄位**，每位球員只有一筆
season-to-date 快照，無法做「近 7 天 vs 近 30 天」這種真正的「熱度」判斷。

因此本設計把 **Hot/Cold 重新定義為「實際生產 vs 潛在實力的落差」**，而不是「近期趨勢」：

- **實際生產（Result）**：來自 Yahoo 的 `player.stats.AVG` / `player.stats.OPS`（季累計）。
- **潛在實力（Process）**：來自 Statcast 的 Quality + Skill 兩桶分數。
- Hot = 目前 AVG/OPS 表現好；Cold = 表現差。
- Sustainable/Lucky/Unlucky 則看 Process 分數撐不撐得住目前的 Result。

這與 Baseball Savant 慣用的「Expected Stats vs Actual Stats」解讀一致，是業界標準的
運氣判斷法，不是妥協方案。

另外要注意：**目前只有 FreeAgent 有 `stats`（AVG/OPS），Roster 上的球員目前沒有季累計
數據**（`docs/roadmap-feasibility.md` P3 已記錄這個缺口）。所以 Roster 球員只能做到
Skill-only 評估（沒有 Hot/Cold 分類），這在下面案例驗證會示範。

## Score 範圍與整體結構

維持 **0~20 分**，`statcastScore = round(Quality + Skill + Discipline)`，三桶各自的分數
由該桶內每個指標的線性 grade 加總而成：

```
grade(value, floor, full) = clamp01((value - floor) / (full - floor)) * metricMaxPoints
```

（`floor > full` 代表「數值越低越好」的指標，公式方向會自動反過來，不用另外寫分支。）

| 桶 | 指標 | 上限 | 桶總上限 |
|---|---|---|---|
| **Quality** 擊球品質 | Barrel% | 3 | |
| | HardHit% | 2 | |
| | Exit Velocity | 1 | **6** |
| **Skill** 真實打擊能力 | xwOBA | 5 | |
| | xSLG | 3 | |
| | xBA | 2 | **10** |
| **Discipline** 穩定性/風險 | Chase%（低較好） | 2 | |
| | Whiff%（低較好） | 2 | **4** |

3 + 2 + 1 + 5 + 3 + 2 + 2 + 2 = **20**，與現行尺度一致。

xwOBA 權重最高，因為它是目前公認最能代表真實打擊能力的單一指標；xBA 權重最低，
因為它只反映到壘率，資訊量比 xwOBA/xSLG 少，避免跟 AVG 的落差判斷邏輯循環互相加權。

### 每指標的 floor/full

| 指標 | floor | full | 說明 |
|---|---|---|---|
| xwOBA | 0.300 | 0.400 | 聯盟平均 ~.320，菁英 ~.400 |
| xSLG | 0.380 | 0.560 | 延續現有 star tier 校準 |
| xBA | 0.230 | 0.300 | 沿用 `evaluator.js` 現有 `STAT_SCALE.AVG`，同尺度好比較 |
| Barrel% | 6 | 16 | 延續現有 `barrelStars` 校準 |
| HardHit% | 32 | 52 | 延續現有 `hardHitStars` 校準 |
| Exit Velocity | 86 | 94 | 聯盟平均 ~88-89，菁英 92+ |
| Chase% | 35 | 20 | 越低越好；35 是現有「High Chase Rate」風險門檻 |
| Whiff% | 32 | 18 | 越低越好；32 接近現有「High Whiff Rate」風險門檻(30) |

這些 floor/full 是初始校準值，等有更多球員 fixture 後可以再調整
（`ponytail: 常數集中放檔案頂部，之後好調`）。

## Hot / Cold / Stable 分類邏輯

只有在球員 `stats.AVG` 與 `stats.OPS` 都存在時才分類；沒有就跳過分類（見下方案例 3、4）。

1. **Result level**（實際生產）：用現有 `STAT_SCALE.AVG`/`STAT_SCALE.OPS` 算 strength，
   取平均。`>= 0.65` → Hot；`<= 0.35` → Cold；其餘 → Neutral。
2. **Process level**（潛在實力）：`(Quality + Skill) / 16`。`>= 0.65` → Strong；
   `<= 0.35` → Weak；其餘 → Neutral。
3. 對照表：

   | Result \ Process | Strong | Neutral | Weak |
   |---|---|---|---|
   | Hot | Hot and sustainable | Stable producer | Hot but lucky |
   | Neutral | Stable producer | Stable producer | Stable producer |
   | Cold | Cold but unlucky | Stable producer | （見下方備註） |

**確定只保留這 4 種分類，不新增第五種**：Cold + Weak（表現差、實力也差）併入
Stable producer——代表「沒有需要特別注意的落差訊號」，不是字面上的褒義，只是
分類系統裡「無特殊訊號」的預設值。Neutral/Neutral、Hot/Neutral、Cold/Neutral
同樣都併入 Stable producer。

## 整合進 Evaluator

`statcastComponent(player)` 內部改成三桶計算，**子分數（Quality/Skill/Discipline）
也一併回傳**，不是只算完就丟掉——供 CLI、Weekly Report、Coach、未來 Debug 使用：

```
statcastComponent(player):
  sc = getPlayerStatcast(player.name)
  if !sc: return { score: 0, quality: 0, skill: 0, discipline: 0, reasons: [], risks: [] }

  quality = grade(barrelRate) + grade(hardHitRate) + grade(exitVelocity)   // 上限 6
  skill   = grade(xwOBA) + grade(xSLG) + grade(xBA)                       // 上限 10
  discipline = grade(chaseRate, reversed) + grade(whiffRate, reversed)    // 上限 4

  reasons = [] ; risks = []
  // component-level reasons/risks（隨時可算，不需要 stats）
  if quality/6 >= 0.8: reasons.push("Elite contact quality")
  if skill/10 >= 0.7: reasons.push("Strong underlying metrics")
  if chaseRate >= 32: risks.push("High chase risk")
  if whiffRate >= 30: risks.push("High whiff risk")
  if chaseRate <= 25 and whiffRate <= 20: reasons.push("Excellent plate discipline")

  // classification-level reasons（需要 player.stats.AVG/OPS 才算；固定 4 種，不新增）
  if player.stats?.AVG != null and player.stats?.OPS != null:
    label = classify(resultLevel, processLevel)   // 見上方對照表
    reasons.push(label)
    if label == "Hot but lucky": reasons.push("Likely negative regression")
    if label == "Cold but unlucky": reasons.push("Likely positive regression")

  return {
    score: round(quality + skill + discipline),
    quality: round(quality), skill: round(skill), discipline: round(discipline),
    reasons, risks
  }
```

`evaluatePlayer()` 新增三個對外欄位 `qualityScore` / `skillScore` / `disciplineScore`
（跟 `categoryScore`/`positionScore` 同樣命名風格），`score`/`statcastScore`/
`reasons`/`risks` 的合併邏輯不變——這是**新增欄位**，不是改變現有欄位，舊消費者
（Decision Engine、Weekly Report、Coach）不受影響。

## reasons[] / risks[] 文字設計（統一措辭，給 AI Coach / Confidence 引用）

| 文字 | 類型 | 觸發條件 |
|---|---|---|
| `Elite contact quality` | reason | Quality 桶 >= 80% 上限 |
| `Strong underlying metrics` | reason | Skill 桶 >= 70% 上限 |
| `Excellent plate discipline` | reason | Chase% <= 25 且 Whiff% <= 20 |
| `High chase risk` | risk | Chase% >= 32（原文字 `High Chase Rate`，統一改成這個措辭） |
| `High whiff risk` | risk | Whiff% >= 30（原文字 `High Whiff Rate`，統一改成這個措辭） |
| `Hot and sustainable` / `Hot but lucky` / `Cold but unlucky` / `Stable producer` | reason | 分類結果（需有 AVG/OPS），固定 4 種 |
| `Likely positive regression` | reason | 分類 = Cold but unlucky |
| `Likely negative regression` | reason | 分類 = Hot but lucky |

`risks[]` 的既有字串 `High Chase Rate` / `High Whiff Rate` 會變成
`High chase risk` / `High whiff risk`——已確認要改，測試檔會一併更新。

## 3~5 個真實球員案例驗證

用現有 4 個 Statcast fixture 實際套公式（手算，非程式）：

| 球員 | Quality | Skill | Discipline | statcastScore | AVG/OPS | 分類 |
|---|---|---|---|---|---|---|
| Ryan O'Hearn | 3.38/6 | 4.91/10 | 1.78/4 | **10** | .286/.821（Hot, 0.80） | Process 0.52 → Neutral → **Stable producer** |
| Curtis Mead | 3.23/6 | 4.49/10 | 2.08/4 | **10** | .222/.788（Cold, 0.29） | Process 0.48 → Neutral → **Stable producer** |
| Christian Walker | 5.17/6 | 6.05/10 | 1.60/4 | **13** | 無季累計數據（Roster） | 無法分類 → Skill-only：Process 0.70 = Strong，只輸出 `Elite contact quality` |
| Luis García Jr. | 2.09/6 | 4.23/10 | 1.56/4 | **9** | 無季累計數據（Roster） | 無法分類 → Skill-only：Process 0.40 = Neutral，`High Chase Rate` risk（chase 34.0） |
| （無 fixture 的球員，如 Isaac Paredes） | - | - | - | **0** | - | 維持現況：無資料、無 reasons、無 risks |

觀察：

- Christian Walker 分數最高（13），且 Quality/Skill 都在 Strong 區間，跟他實際球風
  （高品質全能打者）吻合，是很好的 sanity check。
- Ryan O'Hearn / Curtis Mead 目前都落在「Process 中性」，所以都判定 Stable producer——
  這符合資料現況（兩人指標都不極端），但也代表初始的 0.35/0.65 門檻可能偏寬，
  之後累積更多 fixture 後可以再收斂，這是已知、刻意先簡化的校準假設。
- Christian Walker / Luis García Jr. 是 Roster 球員，目前抓不到季累計 AVG/OPS，
  所以只能做 Skill-only 評估——這個限制在 `docs/roadmap-feasibility.md` 的 P3
  一節已經記錄過，不是這次新發現的問題，Stability Score 設計上就是遇到這種情況時
  優雅降級（不分類、不硬猜），而不是報錯或給錯誤標籤。

## 已知、刻意先不處理的事項

- Result/Process 的 Hot/Cold/Strong/Weak 門檻（0.35/0.65）是初始校準值，之後累積
  更多 Statcast fixture 後可以再收斂，門檻常數集中放在檔案頂部，好調整。
- Roster 球員目前沒有季累計 AVG/OPS，Skill-only 降級評估會持續到 P3
  （`docs/roadmap-feasibility.md`）補上這塊資料為止。

## 實作狀態

設計已核准（含 statcastScore = Underlying Skill 定調、reasons/risks 統一措辭、
固定 4 種分類、子分數對外可見 4 項補充）。實作項目：

1. `analyzer/evaluator.js`：`statcastComponent` 三桶化，`evaluatePlayer()` 新增
   `qualityScore`/`skillScore`/`disciplineScore`。
2. 重新計算 `evaluator.test.js` / `streamingEngine.test.js` /
   `scripts/player.test.js` 裡 pin 住的數值（Curtis Mead 的 `statcastScore`
   會從 12 變成新公式算出的值，`risks[]` 文字也會變）。
3. `scripts/player.js` 顯示新增的子分數，方便 CLI debug。
