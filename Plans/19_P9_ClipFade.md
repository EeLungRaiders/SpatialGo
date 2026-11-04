# 19 P9 Plan：觀察窗裁切與淡化（Clip / Fade）

**階段：** 只寫計畫。未改程式、未產 patch。  
**準據：** `Prompts/19_P9_Plan_ClipFade.txt`；資料層 17、長方 UI 18 已套用。  
**11 暫停／不做仍有效：** 切層 2D、Firefox 相機、SGF、第二套計分、超劫。本功能是 **3D 觀察窗**，不是 2D 多層。  
**不要 reverse 17／18。** 規則、棋譜、計分不因裁切改變。

**通過定義（套用後手測）：** 9×9×9 只開一層 z、fade=0 時範圍內子／空點可見；Show all 回整盤；落子／提子／譜與裁切前相同。

---

## 1. 目標與非目標

**目標**

- 每軸一個**閉區間**（內部 index），三軸拉滿＝整盤；某一軸 `x0=x1`＝只實心那一層
- `fade ∈ [0,1]`：範圍外透明度。`0`＝不畫範圍外子／空點；小值＝幽靈子；`1`＝範圍外也實心（視覺上等於沒裁）
- **Show all：** 三軸滿區間，**fade 維持不變**
- 範圍內：現況實心球、格線、ended 著色照畫；範圍內死子仍 `alpha≈0.32`
- 範圍外：fade=0 不建球；死子**不畫**（避免與 0.32 雙淡）
- 軸箭頭永遠全長、不淡
- 點選：範圍外不可落子／不可標死；範圍內不變
- New Game／Load／換尺寸：區間重設為滿範圍
- Slider 只在鬆開（`change`／`pointerup`）重建 extras；拖動中不 `drawAll`

**非目標**

- 切層 2D UI、改 `board[]`／`inBounds`／Rules／Scoring／Record JSON
- 為扁平盤重寫 Orbit、常駐 wrap `drawExtraShape`、改 `select_in_view`、每手 `nvidia-smi`
- 把 clip 寫進棋譜或 `state` 規則欄位
- 第一版不重畫格線隨 clip（見 §5）

---

## 2. 資料放哪裡

**存在 `GoGame.session.clip`，與 `stoneColors` 同類：觀察／外觀，不是對局真相。**

```text
session.clip = {
  x0, x1,   # inclusive internal index, 0 .. sizeX-1
  y0, y1,
  z0, z1,
  fade      # number in [0, 1], default 0
}
```

- `board3d` 讀 `GoGame.session.clip`（缺則視為滿區間、fade=0）
- `inClip(ix,iy,iz)`：`x0≤ix≤x1` 且 y、z 同理；並仍須 `State.inBounds`
- 滿區間：`x0=0, x1=sizeX-1`（y／z 類推）
- 鉗制：每軸 `0 ≤ a ≤ b ≤ n-1`；UI 若 min>max 則交換
- **不要**放進 `state`、`moveHistory`、Go3D JSON、`Rules`

換尺寸（New Game／Load／`remount`）呼叫 `resetClipToFull(state)`：三軸拉滿；**fade 不變**。

---

## 3. 顯示座標（UI 標籤）

儲存與 `inClip` 用內部 index。滑桿／數字標籤用 **user**（step 2）：

```text
user = 2 * index - (n - 1)     # 該軸 n = sizeX/Y/Z
```

例：N=9 一軸內部 0..8 ↔ 顯示 **-8 -6 … 8**；只開中層 z 時顯示區間一個值 `0`（內部 4）。  
滑桿 `step` 對應該軸相鄰顯示差 **2**。`Coords.axisToUser`／`axisFromUser` 做轉換。

---

## 4. board3d

`clipNow()`／`inClip(x,y,z)` 放在 `board3d.js`（讀 session，不改 rules）。

**建球 `buildStonesGeoExtract`**

| 點 | 行為 |
|----|------|
| `inClip` 活子 | 現況實心 `fRGBA` |
| `inClip` 死子 | `alpha≈0.32`（現況） |
| 非 clip 且 `fade===0` | **skip**（不建球） |
| 非 clip 且 `fade∈(0,1)` 活子 | 建球，`rgba[3] *= fade` |
| 非 clip 死子 | **不畫** |
| 非 clip 且 `fade===1` | 與沒裁相同（實心；死子仍 0.32） |

**空點／ended 著色 `createEmptyMarkers`**

- `inClip`：現況（灰空點或黑／白／dame 著色）
- 非 clip 且 `fade<1`：**不畫**（TPolyMarker3D 不易逐點透明）
- `fade===1`：整盤照畫

**picking `snapRayToLattice`**

第一版只吸附 **inClip** 格點（閾值仍 `dist≤0.45`，平手較小 `t`）。範圍外點不到 → 不能 Place／不能標死。  
`Rules.play`／`toggleDeadAt` **不改**；console `dispatch("play")` 仍可對內部合法點下手（觀察窗不是改棋）。

**重建時機**

- Slider `input`：只改 session.clip 與標籤，**不** `drawAll`、不重建 extras
- `change`／`pointerup`：走現況 `boardCtrl.render`／`redraw`（extras 子 + 空點），**不** `clearDom`／`drawAll`
- Show all／New Game／Load：reset 區間後再 extras 重建；換尺寸仍走既有 `remount`

禁止常駐 wrap `drawExtraShape`；禁止動 `select_in_view`；禁止每手 `nvidia-smi`。

---

## 5. 格線與軸（第一版鎖定）

- **12 邊外框 + 內部格線：維持整盤**，不隨 clip 淡化、不在 slider 重畫（避免 `drawAll` 丟相機）
- **軸箭頭：** 永遠全長、不淡（現況 `nMax` 公式）
- 範圍內「正常格線」＝整盤格線本來就在；觀察窗靠子／空點裁切表達層

（若之後要「範圍外只留 12 邊」，另開一步，且須有不經 `drawAll` 的格線更新。）

---

## 6. UI

主改 `client/ui/controller.js`。控制放在頂列下方或右側一小條，避免再塞爆按鈕列。

| 控制 | 內容 |
|------|------|
| 三組 min／max | 六個 `input type="range"`（或 number），標籤顯示 **user** 座標，例如 `X -8 … 8` |
| fade | `0`–`1`，step `0.05`；標籤 `fade` |
| Show all | 按鈕：三軸滿區間，**fade 不變** |

拖動中更新標籤數字；鬆開才 `render`。中局可改 clip（只改觀察，不改 `state.size*`）。  
換尺寸後選單與 clip 都回到該局滿區間。

---

## 7. 檔案分派

| 路徑 | 本步 |
|------|------|
| `ui/controller.js` | session.clip、六邊界＋fade＋Show all、reset on New Game／Load |
| `render/board3d.js` | `clipNow`／`inClip`；建球／空點／picking 過濾；死子範圍外不畫 |
| `*_cases.js` | 可測 `inClip`／fade=0 skip（若把 helper 掛在 `GoGame.Board3D`）；規則 cases **不**因 clip 改結果 |
| `rules.js`／`scoring.js`／`record.js` | **不改** |
| `state.js` | **不改**（不加 clip 欄位） |
| AGENTS／README | 一句：觀察窗 clip／fade，不進棋譜 |

---

## 8. 測試

| # | 要點 |
|---|------|
| C9 | New Game 9×9×9，z 只開一層（顯示一個 user z），fade=0：只見該層子／空點 |
| C0 | fade=0 時範圍內可 Place；範圍外點選無落子、ended 無標死 |
| Cshow | Show all → 三軸滿；fade 數值不變；整盤子回來 |
| Cfade | fade 小值：範圍外活子幽靈；範圍外死子仍不畫 |
| Crec | 裁切開著時 Export／Load／提子／計分與不開窗相同（譜無 clip 欄） |
| Csize | 改 4×5×5 New Game：clip 重設為滿 4×5×5 |

---

## 9. 建議下一份

```text
Prompts/20_P9_Apply_ClipFade.txt
```

diff-change-workflow 只做到 Step C，批准後才 apply。不要 reverse 17／18。

---

## 10. 請使用者批准的是非題

1. **是否批准本 Plan？**
2. **範圍外第一版不可點（不能落子／不能標死），可以嗎？**
3. **fade=0 不畫範圍外子，可以嗎？**

請回覆例如：「1 批准；2 範圍外不可點；3 fade=0 不畫。」
