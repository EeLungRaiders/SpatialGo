# 04_5 tooltip stub + 滾輪縮放

**skill：** `Skills/diff-change-workflow/SKILL.md`  
不 reverse 04／04_2。04_3／04_4 當現況。本 diff 單獨 reverse。

---

## A. control.tooltip 現況

04_4 的 `clearTooltipOn` 把 **`painter.tooltip`／`ctrl.tooltip` 設成 `null`**。  
`base3d.mjs` `mainProcessMouseLeave` 約 1290 行是 **`this.tooltip.hide` 沒有 `?.`** → `Cannot read properties of null (reading 'hide')`。  
不是官方物件，也不是缺 `hide` 的 `{}`；就是 **null**。

## B. wheel 綁在哪、誰摘掉？

JSROOT `createOrbitControl` 在 **`renderer.domElement` 另綁 `wheel`**（`settings.Zooming && settings.ZoomWheel`），與 tooltip 無關。  
左鍵／右鍵仍在，代表 OrbitControl 物件還在。

本檔 **沒有** `removeEventListener('wheel')`。mute 只摘 `mousemove`／`pointermove`。  
較可能弄丟縮放的是：

1. **`setOrbitEnabled`** 在 Place 時 `enabled=false`，回來只設 `enableRotate`，**不設 `enableZoom`**。  
2. `J.draw("same")` 重綁 controls 後，wheel 需再掛到 **同一個** `renderer.domElement`。

## C. 修復 tooltip

用方法齊全的 no-op：`{ hide(){}, extract_pos(){ return null; } }`（另加空的 `show`／`check`）。  
**禁止再設 `null`／`false`／沒方法的 `{}`。**

## D. 接回 wheel

- `setOrbitEnabled(true)` 時 **`enableZoom = true`**。  
- `restoreOrbitWheel`：若 control 上有 `lstn_wheel`／`_onMouseWheel` 等，重新 `addEventListener('wheel')` 到 `renderer.domElement`。  
- mute **不摘 wheel**。不開 TGeo highlight／`select_in_view`。

`resolveStack` 非 04_5 必清。

---

## 驗收（使用者自測）

1. 滑入／離開 3D：無 `hide`／`extract_pos` error。  
2. 滾輪可縮放；左鍵轉、右鍵移仍在。  
3. 不需要浮層文字。  
4. capture 後球仍消失。  
5. resolveStack 若還在：非 04_5 必清。
