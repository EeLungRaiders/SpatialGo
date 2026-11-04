---
name: go-game-state
description: >
  Maintain spatial Go state: board[z][y][x], toPlay, captures, koPoint, passCount,
  moveHistory, phase, komi, undo. First release SIZE=4 only.
  Triggers: /go-game-state, moveHistory, toPlay, game phase, undo.
---

# go-game-state

純資料層。不含規則、繪圖、DOM、SGF。

- **`SIZE = 4`** 固定；不做 1–50／矩形
- **`board[z][y][x]`** — 一律 `getStone` / `setStone(state, x, y, z, …)`
- **`moveHistory`** 是 Undo 真實來源（play 必須有 `z`）

## 檔案

`Program_Go/GoGame/client/core/state.js` → `go_state.js`

## 狀態欄位

```text
size                  # 4
board[z][y][x]        # 0 empty | 1 Black | 2 White
toPlay, capturedBlack, capturedWhite, koPoint, passCount
moveHistory[]         # { type: play|pass|resign, color, x?, y?, z?, captured?, prev* }
lastAction, phase, komi, winner
```

## 公開函式

```text
GoGame.State
  EMPTY, BLACK, WHITE, SIZE, DEFAULT_KOMI
  opponent(color)
  inBounds(state, x, y, z) -> bool
  newGame({ komi? }) -> state
  clone(state) -> state
  undo(state) -> state
  getStone(state, x, y, z)
  setStone(state, x, y, z, color)
```

廢除：`width`/`height` 可變盤、`boardDims`、兩軸 `inBounds(x,y)`。

## 禁止

- isLegal／提子／計分
- JSROOT／DOM／SGF 主邏輯
