# 04_2 顯示與 state 不同步 + 每手 resolveStack

**前提（使用者已證實，不當假說）：**  
`Rules.play` 與 `board[]` 正確。Message 有 capture；被提格 state 為空、可再下。不要改規則配合畫面。要修的是 extras／painter／mousemove 與 state 不同步。

**skill：** `Skills/diff-change-workflow/SKILL.md`  
**04 提子：** 保留，不 reverse。  
**04_1：** 仍在樹上（格線 painter 常駐、extras-only redraw、`setTooltipAllowed`）。未解決本題；04_2 改同一 `board3d.js` 路徑，diff **可單獨 reverse** 回 04_1。

---

## A. afterStateChange → redraw → clearDom？

**落子路徑不再每次 clearDom**（04_1）。UI `session.state = r.state` 後 `boardCtrl.render(session.state)`，用的是 **play 回傳的新 state**，不是舊參考。  
`redraw` 只 `attachStonesToGeoPainter`。  
`clearDom` 仍用於初次 `drawAll`／destroy；那時會 `silencePaintersMouse`，但 **04_1 沒有在增量 redraw 上摘掉仍活著的 `lstn_mousemove`**。highlight／`_clones` 在常駐 dummy geom 上本來就不含 extras 球，mousemove 仍 `resolveStack`。

## B. buildStonesGeoExtract

**只掃當前 `state.board`，空格不建球，沒有舊子列表快取。**  
顯示不同步不是 extract 快取，而是 **scene 裡舊 extras mesh 沒被真正拿掉**（只呼叫 `getExtrasContainer("delete")` 不夠）加上 **空點 `TPolyMarker3D` 只在初次 drawAll 畫一次，提子後淡標記不更新**。

## C. mesh=0

**計數別名仍可能**（`isMesh` 未設）。同時：若 delete 沒拆 THREE 子節點，舊球還在 scene，看起來像「沒提掉」。不是第二條 `JSROOT.draw(stones)`。04_2 對 scene 按名 `goStones` 再掃一次移除，並把 log 的 `extrasNodes`／`hasContainer` 當判準。

## D. 自訂 picking

**夠。** 射線吸附 64 格。04_1 只關 `tooltip`／`highlightMesh`，**JSROOT 仍把 `lstn_mousemove` 綁在 canvas**，且 `bind` 住的可能是舊 `processMouseMove`。  
04_2：把 `processMouseMove` 換成 no-op，並從 canvas／renderer／document **removeEventListener**。不改 `select_in_view`、不改 `_clones` 上限。OrbitControls 另走 pointer，應仍可轉。

## E. 04_1 做了什麼、為何仍每手 throw；04_2 留／改

| 04_1 留下 | 04_2 改 |
|-----------|---------|
| 格線 painter 常駐；落子不 `clearDom` | 仍常駐 |
| extras-only redraw | **wipe scene 舊 `goStones`** 再掛新 extras |
| `setTooltipAllowed(false)` | **不夠** → mute `processMouseMove` + 摘 `lstn_mousemove` |
| 空點 marker 不更新 | 刪 scene 上 Points，再 `"same"` 畫當前空點 |
| 暫時 wrap `drawExtraShape` 後還原 | 維持 |

---

## 主修法

1. 成功 play／undo 仍用回傳 state 重建 extras（UI 已對）。  
2. **wipe** extras 容器 + scene 裡名為 `goStones` 的物件，再 attach；空點 marker 跟 state。  
3. **永久（本 mount）mute** `processMouseMove` 並摘 listener；掛 extras／marker 後再 mute 一次（JSROOT 可能重綁）。  
4. 高 numfaces 暫時 wrap 後立刻還原。

不改 `rules.js`。

---

## 套用後手動驗收（使用者自己測）

1. 下子後立刻滑過立方體：無 `resolveStack`。  
2. Message capture 時被提球消失；該格淡標記回來。  
3. 再下在剛被提空格：可下；若能提對方，capture 且對方球消失。  
4. Undo 提子手：球回來。  
5. Reset view：子還在，無 `resolveStack`。  
6. 有子時 log 看 `hasContainer`／`extrasNodes`，不要只認 `mesh=0`。  
7. 自殺仍拒；規則與 04 相同。
