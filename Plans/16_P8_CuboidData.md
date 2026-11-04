# 16 P8 Plan：長方體資料層（UI 仍立方）

**階段：** 只寫計畫。未改程式、未產 patch。  
**準據：** `Reports/15_P8_Cuboid_Impact.md`；使用者：分級大、每軸 1..9、舊 JSON 單一 `size` 當立方。  
**11 暫停／不做仍有效。** 14_2 顯示間距 2 維持，改為**每軸各自 n**。  
**本步不做** 三個 select、長方 UI、相機特例、切層 2D、改提子公式。

**通過定義：** 選 N=4／5／9、Load 舊 `size:4`／`size:5` 譜，行為與 16 之前相同。

---

## 1. 範圍

**做：** `state`／`coords`／`inBounds`／`worldOf`／格線迴圈／scoring 對帳／record 改成三軸長度。  
UI **仍一個** N select；`newGame` 寫成 `sizeX=sizeY=sizeZ=N`。畫面必須仍是等邊立方。

**不做：** 開放長方對局入口。長方只允許測試呼叫 `newGame({sizeX:4,sizeY:5,sizeZ:5})`。

---

## 2. 資料形狀

```text
state.sizeX, sizeY, sizeZ     ∈ [1,9]
state.size                    僅當三軸相等時 = 該邊長，否則不要拿來做三軸迴圈
                              （UI 本步永遠相等，size === sizeX）
emptyBoard(sx, sy, sz)
inBounds: 0≤x<sizeX, 0≤y<sizeY, 0≤z<sizeZ
```

`newGame({ size })`：仍支援，展開為三軸同 N（回歸）。  
`newGame({ sizeX, sizeY, sizeZ })`：測試用；缺的軸填 `size` 或 4。  
`clampSize` 每軸 1..9。

---

## 3. 座標

```text
user_x = 2 * ix - (sizeX - 1)
user_y = 2 * iy - (sizeY - 1)
user_z = 2 * iz - (sizeZ - 1)
index  = (user + n - 1) / 2     # 該軸 n，須整除且 ∈[0,n)
```

`toUser`／`fromUser` 吃 `(sx,sy,sz)` 或從 `state.sizeX/Y/Z` 讀。禁止三軸共用一個 `sizeN()`。  
**(0,0,0) 是格點 ⇔ 三軸皆奇。** 本步 UI 立方：奇數 N 中心可下（N=1 自殺拒）；偶數無中心。

顯示六鄰 ±2 沿一軸；flood 仍內部 `DIRS` ±1。`worldOf`／CELL=1 維持；`X = ix - (sx-1)/2` 等。

---

## 4. 3D（資料參數化，不修扁平相機）

- 格線：X 向 `sizeY×sizeZ` 條（各 `sizeX` 點），Y／Z 類推
- 外框 AABB：±(sx-1)/2, ±(sy-1)/2, ±(sz-1)/2
- picking：**sx×sy×sz** 點，閾值仍 ~0.45
- extras 預算用體積 `sx*sy*sz`（不是寫死 n³）
- 軸長本步 **暫用 max(sx,sy,sz)** 的現況公式 `L=max(2.4, 1.6*(nMax-1))`；不修扁平相機

換 N 仍走 New Game／Load 的完整 `drawAll`。

---

## 5. scoring／record

- 對帳：`活子 + terr + dame === sizeX*sizeY*sizeZ`
- 新譜：`"size": [sx, sy, sz]`
- 讀到**數字** `n` → `[n,n,n]`（舊 14 譜）
- 陣列長度不為 3、非整數、或任一軸∉[1,9] → **整檔失敗**
- Export 本步因 UI 立方，寫 `[N,N,N]` 即可

---

## 6. UI（本步）

維持一個 N select 1–9，預設 4。  
`newGame({ size: N })` → 三軸皆 N。banner 仍 `N×N×N`。  
**沒有** 三個 select。

---

## 7. 檔案分派

| 路徑 | 本步 |
|------|------|
| `state.js` | sizeX/Y/Z；emptyBoard(sx,sy,sz)；inBounds 分軸；newGame 雙入口 |
| `coords.js` | 每軸 n；fromUser 三長度 |
| `board3d.js` | nx/ny/nz、worldOf 三分、格線／picking／extras 體積 |
| `scoring.js` | 對帳體積 |
| `record.js` | size 陣列；整數當立方 |
| `ui/controller.js` | **仍一個 N**；newGame({size:N}) |
| `*_cases.js` | 立方回歸 Z4／Z5／Rec 舊整數 size；加 `newGame({sizeX:4,sizeY:5,sizeZ:5})` 內部可建盤（UI 測不到） |
| `rules.js` | **不改** DIRS／提子 |

---

## 8. 測試

| # | 要點 |
|---|------|
| Z4 | 預設／N=4：角顯示 (-3,-3,-3)；fromUser(0,0,0) null |
| Z5 | N=5：中心 (0,0,0) 可下 |
| Rec4／Rec5 | Load 舊 `{size:4}`／`{size:5}` 成功，盤面與 16 前相同 |
| RecArr | `{size:[4,4,4]}` 與整數 4 等價 |
| RecBad | `{size:[4,5]}` 或軸 10 → Load 失敗 |
| IntC | `newGame({sizeX:4,sizeY:5,sizeZ:5})`：`inBounds(3,4,4)`、`!inBounds(4,0,0)`；無 (0,0,0) 格（X 偶） |

---

## 9. 建議下一份

```text
Prompts/17_P8_Apply_CuboidData.txt
```

再下一份才是 **18 UI 三 select**。

---

## 10. 請使用者批准的是非題

1. **是否批准本資料層 Plan？**
2. **record 用 `size:[sx,sy,sz]`、舊整數當立方，可以嗎？**
3. **本步 UI 仍一個 N，可以嗎？**

請回覆例如：「1 批准；2 陣列＋舊整數當立方；3 UI 仍一個 N。」
