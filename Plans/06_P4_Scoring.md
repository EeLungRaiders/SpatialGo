# 06 P4 Plan：立體圍棋區域計分

**階段：** 只寫計畫。未改程式、未產 patch。  
**批准方向：** 見 §10 與 `Plans/06_1_KomiDead.md`（komi 6.5、ended 後標死、無領地 overlay、死子 3D 可見）。  
**環境：** GrokBuild 在 podman 內；禁止再套映像；驗收為手動步驟；模組公開函式不要講成網路 API。

---

## 1. 目標與非目標

**目標（P4）**

- **區域計分**：活子數 + 地點數；**komi = 6.5 加給白**
- 3D「地」：空點 **六鄰** 連通；只碰單色**活**子 → 該色地；碰兩色或都不碰 → **dame**
- 對角不連（與氣相同）
- **ended 後手動標死**（點 3D 格 → 六鄰同色整塊切換 dead／活）；計分視死子為已提
- Message 出數字；若列格點用顯示座標；演算法內部 0..3
- 死子在 3D **必須看得出**（球變淡或 X）——這不是領地 overlay
- 對帳：`活子 + terr + dame === 64`（死子已當空進 terr／dame；**不含 komi**）

**非目標**

- 日式目＋提子＋komi 當預設（仍列 **P4b**）
- 3D 領地著色 overlay／2D 色塊（**另號**）
- 改提子順序、座標公式、軸、`worldOf`
- SGF、切層 2D、Firefox New Game 相機
- 超劫、新 C++ class、SetSV
- Resign 改成區域分（仍對方勝、不計目）

舊 `scoring.js` 是平面四鄰＋日式＋`{x,y}` deadStones，**只當語意參考**。現況 `state.js` **沒有** `deadStones` 欄位；P4 apply 要加 `{x,y,z}` 列表。

---

## 2. 地的 flood fill

空點、六鄰（`Rules.DIRS`）、對角不連。

計分時：`deadSet` 內的子 **視為空**（與已提相同），再 flood。

```text
對每個未訪問「空或死子格」 (x,y,z)：
  flood fill 得到 region R
  掃描 R 的六鄰：
    碰到 BLACK **活**子 → touchBlack
    碰到 WHITE **活**子 → touchWhite
  只碰黑 → 黑地；只碰白 → 白地；否則 dame
```

活子不進 flood。越界不是接觸。

---

## 3. 分數公式（無和棋）

```text
活黑子 / 活白子 = 盤上非 dead 的子
黑地 / 白地 / dame = flood fill（死子格當空）

black = 活黑子 + 黑地
white = 活白子 + 白地 + 6.5

對帳（唯一式）：活子 + terr + dame === 64
死子格在 flood 裡已當空，會進 terr 或 dame，禁止再加「死子佔格」。
分數和 black+white = 64 - dame + 6.5，不必等於 64。
```

**不**把 `captured*` 再加進區域分。

komi 半目 → **不會平局**（`black === white` 不出現）。

| 比較 | `winner` / `winnerColor` |
|------|--------------------------|
| black > white | `'black'` / `State.BLACK` |
| white > black | `'white'` / `State.WHITE` |

`score(state)` 讀 `board` + `deadStones` + `komi`（預設 6.5）。UI 寫入 `state.scoreResult`，不寫 `moveHistory`。

---

## 4. ended、標死、何時算

| 事件 | 行為 |
|------|------|
| 第二口 Pass → `ended` | **先不算分**。Message 只提示「標死後計分」（或等價）。不要先丟一組全當活的分數。 |
| ended 點 3D 有子的格 | 切換該子**六鄰同色整塊** dead／活；playing **不可**標死 |
| 標死切換後 | **立即重算**並更新 Message（以標完為準） |
| Score 鈕 | ended 時重算；playing disabled |
| Undo 最後一口 Pass | 回 `playing`；**清 `scoreResult` 與全部死子標記** |
| Resign | `finished`＋對方勝；**不**跑區域分 |
| New Game | 無分數、無死子 |

不把 `ended` 改成舊平面 `scoring` phase。ended／finished 仍不可 `play`。

Message 例：

```text
區域 黑 40 白 28.5（活子 10+8 地 30+14 dame 2 死 0）komi 6.5 → 黑勝
```

---

## 5. 檔案分派

| 路徑 | P4 | 不做 |
|------|-----|------|
| `client/core/scoring.js` | **改寫**：六鄰、z、區域、komi 6.5、讀 `deadStones` `{x,y,z}` | 不把日式當預設 |
| `client/core/state.js` | 加 `deadStones: [{x,y,z},…]`；clone／newGame／undo-pass 清除 | 不改 `board[z][y][x]` 形狀 |
| `client/tests/scoring_cases.js` | 拿掉 `SIZE===4` skip；§6 向量 | 不測 overlay |
| `client/ui/controller.js` | ended 標死點擊、Score、Message；Undo 清標記 | 不畫領地 |
| `board3d.js` | **小改**：死子變淡或 X（可點切換）；picking 仍 64 格 | **禁止**領地著色 |
| `gogame.htm`、AutoLoad、insert_files | 載入 `go_scoring.js`／`go_scoring_cases.js` | 不載 board2d |
| `rules.js` | **不改** play／劫；pass 已設 `ended` | 不把分數寫進 Rules |
| `AGENTS.md`／README／`go-scoring` skill | apply 時改 komi 6.5、標死、無 overlay | 本 Plan 階段不動檔 |

---

## 6. 測試向量（內部 0..3）

| # | 名稱 | 要點 |
|---|------|------|
| E | 空盤 | 64 dame；黑 0 白 **6.5**；**白勝**（不是 draw） |
| S | 兩角各一子 | 黑 (0,0,0) 白 (3,3,3)，大空間 dame；黑 1 白 **7.5**；白勝 |
| C | 角地 | 黑 (1,0,0)(0,1,0)(0,0,1)，(0,0,0) 空 → 1 點黑地 |
| D | dame | 空 (1,1,1) 六鄰有黑有白 → 該點 dame |
| H | 單色空腔 | (1,1,1) 空、六鄰皆活黑 → 黑地 |
| T | 對帳 64 | `活子+terr+dame===64`（**不含 komi**） |
| M | 標死一塊 | 標死後活子減少、對方地或 dame 增加、分數變 |
| M2 | Undo Pass | 回 playing；**標記與 scoreResult 都沒了** |
| R | Resign | 不跑區域分 |

`rules_cases` P2p：phase 仍是 `ended`，不是舊 `scoring` phase。

---

## 7. 非目標清單

P4b／另號：日式目＋提子、3D 領地著色。  
SGF、切層 2D、軸／座標公式、提子規則、Firefox 相機、C++。

---

## 8. 建議下一份

```text
Prompts/07_P4_Apply_Scoring.txt
```

批准修訂後的 06 才寫／執行。走 `diff-change-workflow`。

---

## 9. 手動驗收（apply 後使用者自測）

1. 兩 Pass → ended；Message **尚未出分**，只提示標死後計分；標死或按 Score 才有區域分（白含 6.5）；**無領地色**。  
2. 死子球變淡或 X，可再點恢復。  
3. 標完分數相對「全當活」有變。  
4. Undo Pass → 可再下；死子外觀與分數都沒了。  
5. Resign 仍只寫對方勝。  
6. `[go_scoring_cases]`／`[go_rules_cases]` PASS。  
7. 滾輪／軸／顯示座標／capture 不退步。

---

## 10. 對原 §10 三題的回覆（06_1，已定案）

1. **是否批准本 Plan？** — **批准方向**；須按 06_1 改 komi、標死、64 對帳、計分時機（本文已改）。  
2. **P4 用區域計分、komi=0？** — **區域計分**；**komi = 6.5 加白**。`stones+terr+dame===64` 不含 komi。  
3. **P4 不做手動標死、不做 3D 領地 overlay？** — **要手動標死**；**不要**領地 overlay。死子 3D 可見（淡／X）。ended → 標死 → 再計分。

06_2：已刪「死子佔格」重複對帳；兩 Pass **先不算分**，不以全當活暫算當最終。
