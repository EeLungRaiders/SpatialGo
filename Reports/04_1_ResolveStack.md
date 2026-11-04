# 04_1 resolveStack after every redraw

**skill：** `Skills/diff-change-workflow/SKILL.md`  
**範圍：** 合法第 2 手之後 mousemove 即 throw。04 提子規則不改。舊「只禁非法手重畫」假設已否證、已 reverse，本檔不再用那條。

---

## A. clearDom 與舊 mousemove

**是。** 每手 `afterStateChange` → `boardView.redraw` → **`drawAll` → `clearDom()`** 拆掉 canvas 與 `painters[]`。  
JSROOT 的 `lstn_mousemove`／`delayedProcessMouseMove` 掛在 **controls／document／舊 canvas**，不會因 innerHTML 清空而取消 timeout。  
新 painter 的 dummy `TPolyLine3D` clones 與 highlight stack 對不上 extras 球；mousemove → `ClonedNodes.resolveStack` 讀 `undefined['0'|'1'|'2'|'3']`。  
Pass／Undo／Reset 再走完整建 painter，所以能恢復。

## B. mesh=0

**計數別名為主。** `countExtrasMeshes` 只認 `isMesh`。JSROOT extras 常是沒設該旗標的 Object3D。球來自 **同一 TGeoPainter 的 `drawExtras("goStones")`**（state → Eve 樹 → extras），不是第二個 `JSROOT.draw`。有子時球仍可看見。log 改為 `mesh`／`extrasNodes`／`hasContainer`。

## C. 自訂 picking 是否已夠？

**夠。** `pickAtClient` 是相機射線對 64 格點吸附。落子不靠 JSROOT tooltip／highlight。  
因此可以（且應該）用 painter API **關掉 tooltip／highlight**，讓 `processMouseMove` 不再 `resolveStack`。這不是去改 `select_in_view`／`_clones.setMaxVisNodes`。

## D. 禁用手段現況

| 手段 | 現況 |
|------|------|
| 常駐 wrap `drawExtraShape` | **無**；僅 attach extras 期間暫時 wrap，then/catch 立刻還原 |
| `select_in_view` | **未改** |
| `_clones.setMaxVisNodes` | **未改** |

---

## 主修法 / 備修法

**主修法（本 patch）**

1. **落子 `redraw`：不再 `clearDom` 整棵 painter。** 格線 painter 常駐；只依 state 重建 extras 容器 `"goStones"`。  
2. **關 tooltip／highlight**（`setTooltipAllowed(false)`／`ctrl.tooltip=false`／`highlightMesh(null)`）。  
3. 若仍必須 `clearDom`（初次 mount）：先摘 `lstn_mousemove`、清 delayed timeout，再拆 DOM。  
4. view 模式只有 **拖曳 orbit** 才 reattach extras（單純 click 不再 wrap）。  
5. extras log 分清別名 vs 真缺 container。

**備修法（未做）：** 繼續每手全量 `clearDom`，只靠暫時摘 mousemove。無法從根本上避免 dummy clones 與 extras 不一致。

不改 `rules.js`。不 reverse 04 提子。

---

## 套用後手動驗收（使用者自己開專頁）

1. 內部座標：B(3,0,3) W(2,0,3) 之後滑過立方體，無 `resolveStack`。  
2. 接到第 6 手 W(3,1,3) 提掉 (3,0,3)；再點該格拒自殺，仍可轉。  
3. 有子時 log 不應只有 `mesh=0` 而無 `extrasNodes`／`hasContainer`。  
4. Reset view 後子還在。  
5. 提子／劫／兩 Pass `ended` 與 04 相同。
