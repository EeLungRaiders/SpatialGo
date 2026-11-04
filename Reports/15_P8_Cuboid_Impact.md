# 15 P8 長方體棋盤影響評估

**性質：** 只讀。未改程式、未產 patch、未寫 apply／Plans。功能**尚未批准實作**。  
**現況：** 等邊立方 `N=1..9`；顯示座標一律 `user=2*index-(N-1)`（14_2）。  
**11 暫停／不做仍有效。**

---

## 1. 一句話分級

**大：** 要把單一 `state.size` 拆成三軸 `sx,sy,sz`，state／coords／board3d／record／scoring／UI／測試幾乎全動；**Rules 六鄰本體可不動**（仍走 `inBounds` + `DIRS`）。

---

## 2. 現況「一個 size」出現點

| 檔 | 函式／常數 | 假設 |
|----|------------|------|
| `state.js` | `MIN/MAX/DEFAULT_SIZE`、`clampSize`、`inBounds`（三軸同一 `n`）、`emptyBoard(n)` 三層同長、`newGame({size})`、`clone.size` | 立方 |
| `coords.js` | `sizeN()` 單一 n；`toUser`／`fromUser` 三軸共用 n；`ix>=n && iy>=n && iz>=n` | 立方 |
| `board3d.js` | `nNow()`／`halfNow()`；`worldOf` 三軸同一 `h`；`createCubeFrame` ±h；`createAxisRays` `L=max(2.4,1.6*(n-1))`；格線／空點／建球／picking 三重 `nNow()`；extras `nNow³` | 立方 |
| `scoring.js` | 迴圈 `n = state.size`；對帳 `cells === n³` | 立方 |
| `record.js` | JSON `size` 單一整數；Load 1..9；`fromUser(..., s.size)` | 立方 |
| `ui/controller.js` | 一個 `select` 1–9；banner `N×N×N` | 立方 |
| `*_cases.js` | `newGame({size:5})`、`accountN(..., 125)`、`size:10` 失敗 | 立方 |

`rules.js`：`DIRS` 六鄰與 `inBounds(state,x,y,z)` — **沒有自己寫死 N**，但 `inBounds` 目前三軸同 n。

---

## 3. 座標／中心格

14_2 公式 **每軸各自套自己的 n 就夠**：

```text
user_x = 2 * ix - (sx - 1)
user_y = 2 * iy - (sy - 1)
user_z = 2 * iz - (sz - 1)
```

顯示六鄰仍 ±2 沿**一**軸；flood 仍內部 ±1。

**(0,0,0) 是格點** ⇔ 該軸 `2*index = n-1` ⇔ **該軸 n 為奇數**。  
三軸都是奇數（如 3×5×9）才有幾何中心可下。  
**4×5×5：** X 偶、YZ 奇 → 沒有顯示 (0,0,0) 格（X 沒有 0）。  
**4×4×5：** 只有 Z 有 0，中心仍不是格點。

`fromUser` 必須帶 `(sx,sy,sz)`，不能只讀一個 `sizeN()`。

---

## 4. 3D／picking

須改成三個長度（建議 `nx(), ny(), nz()` 或 `state.sizeX/Y/Z`）：

| 段 | 現況 | 長方 |
|----|------|------|
| 格線 | 每軸 `nNow()` 條 | X 向：sy×sz 條，各 sx 點；Y／Z 類推 |
| AABB／外框 | ±(n-1)/2 | ±(sx-1)/2, ±(sy-1)/2, ±(sz-1)/2 |
| 軸長 | `1.6*(n-1)` | 跟**最長半邊**或分軸外伸，避免短軸立方被最長軸吃掉畫面 |
| picking | N³ 點 | **sx×sy×sz**；閾值仍 ~0.45×CELL |
| extras | `nNow³` 預算 | 體積 `sx*sy*sz`（9×9×9=729 仍遠低於 2e6） |
| Reset framing | 第一筆 polyline AABB | 外框須含整個長方，否則相機只框到短邊 |

`worldOf`：`X=ix-(sx-1)/2` 等，CELL=1 可維持。

---

## 5. record／scoring／UI

**Record：** 現在 `size: 4` 整數。建議新譜 `size: [sx,sy,sz]`（或 `{x,y,z}`）。  
舊譜單一數字：評估上 **可當立方讀**（`[n,n,n]`），與現有 N=4／N=5 JSON 相容；拒讀會弄丟 14 之後的檔。建議在 Plan 裡讓使用者選（見文末第 3 題）。

**Scoring：** 對帳 `活子+terr+dame === sx*sy*sz`。flood 已用 `inBounds`，改 inBounds 即可。

**UI：** 三個 select（或三個數字）最清楚；1×1×1 仍自殺 demo。若先做「資料層三軸、UI 仍一個 N」可減第一刀風險。

---

## 6. 風險

- **扁平 1×9×9：** 看起來像一層平面，氣／提子仍是六鄰；Z=1 時 ±z 越界，該層子更容易無氣／自殺。
- **某軸=1：** 該軸沒有鄰居，角點氣更少；1×1×N 幾乎是線。
- **Load `size:5`：** 若不做立方相容，所有 14 譜失敗。
- **相機／軸：** 最長軸拉開 Reset 框，短軸格子變小；extras 本身 729 球不是主風險。
- **測試面：** 幾乎所有 cases 假設立方，要加長方向量與回歸 N=4。

---

## 7. 建議下一步

**可以進行，但先寫 Plan，不要直接 apply。**

建議每軸上限先 **1..9**（與立方相同；9×9×9=729 仍在 extras 預算內）。  
建議分兩步：

1. 資料層 `sizeX/Y/Z`（或 `size:[sx,sy,sz]`），UI 仍一個 N 寫成三相等（回歸容易）。  
2. 再開放三個 select。

建議下一份：**`Prompts/16_P8_Plan_CuboidData.txt`**（本 15 不寫 16 apply）。

---

## 8. 給使用者的三題（不當已批准實作）

1. **是否同意分級為「大」？**
2. **每軸上限是否先跟立方一樣 1..9？**
3. **舊 JSON 只有一個 `size` 數字：當立方讀，還是拒？**
