# 05_2 軸加長與正向箭頭

**skill：** `Skills/diff-change-workflow/SKILL.md`  
05_1 已選 **備案 TPolyLine3D**（非 `setAxesDraw`）。本檔繼續該路徑，**沒有**內建軸可關。

| | 舊（05_1） | 新 |
|---|------------|-----|
| 軸端到原點 | **L = 2.4** | **L = 4.8**（約 2L） |
| 穿過原點 | ±兩側 | 不變 |
| 箭頭 | 無 | 只在 **+X／+Y／+Z** 端，各四條短翼（YZ／ZX／XY 平面） |
| 色 | ROOT 2／3／4 | 不變 |
| 作法 | `TPolyLine3D` | 同物件類型，同一 `drawSeq` |

未用 `setAxesDraw`、未用 `THREE.ArrowHelper`／`ConeGeometry`。負向只是線。

AABB 含 ±4.8，Reset View 會把軸納入框；立方體 ±1.5 仍在畫面內，只是比 05_1 小。若框太「只剩軸」，再縮 L。

picking 仍只 64 格；軸／翼不是交叉點。

## 驗收（使用者自測）

1. 三軸仍交盤心；明顯比 05_1 長。  
2. +X／+Y／+Z 有同色箭頭；負向可以只是線。  
3. Reset View 仍看得見整顆立方體。  
4. 旋轉、滾輪、落子／提子／顯示座標不退步；點軸不下子。
