# 03 P2 Plan：立體圍棋提子／自殺／簡單劫

**階段：** 只寫計畫。未改程式、未產 patch。  
**批准：** 見文末 §10（1 批准；2 先提對方再判自殺；3 `ended` 且不計分）。顯示座標見 `Plans/03_1_UserCoords.md`。  
**前提：** P1 已套用且 Chrome 手測通過（4×4×4 可點可下、Undo／Reset／Reload）。  
**環境：** GrokBuild 在 podman 內；禁止再套遊戲映像；驗收為手動步驟；模組公開函式不要講成網路 API。

---

## 1. 目標與非目標

**目標（P2）**

- 六鄰塊與氣
- `play`：先提對方無氣塊，再判自殺
- 簡單劫（禁止立即回填單提點）
- UI 打開 Pass／Resign；兩 Pass **不計分**
- 3D：state 變了就走現況 `redraw`／`drawAll` 全量重建 extras（含提子消失、Undo 回補）
- 給人看的座標見 `Plans/03_1_UserCoords.md`；**本檔規則與測試向量一律用內部 index 0..3**

**非目標（本 Phase 不准做）**

- SGF、計分、死子標記、領地 overlay、切層 2D
- 超劫、連環劫、全域重複局面
- 新 C++ class、改 SetSV、套映像
- 常駐 wrap `drawExtraShape`、改 `select_in_view`、裸 `TGeoBBox` main
- 改 picking 主方案
- **不修 Firefox New Game 相機／controls**（已知 framing；另開 02_1 或更後。Reset View 可恢復。03 不准夾帶）

**鎖定不變**

- 4×4×4；`board[z][y][x]`；`SIZE=4`
- 氣與連：六鄰 ±x ±y ±z，不連對角
- 只有 3D 立方格；規則在 JS；SV 純殼
- 子的顯示真相仍是 state；提子 = state 拿掉 + 同一條 extras 全量重建
- 兩次 Pass 不得自動進計分畫面、不呼叫 `scoring.js`

現況（讀碼）：`Rules.play` 只放子；`getGroup`／`getLiberties` 已是六鄰；`State.undo` 已能回補 `captured[]`（含 z）與 `koPoint`；UI 的 Pass／Resign **已建鈕但 `display:none`＋disabled**；`afterStateChange` → `boardCtrl.render` → `drawAll`。規則仍在 `rules.js`，不在 UI。

---

## 2. 塊／氣／play 順序

### 2.1 塊與氣

```text
DIRS = [±1,0,0] [0,±1,0] [0,0,±1]     # 已在 P1 rules.js
getGroup(state, x,y,z)                 # 同色、六鄰 flood fill（已有）
getLiberties(state, group) -> { count, points }
```

- 氣 = 塊上所有六鄰**空點**（去重）
- 越界不是氣；有子的格不是氣
- 對角（同時變兩軸）不相連

單子最大氣數（4×4×4，寫進測試以免平面直覺）：

| 位置 | 例 | 空盤氣數 |
|------|----|----------|
| 角 | (0,0,0) | **3** |
| 稜 | (1,0,0) | **4** |
| 面 | (1,1,0) | **5** |
| 內 | (1,1,1) | **6** |

### 2.2 play 順序（P2 預設：先提對方再判自殺）

全部在 **clone** 上做；失敗回傳原局面 clone，不改 caller 的 state。

1. 拒：`phase !== 'playing'`、越界、非空  
   message：`game is not in playing phase`／`out of bounds`／`point occupied`
2. 試放子（`setStone` 為 `toPlay`）
3. **先**掃落點六鄰的對方子，對每個尚未處理的對方塊算氣；氣盡則整塊移除（可多塊）。列入 `captured[{x,y,z,color}]`（去重）
4. 再看己方落子所在塊的氣  
   - 無氣且 `captured.length === 0` → **撤回試放**，`illegal suicide`  
   - 無氣但有提子 → 合法
5. 簡單劫：若 `captured.length === 1` 且落點等於 `state.koPoint`（三軸皆等）→ **撤回**，`illegal ko recapture`
6. 更新 `koPoint`：  
   - 若本次**只提 1 子**、且落子後己方該塊**恰好 1 子** → `koPoint = 被提的那格 {x,y,z}`  
   - 否則 `koPoint = null`
7. `passCount = 0`；history 記 `{type:play, color, x,y,z, captured, prevKoPoint, prevPassCount}`；`capturedBlack`／`capturedWhite` 依被提顏色累加；換手  
   message：`captured.length ? "capture" : "ok"`

`isLegal` 必須走同一套試放（含提子／自殺／劫），不可再只查空點。

規則**不寫進 UI**。UI 只呼叫 `Rules.play`／`pass`／`resign`，用回傳 `state`。

---

## 3. 簡單劫定義與 4×4×4 例題

**只做：** 禁止立即回填上一手的單提點（`koPoint`）。  
**不做：** 超劫、連環劫、盤面 hash 重複。

隔一手（任何非回提的合法著手，含 Pass）後 `koPoint` 已在第 6 步清掉或未再設，可回填。

### 3.1 驗收座標（面心單劫，z=0；**內部 index**）

白子待提在 **(1,1,0)**（面，五鄰），唯一氣 **(1,2,0)**。黑先提。  
（顯示制 {-3,-1,1,3} 見 03_1；本表不要改成 ±1±3。）

**布置**（`toPlay = Black`；測試可用 `setStone`，不經 `play`）：

| 色 | 座標 |
|----|------|
| 黑 | (0,1,0) (2,1,0) (1,0,0) (1,1,1) |
| 白 | (1,1,0)（待提）以及圍住提點的 (0,2,0) (2,2,0) (1,3,0) (1,2,1) |

**循環**

1. 黑 `play(1,2,0)` → 合法提 1；`(1,1,0)` 變空；`koPoint = {1,1,0}`；己方塊恰好 1 子  
   （(1,2,0) 與既有黑子只對角相鄰，六鄰不相連。）
2. 白立即 `play(1,1,0)` → **拒** `illegal ko recapture`
3. 白十目 `play(3,3,3)` → 合法；`koPoint = null`
4. 黑任意非 (1,1,0) 或 Pass 後，白 `play(1,1,0)` → 可回提（簡單劫只禁立即回填）

手測同一組座標即可。

---

## 4. Pass／Resign／ended 而不計分

| 動作 | 規則 | UI |
|------|------|----|
| **Pass** | 僅 `phase==='playing'`。history `type:pass`；`passCount+1`；`koPoint=null`；換手 | 顯示並可點 |
| **兩 Pass** | `passCount>=2` → `phase='ended'`（**不是** `scoring`）；不呼叫 `scoring.js`、不畫領地 | Message：`雙方停手（計分延後）`；此後不可再 `play` |
| **Resign** | `phase='finished'`；`winner=對方`；不計目 | 顯示並可點 |
| **Undo** | 沿用 `State.undo`：回補子與 `captured`、`toPlay`、`koPoint`、`passCount`；pass／resign undo 回 `playing` | 3D `render` 已接在 `afterStateChange` |

現況 `Rules.pass` 兩 Pass 仍 `finished:false` 且繼續換手——P2 改成 `ended`。  
現況 resign 已是 `finished`＋winner；可保留。ended／finished 時 Place／落子拒絕。

**不要**把兩 Pass 接到舊平面的 `scoring` phase。

---

## 5. 3D 同步（沿用 redraw）

現況路徑（不改幾何／picking）：

```text
UI onPlayRequest / Undo / Pass
  → session.state = Rules.* 回傳
  → afterStateChange → boardCtrl.render(state)
       → Board3D.redraw → drawAll(state, { preserveCamera: true })
            → 依 state.board 重建格線／空點／goStones extras
```

- **禁止**為提子做增量刪 mesh
- 落子／提子／Undo／Pass（若盤面或空點標記變了）都走這條全量重建
- Reset view 約束不變（歸位後高上限重掛；不常駐 wrap；不改 `select_in_view`）
- picking 主方案不改
- 空點 marker 已依 state 過濾佔格；提子後空點應再出現（全量 rebuild 自然發生）

`board3d.js` P2 **預期不改**。

---

## 6. 檔案分派表

| 路徑 | P2 要做 | 明確不做 |
|------|---------|----------|
| `client/core/rules.js` | **主戰場**：play 順序 §2.2；`isLegal` 對齊；pass→`ended`；message 含 capture／suicide／ko | 不把規則搬到 UI；不做超劫 |
| `client/core/state.js` | 現況 undo／clone／koPoint／captured 已含 z。**預設不改**；若 `ended` 需 undo 回 playing，確認 pass 分支（現已設 `phase='playing'`）即可 | 不改 `board[z][y][x]` 形狀 |
| `client/tests/rules_cases.js` | 保留 P1 空點／Undo；新增 §7 向量 | 不測 SGF／計分 |
| `client/ui/controller.js` | 顯示 Pass／Resign；`doPass`／`doResign`；Message 提子數與劫；`dispatch("pass"|"resign")`；ended 文案 | 不呼叫 Scoring；不開 SGF／領地 |
| `AGENTS.md`／`README.md` | 實作時改規則段：P2 有提子／自殺／簡單劫；兩 Pass=ended 不計分 | **本 Plan 階段不動檔** |
| `Skills/go-rules-engine` | apply 時對齊 P2 | 本階段不動 |
| `board3d.js` | **不改** | 不增量刪 mesh、不改 picking |
| `board2d.js` | 仍不載入、不刪 | — |
| `SetSV.C`、insert_files、`GoGame.cpp` | **不改** | — |
| `scoring.js`／`sgf.js` | **不改、不載入** | — |

---

## 7. rules_cases 向量清單

沿用 P1：newGame 4×4×4、空點可下、佔格拒、越界拒、輪流、Undo 無提子。

**新增（皆 4×4×4 **內部 index**，禁止 `board[y][x]`；顯示制見 03_1）：**

| # | 名稱 | 要點 |
|---|------|------|
| L | 角／稜／面／內氣數 | 單子空盤：角 (0,0,0)=3；稜 (1,0,0)=4；面 (1,1,0)=5；內 (1,1,1)=6 |
| G | 六鄰連塊、對角不連 | P1 已有；保留 |
| C1 | 單子被六鄰圍提 | 內點白 (1,1,1) 五鄰先黑、最後一氣黑下掉 → 白消失，`capturedWhite===1` |
| C2 | 雙塊同手並提 | 白 (0,0,0) 與 (0,0,2) 各只剩氣 (0,0,1)；黑 `play(0,0,1)` → 兩白皆空，`captured.length===2` |
| S | 自殺拒 | 白佔 (1,0,0)(0,1,0)(0,0,1)；黑 `play(0,0,0)` → 拒 suicide；角仍空 |
| S2 | 提後自殺變合法 | 白 (1,0,0) 只剩氣 (0,0,0)；黑下 (0,0,0) 提該白 → 合法 |
| K1 | 簡單劫拒 | §3.1 布置；黑提 (1,2,0)；白立即 (1,1,0) 拒 ko |
| K2 | 劫隔一手可回 | 黑提後白十目 (3,3,3)；黑 Pass 或他處；白 (1,1,0) 合法 |
| P2p | Pass×2 不進計分 | 兩 Pass → `phase==='ended'`；無 `scoreResult`；第三手 play 拒；不出現 scoring |
| U | Undo 提子 | C1 之後 undo → 白子回盤、captured 計數還原、3D 由 UI 測 |

`isLegal` 與 `play` 在 S／K1 必須一致（false／!ok）。

---

## 8. 手動驗收步驟

假設使用者已用既有映像跑 server，**自己**開 `/gogame/gogame.htm`（Chrome；Firefox 相機不在本驗收強求）。GrokBuild 不假裝點過。

1. New Game：4×4×4 立方格；可見 Pass、Resign；無 SGF／Score／2D。
2. 依 §7 C1 或任意圍殺：提子後 **3D 球消失**，Message 有 capture／顆數與三軸座標（P2／04 仍可能是內部；顯示制見 03_1，apply 在 05）；空點淡標記回到被提格。
3. 自殺點點下去 → Illegal suicide；盤面不變。
4. §3.1 劫：立即回提被拒；十目後可回。
5. Undo 提子手：被提子 **3D 回來**，輪到誰正確。
6. Pass、再 Pass → Message「雙方停手（計分延後）」；無領地色、無計分數字；再點格點不下子。
7. New Game 後 Resign → 對方勝文案；無目數。
8. Reset view：鏡頭可回；**子還在**；console 無 `resolveStack`。
9. 控制台 `[go_rules_cases]` 全 PASS；`GoGame.State.SIZE===4`。
10. **不要**用本步驟驗 Firefox New Game 相機。

---

## 9. 建議下一份檔名

```text
Prompts/04_P2_Apply_Capture.txt
```

**04 只套提子／自殺／劫／Pass／Resign**（本檔規則）。  
座標內部→顯示轉換**不在 04**；建議 `Prompts/05_P3_Apply_UserCoords.txt`。

走 `Skills/diff-change-workflow/`：先 unified diff 進 `Prompts/patches/`，可 reverse，**可以套用**才 apply。禁止未批准改 `Program_Go`。

---

## 10. 請使用者批准的是非題

**已回覆（03_1）：不得再當未決。**

1. **是否批准本 Plan？** — **批准。**
2. **play 順序是否用 §2.2 預設（先提對方再判自殺）？** — **是。** 先提對方無氣塊，再判自殺。
3. **兩 Pass 用 `phase='ended'` 且不計分，可以嗎？** — **可以。** 不呼叫 `scoring.js`、不畫領地。

顯示座標設計見 `Plans/03_1_UserCoords.md`（不改本檔 play 順序／ended／§3.1 內部座標）。
