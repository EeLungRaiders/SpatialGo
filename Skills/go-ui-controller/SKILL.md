---
name: go-ui-controller
description: >
  Hotseat UI for spatial 4×4×4: toPlay, Place, Pass, Resign, Undo, New Game,
  Reset view, Mem. Stat., move log. No 2D switch, Size, SGF, or score.
  Triggers: /go-ui-controller, controller.js.
---

# go-ui-controller

專頁 `/gogame/gogame.htm` 唯一遊玩面。殼 GoBoard 只開專頁。

## 檔案

`client/ui/controller.js` → `go_ui.js`

## P2 控制

留：New Game（永遠 4×4×4）、Undo、Place／Hand 拖放、Pass、Resign、Reset view、Mem. Stat.、Reload、Message、log 內部 `(x,y,z)`  
隱藏：2D/3D、Size、SGF、Score、死子、領地  
`ended`／`finished`：不可 Place／落子。兩 Pass Message「雙方停手（計分延後）」。  
顯示座標轉換屬 05，本 skill 不改 `fmtPoint` 成 {-3,-1,1,3}。

```text
GoGame.UI.mount(dom) -> { refresh, getState, dispatch, destroy }
dispatch("play", {x,y,z})
dispatch("undo" | "newGame" | "pass" | "resign")
```

點擊 → `Rules.play` → `boardCtrl.render`。提子／Undo 靠全量 redraw。
