# 05_1 三軸參考線

**skill：** `Skills/diff-change-workflow/SKILL.md`  
**選定：備案（三條 TPolyLine3D）。** 不與 `setAxesDraw` 並存。

## 為什麼不用主方案 setAxesDraw(2)

GrokBuild **不能開瀏覽器** 驗 A–D。程式上：

- 現況 painter 由 **TPolyLine3D** 建立（`drawSeq` 第一筆外框），本檔 **沒有** `setAxesDraw`／`drawAxes` 呼叫，也不保證此 painter 有該 API。
- JSROOT 的 `setAxesDraw` 往往會 **redraw 主幾何**；與 04.x **常駐格線 + extras 增量** 衝突（extras 易被拆、AABB 被軸框帶走）。
- 禁止 `JSROOT.draw(TAxis3D)`（會變成第二次 main）。

因此直接備案，避免套用後才發現軸把 extras 弄掉。

## 備案怎麼對齊世界原點

- `worldOf` **不改**：格點 (0,0,0) 在世界 `(-1.5,-1.5,-1.5)`；立方體中心／顯示 (0,0,0) 是世界 **(0,0,0)**。
- 三軸：`X/Y/Z ∈ [-2.4, 2.4]`，穿過 (0,0,0)，比立方體 ±1.5 長。
- ROOT 線色：X=2 紅、Y=3 綠、Z=4 藍。
- 畫在 12 邊外框之後、格線之前，**同一 `drawSeq`**。格線 painter 常駐，落子 **不** 重畫軸。
- 無 3D 字標（沒有穩定 TText3D）。不能點來落子（picking 仍只 64 格）。

套用後請使用者驗報告 §驗收 A–D（交於盤心空隙、旋轉仍交一點、extras／滾輪不退步、點軸不下子）。Reset View 方位只記：右上 +X、左上 +Y、層間 +Z。

## 驗收（使用者自測）

1. New Game／Reset View：三軸交於盤心空隙。  
2. 旋轉仍交一點；紅／綠／藍對 +X／+Y／+Z。  
3. 滾輪、左鍵、右鍵仍在；點軸不下子。  
4. 落子／提子／Undo／顯示座標與 05 相同。  
5. 無新的 tooltip.hide／extract_pos。
