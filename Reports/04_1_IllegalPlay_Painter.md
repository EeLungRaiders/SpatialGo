# 04_1 非法落子與 TGeoPainter resolveStack

**性質：** 調查 + 修法選擇。未改工作樹（patch 已移除，原 `Prompts/patches/04_1_*`）。  
**skill：** `Skills/diff-change-workflow/SKILL.md`

---

## A. 非法 play 會不會 redraw？

**不會走 `drawAll`／`clearDom`／`resetView`。**

`Rules.play` 失敗只 `fail(state)` 回傳 **原局面 clone**，不改 caller 的 `session.state`。

UI `onPlayRequest`：

- `ok` → `afterStateChange` → `boardCtrl.render` → `drawAll`（**合法提子才全量重建**）
- `!ok` → 只 `setMessage` + `refresh()`  
  `refresh()` 只改 chrome（banner／log／鈕），**不**呼叫 `boardCtrl.render`

Render controller 的 fallback `onPlayRequest` 在有 `playHandler`（UI 已傳入）時直接 return，也不 redraw。

因此「點自殺點才卡住」**不是**非法手又抽了一次 canvas。卡住發生在 **前一次合法 `drawAll` 之後**，滑鼠仍打在半殘／剛重建的 `TGeoPainter.processMouseMove` 上。

額外觸發（view 模式）：`onUp` 在 **非 Place** 時**每次 click 都會** `scheduleReattachStonesAfterOrbit`。合法提子後 `exitPlaceMode` 回到 view，再點自殺格 = 一次 extras wrap／刪容器，同時 mousemove → `ClonedNodes.resolveStack`。Pass／Undo 會再走完整 `drawAll`，所以能「恢復」。

---

## B. `stoneExtras … mesh=0`

`countExtrasMeshes` 只認 `isMesh`／`isInstancedMesh`／`type` 含 `"Mesh"`。  
JSROOT 這套 THREE 上 extras 常是 **Group／Object3D，沒有 `isMesh` 旗標**，`getExtrasContainer("get","goStones")` 仍可能有子節點。

提子「有作用」（球從 state 重建後消失）表示 **Eve 樹有建、drawExtras 有跑**；`mesh=0` **較像計數別名，不是一定沒掛上**。

修法：log 改為 `mesh` + `extrasNodes` + `hasContainer`。有 container 且 `extrasNodes>0` 而 `mesh=0` 印「mesh flag alias」，不再當成沒掛上。若 `hasContainer=false` 才 warn 真缺 extras。

不因此改成 `J.draw(stones)` 第二個 main。

---

## C. mousemove vs clearDom

`drawAll` 一開始就 `clearDom()`（拆 canvas、`painters=[]`），然後長 `drawSeq`，最後才 `attachStones`。  
JSROOT 在第一條 `TPolyLine3D` draw 後就會把 `processMouseMove` 綁上新 canvas。  
**clearDom 之後、extras／clones 齊之前**，mousemove 會進 `resolveStack` 讀 undefined。

合法提子必經這段；緊接著點自殺／移動滑鼠就爆。與 Reset 後 extras 被砍是同一類，不是規則 bug。

---

## 選案

**主方案（本 patch）：**

1. 非法 `!ok`：**維持**只 Message，註解寫死禁止 render（UI 行為已正確）。
2. `drawAll`：generation token 丟掉過期鏈；從舊 painter 起到 extras 掛完，**暫時**把 `processMouseMove` 換成 no-op，then／catch **還原**。不改 `select_in_view`，不常駐 wrap `drawExtraShape`。
3. view 模式：**只有真的拖曳 orbit** 才 reattach extras，單純 click（含點在自殺格）不再 wrap extras。
4. extras log：分清計數別名 vs 真缺 container。

備案（不採用）：非法點格不進 `play`——規則已正確拒絕，問題在 3D 重建窗，不是 play 排程。

非目標：不改自殺規則、不靠 Pass／Undo 當修法、不永久關掉 OrbitControls。
