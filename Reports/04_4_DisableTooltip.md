# 04_4 關閉 TGeo tooltip（extract_pos / hide）

**skill：** `Skills/diff-change-workflow/SKILL.md`  
04／04_2 不 reverse；04_3 留在樹上。本 diff 單獨 reverse 回到 04_3 之後。

使用者 error：`this.tooltip?.extract_pos is not a function`、`hide is not a function`。  
`?.` 只擋 `tooltip` 為 null／undefined；**物件在、方法不在**仍會呼叫失敗。

---

## 1. 現在 tooltip 實際是什麼？

工作區沒有 JSROOT 套件可印 runtime。從 **我們的賦值** 讀碼：

- `disableGeoTooltipHighlight`：`painter.ctrl.tooltip = **false**`
- `muteControlHover`：`ctrl.tooltip = **false**`（僅當 `"tooltip" in ctrl`）

`false` 對 `this.tooltip?.extract_pos()` 是 falsy，理論上不該進呼叫。  
`J.draw("same")`／新建 controls 之後，JSROOT 常把 `control.tooltip` 設回 **truthy**：官方 tooltip 物件、或僅當開關的 `true`／殘缺 `{}`。  
`true?.extract_pos(...)` 或 `{ }?.extract_pos(...)` → **is not a function**。  
現況 **不是** 官方帶 `extract_pos`／`hide` 的物件（否則不會報這兩句）。

未在程式裡放 `{}` stub；問題是 **`false` 擋不住 JSROOT 之後重設的殘缺 truthy**。

## 2. setTooltipAllowed

`painter.setTooltipAllowed(false)` 若存在會呼叫。不能保證它把 `control.tooltip` 設成 null，也不能保證 `J.draw("same")` 後不再長出殘缺物件。必須每次 mute 時 **再清成 null**。

## 3. 正確關閉法

- 若已是官方物件（同時有 `extract_pos` 與 `hide` 函式）：先 `hide()`，再 **`tooltip = null`**。  
- 否則直接 **`tooltip = null`**（painter、painter.ctrl、control）。  
- **禁止** `{}`、`false`、只有 `return false` 的假 tooltip。  
- 04_3 的 `muteControlHover`（mute `processMouseMove`／`delayedProcessMouseMove`、保留 orbit `lstn_mousemove`）留下，與清 tooltip **合成一套** `clearTooltipOn`，不再兩套 stub。

## 4. picking 與 Message

`pickAtClient` 是射線對 64 格點，**不經** tooltip。Message／著手紀錄在 UI。關掉 tooltip 後落子與 capture 顯示應仍獨立可用。

`resolveStack` 若還在：屬 control listener，**04_4 範圍外**，不改規則。

---

## 驗收（使用者自測）

1. 重啟專頁、滑入 3D、停在球上：無 `extract_pos`／`hide` error。  
2. 仍可點格；Message 正常；capture 後球消失。  
3. resolveStack 若還在，不要為了它改規則。
