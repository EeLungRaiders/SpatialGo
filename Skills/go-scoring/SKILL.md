---
name: go-scoring
description: >
  Territory scoring and komi for the Go game: flood-fill empty regions, Japanese
  or Chinese style totals, winner result. Use when implementing scoring.js or
  end-of-game score UI data. Triggers: /go-scoring, territory, komi, score, dame.
---

# go-scoring

## 職責說明

終局計分：空點 flood-fill 領地、komi、總分與勝負。

- 預設 **Japanese**：領地 + 提子 + komi（komi 預設 **6.5 給白**）
- 可選 `ruleset: 'chinese'`：盤上子 + 領地 + komi
- dame / 雙方 border 空點 → **neutral**
- **v1 不標死子**；`deadStones` 忽略；盤上子當活
- 無死活引擎 / AI

## 主要負責檔案 / 路徑

| 路徑 | 說明 |
|------|------|
| `Program_Go/GoGame/client/core/scoring.js` | → `go_scoring.js` |
| `Program_Go/GoGame/client/tests/scoring_cases.js` | load 時 runAll |

## Japanese 公式

```text
black = territoryBlack + capturedWhite
white = territoryWhite + capturedBlack + komi
```

（`capturedWhite` = 黑提走的白子數，計入黑分。）

## 模組公開函式規格

```text
GoGame.Scoring
  score(state, opts?) -> {
    black, white,                 # totals
    winner: 'black'|'white'|'draw',
    winnerColor: 1|2|null,        # State.BLACK/WHITE
    territory: { black, white, neutral, points? },
    captures: { black, white },   # black's capture gain, white's
    stones: { black, white }|null # chinese only
    komi, ruleset, reason
  }
  computeTerritory(state, includePoints?) -> territory counts

opts:
  ruleset?: 'japanese' | 'chinese'   # default japanese
  includePoints?: boolean
  deadStones?: ignored in v1
```

本模組 **只讀** board / captures / komi。UI 可把結果寫入 `session.lastScore` 或 `state.scoreResult` / phase，**不改 history**。

## 驗收標準

- [ ] 小盤局面可人工核對；komi 6.5 加白
- [ ] dame 不計任一方；兩 Pass 後 UI 可顯示
- [ ] `scoring_cases` PASS；無 DOM/ROOT

## 禁止事項

- 禁止用計分替代落子規則；禁止遠端裁判；禁止改 Docker/ROOT

## 依賴

上游 state / rules（phase）；下游 ui、可選 sgf RE。  
**實作順序**：⑤ Phase 4。

## 2D territory overlay（go-board-render）

UI 在計分時呼叫 `score(state, { includePoints: true })`，結果存於 `state.scoreResult`。
`Board2D` 在 `phase` 為 `scoring`/`finished` 時於空點畫小 TBox（黑地 / 白地 / dame）。
不修改計分公式。playing / New Game / Undo 回 playing 時不顯示。

## Manual dead stones

- `opts.deadStones` or `state.deadStones`: `[{x,y}, ...]`
- Treated as empty for territory flood-fill
- Japanese: each dead black → +1 white capture; dead white → +1 black capture
- No automatic life/death; UI toggles marks in scoring/finished
