# 04_3 落子即 resolveStack（control.lstn_mousemove）

**判定：04_3 修。**  
`stoneExtras ok` 卻 `hasContainer=false` 是迴歸；throw 來自 **controls** 的 hover，不是 04_2 mute 的 `painter.processMouseMove`。可用現成 API／摘 hover，不必改 JSROOT 核心、不必用那套禁用手段。

**skill：** `Skills/diff-change-workflow/SKILL.md`  
不 reverse 04 提子、不整份 reverse 04_2。本 diff 單獨 reverse 回到 04_2 之後。

---

## A. extras container missing

`wipeNamedExtras` 在 `drawExtras` 前 `getExtrasContainer("delete")`，又用 **`name.indexOf("goStones")===0` 掃整個 scene**，可能把 extras **父容器**拆掉。自訂 wrap 的 `addToExtrasContainer` 在沒有容器時失敗，audit 仍印 **ok**。  
`state=1 tree=1 extrasNodes=0 hasContainer=false`：Eve 樹有建，**沒掛回同名容器**。畫面上那顆球多半是 add 進 scene 根、或不在 `goStones` 名下的殘留 mesh，不是合法 extras 容器。  
04_3：wipe 只刪**精確** `goStones`；wipe 後 `getExtrasContainer("create")`；wrap 先 `ensureExtrasContainer` 再 `add`；沒容器不得標 ok。

## B. painter mute vs control.lstn_mousemove

**不同物件。** 04_2 mute 的是 `painter.processMouseMove`／`painter.lstn_*`。  
實際 stack：`control.lstn_mousemove` → `mainProcessMouseMove` → `delayedProcessMouseMove` → **`#controls.processMouseMove`**（`base3d.mjs`）。  
`refreshEmptyMarkers` 的 `J.draw(..., "same")` 與 `drawExtras` 會把 **control** 的 hover listener／timer **接回去**。

## C. delayedProcessMouseMove

**會。** control 上的 delayed timer 在 wipe／`J.draw("same")` 後仍可能打舊 clones。04_3 對 control `clearTimeout` 並把 `delayedProcessMouseMove`／`processMouseMove` 換成 no-op。  
**不摘** `control.lstn_mousemove`（那條還開 orbit）。

## D. 「以前落子不 throw」

對應 **每手 `drawAll`＋`clearDom` 換新 canvas**（舊 control 隨 DOM 死掉）。  
04_1 起格線 painter 常駐＋增量 extras；04_2 又 `J.draw("same")` 重綁 control hover → **第一手起**每手 mousemove 都炸。

## E. picking vs TGeo highlight

自訂射線 picking **已足夠**。可在取得 controls 後關 tooltip，並 mute **control** 的 `processMouseMove`／`delayedProcessMouseMove`。不是 `select_in_view`、不是 `_clones.setMaxVisNodes`。

---

## 主修法

1. wipe 後必須再建 `goStones` 容器；有子時 `hasContainer=true` 才標 ok。  
2. mute **control** hover（保留 orbit 的 `lstn_mousemove`）。  
3. `J.draw("same")` 空點後再 mute 一次。  

不改 `rules.js`。04_2 的 capture 顯示不得退步。

---

## 套用後手動驗收

1. 第一手後滑過立方體：理想無 `resolveStack`。若還有，看是否仍是 `control.lstn_mousemove` 裡別的函式。  
2. 有子時不得再 `ok`＋`hasContainer=false`。  
3. capture 球消失、空點回來。  
4. Undo／Reset view 可用。
