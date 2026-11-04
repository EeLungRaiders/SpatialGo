# 13 P7 Plan：等邊立方體 N=1..9

**階段：** 只寫計畫。未改程式、未產 patch。  
**11 暫停／不做仍有效。** 12_x 換色保留。只做立方，不做長方體、不做 N>9、不做中局改 N。

---

## 1. 目標與非目標

**目標**

- New Game 可選 **N∈[1,9]**，三軸皆 N；**預設 4**
- `state.size` 為該局邊長；廢除處處寫死常數 4／對帳 64
- 座標奇偶兩套（見 §2）；奇數中心 (0,0,0) 可下
- **1×1×1：** 唯一格點顯示 (0,0,0)；`play` **自殺拒**（六鄰皆越界、無氣）。只當空盤 demo
- 棋譜 `size` 為該局 N；Load `newGame({size:N})`；缺或非 1..9 整檔失敗
- 計分對帳 `活子+terr+dame === N³`
- 軸隨立方體外伸；picking 對 **N³** 格點；extras 預算跟 N 走

**非目標：** 矩形／長方體、N>9、中局改 N、切層 2D、SGF、第二套計分、Firefox 相機、超劫。

規則六鄰／提子／劫／komi 6.5／標死／換色 **不變**。

---

## 2. 顯示座標（兩套，勿混）

內部 `index ∈ {0,…,N-1}`。`worldOf` 置中：`(index - (N-1)/2) * CELL`，**CELL=1**。

| N 奇偶 | 公式 | 間距 | 中心 |
|--------|------|------|------|
| **偶** | `user = 2*index - (N-1)` | **2** | 無格點 (0,0,0) 不能下 |
| **奇** | `user = index - (N-1)/2` | **1** | (0,0,0) **可下**（N=1 除外：可下但自殺拒） |

`fromUser`：反解須為整數且 ∈[0,N)；否則 null。

例：

| N | 一軸內部 | 一軸顯示 |
|---|----------|----------|
| 1 | 0 | **0** |
| 4 | 0 1 2 3 | **-3 -1 1 3**（不變） |
| 5 | 0 1 2 3 4 | **-2 -1 0 1 2** |
| 9 | 0…8 | **-4…4** |

偶數顯示六鄰仍 ±2；奇數顯示六鄰 ±1。程式 flood **只走內部 DIRS ±1**。

`Coords.toUser/fromUser` 必須吃 **該局 `state.size`**，不要只讀模組常數 `State.SIZE=4`。

---

## 3. State / New Game

- `MIN_SIZE=1`、`MAX_SIZE=9`、`DEFAULT_SIZE=4`
- `newGame({ size, komi })`：size 鉗到 [1,9] 整數，否則 4
- `emptyBoard(n)` 三層皆 n；`inBounds` 用 `state.size`
- 模組可留 `State.SIZE` 當預設別名，**對局真相是 `state.size`**
- 中局改 N：不提供；換 N 只經 New Game（或 Load 的 size）

UI：New Game 旁 `<select>` 1–9，預設 4。色盤仍 12_x。New Game 讀 select 再 `newGame({size})`。

---

## 4. 1×1×1

- 一格，顯示 (0,0,0)，世界原點
- 六鄰皆 OOB → 氣 0 → `isLegal` false、`play` `illegal suicide`
- 可 New Game 看空盤／軸／座標；不能落子、不能正常終局對弈
- 測試必寫：`Rules.play(newGame({size:1}),0,0,0).ok===false`

---

## 5. 3D／picking／extras

- `board3d` 迴圈、格線、`HALF=(n-1)/2` 全用 `state.size`
- `PICK_DIST ≈ 0.45 * CELL`；吸附 **N³** 點
- 軸長隨半邊外伸（現況 L=4.8 對 N=4、半邊 1.5；建議 `L ≈ 2.4 * (N-1)` 或 `max(2.4, 1.6*(N-1))`，Reset 仍看得見整顆立方體）
- extras：`numfaces` 高上限維持；`nTree` 用實際子數；建樹 z,y,x 與 audit 跟 N
- N=9 滿盤 729 球 × ~384 face ≈ 2.8e5 ≪ 2e6

---

## 6. 計分／棋譜

- `scoring.js`：`cells === n*n*n`，不要寫死 64
- `record.js`：頭 `size: N`；Load 校驗 1..9 整數後 `newGame({size:N, komi})`；`size` 缺／非整／越界 → 整檔失敗
- 著手仍 `coords:"user"`，`fromUser(..., n)`

---

## 7. 檔案分派

| 路徑 | P7 |
|------|-----|
| `state.js` | `size` 1..9；emptyBoard(n)；newGame({size}) |
| `coords.js` | 奇偶兩套；n 來自引數／該局 |
| `board3d.js` | n 動態；軸長；picking N³ |
| `scoring.js`／scoring_cases | 對帳 N³ |
| `record.js`／record_cases | size 欄；Load newGame(N) |
| `ui/controller.js` | select 1–9；New Game 讀 N |
| `rules_cases.js` | N=1 自殺；N=5 中心可下；N=4 回歸 |
| `coords_cases.js` | N=4 表不變；加 N=1／N=5 |
| AGENTS／README | apply 時短句 |

不改：`rules.js` 六鄰／提子／劫本體（自殺已涵蓋 N=1）；SetSV；board2d；SGF。

---

## 8. 測試向量

| # | 要點 |
|---|------|
| Z1 | `newGame({size:1})`；`play(0,0,0)` 拒 suicide；`isLegal` false |
| Z5 | N=5 中心內部 (2,2,2)＝顯示 (0,0,0) 可下 |
| Z4 | N=4 角顯示 (-3,-3,-3)；中心 (0,0,0) `fromUser` null |
| S9 | N=9 `inBounds(8,8,8)`；`!inBounds(9,0,0)` |
| Acc | 任意 N：`活子+terr+dame === N³` |
| Rec | JSON `size:5` Load 後 `state.size===5`；`size:10` 失敗 |

---

## 9. 建議下一份

```text
Prompts/14_P7_Apply_CubeSize.txt
```

批准後才寫／執行。走 `diff-change-workflow`。

---

## 10. 請使用者批准的是非題

1. **是否批准本 Plan？**
2. **N=1..9、只立方、預設 4，可以嗎？**
3. **1×1×1 僅 demo、禁止落子，可以嗎？**

請回覆例如：「1 批准；2 N=1..9 立方預設 4；3 1×1×1 只 demo。」
