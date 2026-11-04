---
name: go-rules-engine
description: >
  Client-side spatial Go rules: six-neighbour capture, suicide ban, simple ko,
  pass → ended (no scoring). Internal index 0..3. No DOM / ROOT.
  Triggers: /go-rules-engine, capture, ko, suicide, liberties, pass, resign.
---

# go-rules-engine

規則在瀏覽器 JS，不在 C++。座標是**內部 index** `0..3`（顯示制見 `Plans/03_1_UserCoords.md`，不在本模組）。

## P2

| 規則 | 行為 |
|------|------|
| 佔位／越界 | 非空或越界不可下 |
| 提子 | 先移除落點六鄰對方氣盡塊（可多塊） |
| 自殺 | 己方塊無氣且本次提子數為 0 → 拒 |
| 簡單劫 | 只提 1 子且落點 = `koPoint` → 拒立即回填 |
| Pass | `passCount>=2` → `phase='ended'`，不呼叫 scoring |
| Resign | `phase='finished'`，對方勝 |

`DIRS` 六鄰內部 ±1。禁止用顯示 ±2 當鄰接表。

`play` 順序：試放 → 提對方 → 判自殺 → 判劫 → 更新 `koPoint`／history／換手。

## 檔案

`client/core/rules.js` → `go_rules.js`  
`client/tests/rules_cases.js` → load 時 `runAll`（內部座標向量）

```text
GoGame.Rules
  play(state, x, y, z) -> { ok, state, captured, message }
  isLegal(state, x, y, z) -> bool   # 同一套試放
  getGroup(state, x, y, z)
  getLiberties(state, group)
  pass(state) -> { state, ended, message }
  resign(state) -> { state, winner }
```

## 禁止

C++ 規則；超劫；兩 Pass 進計分／領地；把顯示座標當 `board[]` 下標。
