# 22 P10 Plan：可選貼目與連下（moves per turn）

**階段：** 只寫計畫。未改程式、未產 patch。  
**準據：** `Prompts/22_P10_Plan_KomiAndMultiMove.txt`；計分 Message 21 已套用。  
**11 暫停／不做仍有效：** 切層 2D、Firefox 相機、SGF、第二套計分、超劫。  
**不要 reverse 17–21。** 計分公式（目＋提子＋死子＋komi）不變，只讓 **該局 komi 可選**。

**通過定義（套用後）：** 預設仍 komi 6.5、連下 1，與現況相同。選連下 2 時黑須兩手合法才輪白；一手 Pass 結束該方本回合；舊譜缺欄 Load 成 1／6.5。

---

## 1. 目標與非目標

**目標**

1. **貼目可選：** 黑先、貼目給白（不變）。列舉 **0.5, 1.5, …, 19.5**；**預設 6.5**。開局選；中局不可改。寫進 Go3D JSON；Load 後 Message／banner 顯示該局貼目。
2. **連下（moves per turn）：** 可選 **1..6**；**預設 1**（與現況相同）。開局選；中局不可改。寫進棋譜；Load 後顯示。動機：立體盤連接太容易，單手難圍地。

**非目標**

- 改提子／自殺／簡單劫的單手判定（每手仍走現況 `Rules.play`）
- 改計分公式、標死、領地著色、clip／fade、座標、長方 UI、換色
- 只給先手連下、超劫、SGF、第二套計分、切層 2D、Firefox 相機

---

## 2. 未定事項 — 建議預設（A–F，外加 Load 缺／非法）

| # | 問題 | 建議 |
|---|------|------|
| **A** | 連下雙方相同，還是只給先手？ | **雙方相同**（黑連 N、白連 N）。 |
| **B** | Pass 在連下模式怎麼算？ | **一手 Pass 結束該方本回合**（不必連 Pass N 次）。**連續兩方各 Pass 一次**（現況 `passCount >= 2`）仍結束對局。 |
| **C** | 連下中途提子、劫、自殺？ | **每手走 `Rules.play`**。合法才接受；**非法不消耗**該方剩餘連下（state 不變）。第一手即使後面還能補氣，自殺仍拒。 |
| **D** | Undo？ | **一次 Undo 回一手**（與現況 `moveHistory` 一筆相反）。不是整回合。 |
| **E** | 舊譜缺欄？ | 缺 `movesPerTurn` → **1**；缺 `komi` → **6.5**。舊整數 `size` 仍當立方（17 已做）。 |
| **F** | 欄位名 | `komi`（已有）、**`movesPerTurn`**。 |
| **G** | Load 有值但不在允許集合？ | **整檔失敗**，盤面維持載入前。`newGame` 對非法值則鉗回預設（6.5／1），與 size 鉗制同一風格。 |

批准本 Plan 即含 A–G。

---

## 3. State

```text
ALLOWED_KOMI        = 0.5, 1.5, …, 19.5     # 20 個；k === n+0.5, n=0..19
DEFAULT_KOMI        = 6.5                    # 已有
ALLOWED_MOVES_PER_TURN = 1..6 整數
DEFAULT_MOVES_PER_TURN = 1

state.komi              該局貼目（白加）
state.movesPerTurn      該局每回合連下數（雙方相同）
state.playsThisTurn     本回合已成功落子數；回合開始為 0；∈ [0, movesPerTurn)
```

`newGame({ size / sizeX,Y,Z, komi, movesPerTurn })`：

- `komi` 缺 → 6.5；不在允許集合 → 6.5
- `movesPerTurn` 缺 → 1；非 1..6 整數 → 1
- `playsThisTurn = 0`；`toPlay = BLACK` 不變

`clone` 複製這三欄。中局改 select **不**寫入 `state`（與換尺寸相同：New Game／Load 才生效）。

`undo`：彈一筆 history；還原 `toPlay = rec.color`、`playsThisTurn = rec.prevPlaysThisTurn`（缺則 0）。play／pass／resign 記錄都帶 `prevPlaysThisTurn`。

公開：`State.DEFAULT_MOVES_PER_TURN`、`clampKomi`、`clampMovesPerTurn`（可與 `ALLOWED_*` 同檔）。

---

## 4. Rules：輪到誰、Pass、Resign

現況：每次合法 `play` 立刻 `toPlay = opponent`。連下 1 必須保持這個行為。

**`play`（合法路徑）**

```text
color = toPlay
…現況：落子、提對方、自殺檢查、簡單劫、寫 history（加 prevPlaysThisTurn）…
playsThisTurn = playsThisTurn + 1
if playsThisTurn >= movesPerTurn:
    toPlay = opponent
    playsThisTurn = 0
else:
    toPlay 不變（仍 color）
passCount = 0          # 落子中斷連 Pass，與現況相同
```

`movesPerTurn === 1` → 第一次就切換，等於現況。  
非法（佔子／越界／自殺／劫／非 playing）→ `fail` 克隆，**不**加 `playsThisTurn`。

**`pass`**

```text
寫 pass 記錄（含 prevPlaysThisTurn）
playsThisTurn = 0
passCount += 1
if passCount >= 2:
    phase = ended          # 不必切 toPlay（現況 ended 分支）
else:
    toPlay = opponent
```

黑在 1/2 時 Pass＝結束黑回合，輪白，`passCount=1`。白再 Pass＝`ended`。  
黑 Pass、白落子（`passCount` 歸 0）、之後再兩邊各 Pass 才結束。

**`resign`**

現況：`toPlay` 那一方認輸，對方勝，`phase=finished`，不計目。連下中途（已下 1/2）Resign 仍是**當前 toPlay** 認輸。

**輔助（可選公開）** `Rules.stonesThisTurn(state)` → `{ played, total, nextIndex }`，`nextIndex = played+1`，給 banner。也可只讀 `state.playsThisTurn`。

**不改：** `DIRS`、`getGroup`、`getLiberties`、提子順序、劫點形狀、`isLegal` 仍包一層 `play`。

---

## 5. 計分

公式不變：

```text
black = terrB + capturedWhite + deadWhite
white = terrW + capturedBlack + deadBlack + state.komi
```

`scoring.js` **已經**讀 `state.komi`（缺才 `DEFAULT_KOMI`）。本步：

- 註解／`reason` 字串不要寫死「白永遠 +6.5」；用該局 `r.komi`
- 空盤預設仍白 6.5（回歸）；另測 `newGame({komi:0.5})` 空盤白 0.5
- Message 已是 `komi {k}`（21），會跟該局走

---

## 6. Record（Go3D JSON）

Export 頭（在現況 `format/size/komi/coords` 旁）**一律寫** `movesPerTurn`：

```json
{
  "format": "Go3D",
  "size": [4, 4, 4],
  "komi": 6.5,
  "movesPerTurn": 2,
  "coords": "user",
  "moves": [
    { "t": "play", "c": "B", "p": [-3, -3, -3] },
    { "t": "play", "c": "B", "p": [-1, -3, -3] },
    { "t": "play", "c": "W", "p": [3, 3, 3] }
  ],
  "deadStones": [],
  "scoreResult": null
}
```

`moves` 仍只記每手；連下不另開巢狀回合。重播靠 `newGame({…, movesPerTurn})` + 現況 `Rules.play/pass/resign`。

**Load**

```text
1. 現況校驗 format / size / coords
2. komi：缺 → 6.5；有值須 ∈ ALLOWED_KOMI，否則整檔失敗
3. movesPerTurn：缺 → 1；有值須為 1..6 整數，否則整檔失敗
4. newGame({ sizeX,Y,Z, komi, movesPerTurn })
5. 依 moves：顏色必須等於當時 toPlay（resign 除外）
   → 連下 2 的譜允許連續兩個 "c":"B"
   → 連下 1 的舊譜仍是 B/W 交替；若寫了連續兩黑會 color mismatch（正確）
6. 失敗不留下半局（現況）
```

舊檔無 `movesPerTurn`、有 `komi: 6.5`、整數 `size: 4` → 與現況相同（連下 1）。

---

## 7. UI

主改 `client/ui/controller.js`。兩個 select 放在 X/Y/Z／Cube **旁邊**（同一 `sizeWrap` 或緊鄰），避免再塞爆。

| 控制 | 內容 |
|------|------|
| Komi | `<select>` 0.5 … 19.5，預設 6.5 |
| Moves | `<select>` 1 … 6，預設 1；標籤 `Moves` 或 `Stones/turn` |

行為與尺寸選單相同：

- 改 select **只暫存**；**New Game** 才 `newGame({ sizeX,Y,Z, komi, movesPerTurn })`
- `refresh()` **不得**在中局把 select 寫回當前局（否則無法暫存下一局）
- **Load** 成功後把 select 同步成該局 `komi`／`movesPerTurn`（與 `syncSizeSelectsFromState` 同類）
- **Cube** 只把 X=Y=Z=4；**不**重設 komi／連下
- `dispatch("newGame")` 接受 `payload.komi`、`payload.movesPerTurn`（比照 size）

**Banner**（`playerBanner`，playing 時）建議：

```text
To play: Black  ·  4×4×4  ·  komi 6.5  ·  1/2
```

`a/b` = 本回合即將落下的第 `playsThisTurn+1` 手／`movesPerTurn`。預設 1 → `1/1`。ended 後 Score 列已含 `komi {k}`（21）。

**Message**

- New Game：`New game 4×4×4 · komi 6.5 · moves 2`
- Load 成功：在現況 "Loaded Go3D record" 後附 `· komi 6.5 · movesPerTurn 2`

Hand 仍跟 `toPlay`（連下中途第二顆仍是黑）。不必改 3D。

---

## 8. 檔案分派

| 路徑 | 本步 |
|------|------|
| `client/core/state.js` | `movesPerTurn`／`playsThisTurn`；clamp；newGame／clone／undo；history `prevPlaysThisTurn` |
| `client/core/rules.js` | `play` 滿 N 才換邊；`pass` 一律結束回合；resign 仍當前 toPlay |
| `client/core/record.js` | Export 寫 `movesPerTurn`；Load 缺欄預設、非法整檔失敗 |
| `client/core/scoring.js` | 公式不改；註解／測試用該局 komi |
| `client/ui/controller.js` | 兩 select、banner、New Game／Load／dispatch |
| `tests/rules_cases.js` | 連下 2、Pass 結束回合、非法不消耗、Undo 一手、N=1 回歸 |
| `tests/record_cases.js` | 舊譜缺欄；Export 含欄；連下 2 連續兩黑 Load |
| `tests/scoring_cases.js` | 預設 6.5 回歸；`komi:0.5` 空盤白 0.5 |
| AGENTS／README／skills | 一句：komi 可選、連下 N；預設 6.5／1 |
| `board3d.js`／clip／coords | **不改** |

---

## 9. 測試向量

| # | 要點 |
|---|------|
| R1 | `newGame()`：`komi===6.5`、`movesPerTurn===1`、`playsThisTurn===0`；黑下一手後 `toPlay===WHITE`（回歸） |
| M2 | `newGame({movesPerTurn:2})`：黑 (0,0,0) 後 `toPlay` 仍 BLACK、`playsThisTurn===1`；再 (1,0,0) 後 WHITE、`playsThisTurn===0` |
| P1 | 連下 2，黑一手後 Pass → `toPlay===WHITE`、`passCount===1`、`phase==="playing"` |
| P2 | 連下 2，黑 Pass、白 Pass → `phase==="ended"`（不必各 Pass 兩次） |
| Ill | 連下 2，黑佔子／自殺非法 → `playsThisTurn` 仍 0、`toPlay` 仍 BLACK |
| U1 | 連下 2，黑兩手後 Undo 一次 → 只拿掉第二手，`toPlay` 黑、`playsThisTurn===1` |
| RecOld | 舊 JSON 無 `movesPerTurn`、可無 `komi`、`size:4` → Load 成功，1／6.5 |
| RecM2 | Export 連下 2 含欄；Load 連續兩黑成功；若 `movesPerTurn:7` 或 `komi:6` → 失敗且 prev 不變 |
| Sc05 | `newGame({komi:0.5})` 空盤 `white===0.5`；預設空盤仍 6.5 |

---

## 10. 建議下一份

```text
Prompts/23_P10_Apply_KomiAndMultiMove.txt
```

diff-change-workflow 只做到 Step C，批准後才 apply。不要 reverse 17–21。公式只讀該局 `state.komi`，不寫死 6.5。

---

## 11. 請使用者批准的是非題

1. **是否批准本 Plan（含建議 A–F，以及 G：Load 非法 komi／movesPerTurn 整檔失敗）？**
2. **連下雙方相同，可以嗎？**
3. **一手 Pass 結束本回合，可以嗎？**

請回覆例如：「1 批准；2 雙方相同；3 一手 Pass 結束回合。」
