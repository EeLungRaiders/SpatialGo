# 01 P1 Plan：立體空間圍棋 4×4×4

**階段：** 只寫計畫。未改 `Program_Go`、Launcher、client、SetSV、insert_files、HTML、`AGENTS.md`、`README.md`。未產 patch。  
**批准：** 已移除（原 `Prompts/01_1_P1_Plan_Approval.md`）。結論：1 批准；2 picking 主方案；3 (a) 專頁不載入 board2d（檔先留、不刪、不改 stub）。可進入 P1 apply。  
**前提：** P0 `Reports/00_P0_ReadOnly_Audit.md`。舊平面文字已移除。  
**環境：** GrokBuild 在 podman 內；禁止再套遊戲映像；驗收為手動步驟；模組公開函式不要講成網路 API。

---

## 1. 目標與非目標

這是新遊戲「立體空間圍棋」，**不是**平面盤加 z，也**不是**平面 Go 的 3D 視圖。

| 項目 | 第一版定案（不得改掉） |
|------|------------------------|
| 盤 | **只做 4×4×4** |
| 氣／連 | **六鄰** ±x ±y ±z，不連對角 |
| 呈現 | **只有 3D**；透明立方格 + 3D 棋子；沒有平面棋盤樣子 |
| 延後 | SGF、計分、死子、領地 overlay |
| 規則 | 瀏覽器 JS |
| Server | `ProgramGo_SV` 純殼 |
| P1 規則深度 | 極簡合法落子（空點可下）；提子／自殺／劫列 **P2** |

**沿用**

- SetSV 單一入口；業務 `.cpp` 不互 include 業務 header
- insert_files、專頁 `/gogame/gogame.htm`、Reload 清 WebGL
- 子走同一 `TGeoPainter` extras；高 `numfaces`／`numnodes`
- 加子／提子／Undo **同一條**依 state 重建 extras 的路徑
- Reset：相機歸位後用高上限再掛子；禁止常駐 `drawExtraShape`；禁止亂改 `select_in_view`；禁止把 `focusCamera`／`collectVisibles` 當成「子一定還在」
- 不要每手 `nvidia-smi`
- 不要裸 `TGeoBBox` 當唯一 `JSROOT.draw`
- 不要假設 `THREE.BoxGeometry` 是 constructor

**不要**

- 邏輯寫進 SV；P1 不新開 C++ 功能 class
- 保留 2D 主盤當可玩面
- 射線 ∩ 平面 z=0 當 picking
- 把 z 做成 overlay 或「多一層 2D」
- 為了好看再做木質 slab 當棋盤
- 為「打不開頁面」改架構

**P1 成功長相：** 專頁上一個可旋轉的 4×4×4 空間格線，交叉點可點，黑白球出現在格點中心；沒有木板、沒有 2D 格子、沒有 2D/3D 切換。

---

## 2. State

### 2.1 資料形狀

集中常數，不做 1–50、不做矩形：

```text
GoGame.State.SIZE = 4          # 唯一合法邊長
board[z][y][x]                 # 0 empty | 1 Black | 2 White
inBounds(state, x, y, z)       # 三軸皆 ∈ [0, SIZE)
getStone / setStone(state, x, y, z[, color])
```

`newGame()`：永遠 4×4×4、黑先、`phase='playing'`。忽略或拒絕 `size`／`width`／`height`（P1 建議：**忽略並固定 4**，避免 UI 殘留參數害人以為能改盤）。

座標 0-based `(x,y,z)`。原點語意在呈現層：世界座標把立方體置中，見 §4。

### 2.2 保留／廢除

**保留（欄位可留空給 P2）**

| 欄位／函式 | P1 |
|------------|----|
| `EMPTY` `BLACK` `WHITE` `opponent` | 用 |
| `toPlay` `phase` `moveHistory` `lastAction` `winner` | 用 |
| `clone` `undo` | 用；history 的 play 必須有 `z` |
| `koPoint` `passCount` `capturedBlack` `capturedWhite` `komi` | **欄位保留**，P1 `play` 不寫劫／提子 |

**廢除或改名（實作時刪掉或改成丟錯，禁止再當平面 API）**

| 現況 | P1 |
|------|----|
| `board[y][x]` | 廢除 |
| `inBounds(state, x, y)` 兩軸 | 改三軸；兩引數呼叫視為程式錯誤 |
| `getStone`／`setStone` 無 z | 必須有 z |
| `width` `height` `size` 可變盤 | 廢除。可留唯讀 `size === 4` 當別名，但不要 `boardDims` |
| `boardDims` `normalizeDim` `normalizeSize` `normalizeDims` | 廢除 |
| `MIN_SIZE` `MAX_SIZE` `DEFAULT_SIZE=19` | 廢除，改 `SIZE=4` |
| `copyPoint` 只複製 x,y | 改 `{x,y,z}` |
| `emptyBoard(width,height)` | 改 `emptyBoard()` → `[z][y][x]` |
| UI／log 的平面座標字串（SGF 字母+列號） | P1 改印 `(x,y,z)` |

### 2.3 Undo

現況 `State.undo` 只還原 state，不碰 DOM。P1 **沿用這條**，history 增加 `z`；`captured` 在 P1 恆為 `[]`。  
3D **必須**在 undo 後走同一條 `redraw(state)` → 重建 extras（與落子相同）。禁止為保相機而跳過畫子。

### 2.4 測試檔

| 檔 | P1 |
|----|----|
| `client/tests/rules_cases.js` | **改寫**為 4×4×4 P1 向量（空點可下、佔格拒絕、越界拒絕、輪流、undo 還原子）。現有提子／劫／自殺 cases **刪或移註 P2**，不可再 `board[y][x]` |
| `sgf_cases.js` `scoring_cases.js` `budget_cases.js` | 內容暫不改寫；**專頁不載入**。檔內 `runAll()` 加開頭守衛：若 `State.SIZE===4` 或 `board[0][0]` 是陣列（三維）則 skip，避免殼 AutoLoad 仍載入時對 3D state 爆一串 FAIL |

---

## 3. Rules P1 / 留給 P2

### 3.1 P1（本 Phase 要做）

```text
DIRS = [±1,0,0] [0,±1,0] [0,0,±1]     # 六鄰；不連對角
Rules.play(state, x, y, z) -> { ok, state, captured:[], message }
Rules.isLegal(state, x, y, z) -> bool
```

合法：**在界內且該格為空**（且 `phase==='playing'`）。  
拒絕 message：`out of bounds`／`point occupied`／`game is not in playing phase`。

P1 `play`：**只放子、記 history（含 z）、換手**。不提子、不設 `koPoint`、不測自殺。  
`getGroup`／`getLiberties`：P1 可先改成六鄰走訪並匯出（給 P2 用），**UI 不呼叫**。

`pass`／`resign`：函式可留（改成不依賴平面座標）；**UI 預設禁用**，見 §6。兩 Pass 不得自動進計分。

### 3.2 留給 P2（本 Phase 明確不做）

- 提子（無氣整塊移除）
- 自殺禁（下後己方無氣且未提子）
- 簡單劫
- Pass／Resign 當可玩流程；兩 Pass → scoring
- 死子、領地、SGF
- 與提子對應的 3D 同步（P1 沒有提子；Undo 仍要 3D 跟 state）

---

## 4. 立方格呈現與 extras

透明立方格 = **4×4×4 交叉點的空間格線**，不是一塊板。

### 4.1 格線物件

**用 `TPolyLine3D`（已證實路徑）。**

- 先畫外框 12 條邊（覆蓋完整 AABB），讓第一個 painter 的包圍盒是整個立方體，而不是一條短線。
- 再畫三軸格線：每軸 4×4=16 條、每條 4 個格點（可一條 polyline 4 頂點）。合計 12 + 48 量級，遠小於舊 37 路標籤。
- `drawSeq` 第一筆仍是 polyline，建立共用 `TGeoPainter`；其後 `"same"`。
- **禁止**裸 `TGeoBBox` 當 `JSROOT.draw` main。
- **禁止**木質 slab／hatch 當棋盤。
- **不要**依賴 `THREE.BoxGeometry` 做半透明盒（constructor 常不存在；現況 `ensureThreeSlab` 已證明）。

### 4.2 空點標記

**要。** 空交叉點放極淡 `TPolyMarker3D`（小、低對比），讓 64 格可見、也可當 picking 視覺錨。  
有子的格：不畫淡點，只畫球。  
這不是第二套棋子真相源；真相仍是 `state.board`。

### 4.3 棋子 extras

沿用現況成功鏈，幾何改成立方格：

```text
drawAll(state)
  → clearDom
  → 建格線 + 空點 marker（依 state 過濾已佔格）
  → drawSeq(框架)                    # 第一條 TPolyLine3D → TGeoPainter
  → buildStonesGeoExtract(state)     # 每子獨立 TEveGeoShapeExtract + TGeoSphere
  → attachStonesToGeoPainter(...)    # 同一 painter.drawExtras("goStones")
       暫時 wrap drawExtraShape 傳高 numfaces/numnodes，then/catch 立刻還原
  → 禁止 J.draw(stones) 當第二個 main
```

建樹順序：**z 外層 → y → x**（先低 z）。4×4×4 滿盤 64 球 × ~384 face ≈ 2.5×10⁴，遠低於預設 ~1e5，理論上不會再因 budget「整排消失」。**仍必須帶高上限**（沿用 `numfaces≈2e6`、`numnodes≈1e4`），不要退回裸 `build()`。順序寫進 log，若將來截斷會先掉高 z，方便對帳。

`fNseg:16` `fNz:12` 可維持；64 球不必降分段。

加子／Undo：都 `redraw` → 全量重建 extras（P1 棋子少，可接受）。禁止跳過畫子來保相機。

### 4.4 座標、間距、球

```text
N = 4
CELL = 1                         # 相鄰格點世界距離
c = (N-1)/2 = 1.5
worldOf(x,y,z) = (x-c, y-c, z-c) # 立方體中心在世界原點
球心 = 格點（不是「坐在 z=0 木板上」）
R ≈ 0.32                         # 直徑 < 1，不相鄰重疊；格線可從球間穿過
```

世界軸：與現況 board3d 相容——格子的 z 走世界 Z，x→X、y→Y。相機從斜上方看，四層都在景深裡，而不是只看舊的 z=0 平面。

座標標：P1 用 Message／著手紀錄印 `(x,y,z)`。軸上 0–3 刻字可選、非必須（舊 stroke 字在大盤很重；4 路可之後再加）。

### 4.5 相機與 Reset

- 第一筆 draw 必須是**完整立方體 AABB**（外框 12 邊），再 `focusCamera`／預設 framing，避免只框到 z=0 一層。
- 進專頁／New Game：`preserveCamera:false`，看到整個立方體。
- 落子後：`preserveCamera:true`（現況 save／deferred restore）。
- **Reset view：** 可用 `focusCamera` 或 `adjustCameraPosition(true)`，**結束後用高上限再掛 extras**（延遲多拍）；orbit 結束節流再掛。禁止常駐替换 `drawExtraShape`，禁止關 `select_in_view`。

---

## 5. Picking 主方案與備案

現況 `pickAtClient`：相機射線 ∩ **平面 z=0** → `(x,y)`。立體版必須對到 `(x,y,z)`。  
層選 UI **可當輔助，不能當唯一棋盤**。不改 JSROOT 核心。

既有可用工具（不依賴 `BoxGeometry`）：

- `rayFromCameraNdc`（純矩陣，現況已有）
- 偶爾有的 `THREE.Raycaster.setFromCamera`（orbit 上常在）
- 64 個已知格點世界座標

### 5.1 主方案（P1 預設）：射線最近格點吸附

1. 螢幕座標 → NDC → 相機射線（優先 Raycaster，失敗用 `rayFromCameraNdc`）。
2. 對 64 個格點算點到射線距離（垂直距離）與射線參數 `t`。
3. 只收 `dist ≤ 0.45`（半格 0.5 減一點）且 `t` 在相機前方。
4. 先比 `dist` 最小，平手取 **較小 t**（靠鏡頭的點贏，避免「看穿一整柱」點到後層）。
5. 回傳 `{x,y,z}`；落在閾值外回傳 `null`。

**為什麼能落地：** 只做向量算術；不建 `BoxGeometry`／`Mesh`；不改 `select_in_view`；空點淡標記只幫忙對準，不是 picking 的硬依賴。64 點成本可忽略。

### 5.2 備案：extras／標記 mesh 命中，失敗再吸附

若主方案在實機上系統性偏一格：把空點淡標記或極小 extras 球加入 scene，用 `Raycaster.intersectObject(s)` 打 mesh，再把命中點吸附到最近格點。  
風險：JSROOT 的 THREE 可能沒有完整 Raycaster.intersect；extras 重建後 mesh 引用失效。故備案必須 **失敗時退回主方案**，且仍禁止裸 Box 當 main draw。

### 5.3 明確禁止

- 只點平面再靠 UI 選 z 層當**唯一**手段
- 為 picking 去 patch JSROOT `geobase.mjs`／`select_in_view`
- 假設 `THREE.BoxGeometry` 可建 64 個 invisible box

**P1 預設：主方案。** 層號可顯示在 Message（hover／命中後），不當唯一輸入。

---

## 6. UI 加減

專頁仍是**唯一遊玩面**。殼 index 的 GoBoard 仍只開 `/gogame/gogame.htm`，不在主頁 mount WebGL。

| 控制 | P1 |
|------|----|
| 專頁 Reload | **留** |
| New Game | **留**（永遠 4×4×4，無 Size） |
| Undo | **留**（state.undo + 3D redraw） |
| Place／拖 Hand 落子 | **留**（`pickAtClient` 改回 z） |
| Reset view | **留** |
| Mem. Stat.（25 手或按 Mem） | **留** |
| 當前玩家、Message、著手紀錄 | **留**；紀錄印 `(x,y,z)` |
| 2D／3D 切換 | **拿掉** |
| Size 1–50／矩形 | **拿掉** |
| SGF 區（Export／Copy／Load） | **拿掉** |
| Score、Clear dead、領地／死子 | **拿掉** |
| Pass、Resign | **隱藏或 disabled**，標 P2 |

`view_mode` 預設 `'3d'`；`mountBoard` **只** `Board3D.mount`。  
`onPlayRequest(x,y)` 改 `(x,y,z)`。

Chrome 標題改「立體空間圍棋」一類，避免還寫平面 19 路。

---

## 7. 檔案分派表

P1 **不改** `SetSV.C`、不新開 C++ class、**預設不改** `Launcher/insert_files/GoGame_files.txt`（仍 copy 舊檔；專頁自己不載入即可）。

| 路徑 | P1 要做 | 明確不做 |
|------|---------|----------|
| `client/core/state.js` | `SIZE=4`、`board[z][y][x]`、`inBounds/getStone/setStone` 三軸、history 含 z、廢除寬高 API | 不做 1–50、矩形、SGF 欄位 |
| `client/core/rules.js` | `play/isLegal(x,y,z)` 只拒越界與佔格；`DIRS` 六鄰 | 不做提子／自殺／劫；不把兩 Pass 接計分 |
| `client/render/board3d.js` | 立方格 `TPolyLine3D`、空點淡標記、`worldOf(x,y,z)`、球在格點、extras 高上限、Reset 後重掛、picking 主方案、拿掉 slab／hoshi／領地／z=0 平面交 | 不做木板；不裸 TGeoBBox main；不常駐 wrap `drawExtraShape`；不改 `select_in_view` |
| `client/render/board2d.js` | **(a) 專頁不再載入**；檔案留在 repo 不刪 | 不維護可玩 2D；不改成第二套棋盤 |
| `client/render/view_mode.js` | 預設 `'3d'`；`setMode('2d')` 可忽略或強制 3d | 不提供可玩 2D 模式 |
| `client/render/controller.js` | 只 mount Board3D；`onPlayRequest`／`pickAtClient` 帶 z；進頁 Reset 一次 | 不呼叫 `Board2D.mount` |
| `client/ui/controller.js` | 收掉 §6 所列鈕；New Game 固定 4；play/undo 接 3D；Message 印 `(x,y,z)` | 不接 SGF／計分／死子／改盤大小 |
| `client/loader/go_loader.js` | 文案改專頁立體棋；依賴檢查不要求 Board2D／Sgf／Scoring | 仍不在殼 mount WebGL |
| `GoGame/html/gogame.htm` | `GO_SCRIPTS` 拿掉 `go_board2d`、SGF／scoring／其 cases、budget cases（P1 可不載）；標題改立體棋 | 不改 JSROOT `main.mjs` 載入方式 |
| `client/tests/rules_cases.js` | 改寫 P1 4×4×4 向量，load 時 runAll | 不保留平面提子／劫當必過 |
| `client/tests/sgf_cases.js` 等 | `runAll` 遇 3D state 則 skip | 不在 P1 重寫 SGF／計分測試 |
| `client/core/scoring.js` `sgf.js` `budget.js` | **不改邏輯**；專頁不載入 | 不刪檔（延後模組） |
| `Launcher/insert_files/GoGame_files.txt` | **不改** | 不新增檔；不在 P1 清舊 copy |
| `Program_Go/SetSV.C` | **不改** | 不碰 ACLiC 邊界 |
| `Program_Go/GoGame/GoGame.cpp` | **可選小改：** AutoLoad 拿掉 board2d／sgf／scoring cases，避免開殼誤跑平面測試。非必須（專頁自有清單）。建議 P1 apply **做這一行**，仍不是新 class | 不改 Register／AddLocation |
| `AGENTS.md` | 見 §7.1（本階段不動檔） | P1 Plan 階段不改 |
| `README.md` | 見 §7.1（本階段不動檔） | 同上 |
| `Skills/go-game-state` 等 | 實作後對齊 4×4×4／六鄰／僅 3D；`thttpserver-integration`／`diff-change-workflow` 幾乎不改 | 本 Plan 階段不動 |

### board2d 選擇：**預設 (a) 留檔但專頁不再載入**

理由：第一版不能同時維護可玩 2D；檔還有平面 hoshi／overlay 可當 reference，刪檔或做成 stub 都容易有人再 `mount`。  
(b) stub 仍會被 AutoLoad／誤載入執行一堆空函式，且 1400+ 行還在解析。  
若批准 (b)：`Board2D.mount` 變成 no-op 並 `console.warn`，專頁仍可不列該 script。

### 7.1 AGENTS.md／README.md 改寫意圖（本階段不改檔）

**AGENTS.md**

- Project Goal：改成立體空間圍棋 4×4×4、六鄰、僅 3D 透明立方格；SGF／計分標延後
- 保留：規則在 JS、JSROOT 呈現、THttpServer 服務層、SetSV 契約、insert_files、專頁、skills 入口
- Coding Style：`board[z][y][x]` + `getStone/setStone(..., z)`
- Module map：Board2D 不再是可玩面；Scoring／Sgf 標延後
- AutoLoad 表與專頁 script 對齊（無 board2d 若已拿掉）
- How to test／Manual acceptance：改為立方格落子／佔格拒絕／Undo／Reset，刪 2D 點子、Pass×2 計分、SGF、2D↔3D
- Non-goals：維持無帳號／AI；並寫「不做平面主盤」

**README.md**

- 標題與 Quick start：專頁 `/gogame/gogame.htm`，不要寫「選 GoBoard 在殼裡下棋」
- Docs 表已指向 P0；補 P1 Plan 連結
- Smoke：`[go_rules_cases]` P1 向量；`GoGame.State.SIZE===4`

---

## 8. 風險

| 風險 | 為何會發生 | P1 對策 |
|------|------------|---------|
| **漏排球** | extras `build()` 預設 numfaces 靜默砍尾；或 Reset／`focusCamera` 後 extras 被拆 | 64 球遠低於 1e5，仍**強制高上限**；Reset／orbit 後重掛；對帳 log `state/tree/mesh` |
| **Reset 砍子** | `focusCamera`→`completeDraw` 用預設上限重建 | 歸位後延遲重掛；不常駐 wrap；不改 `select_in_view` |
| **picking 點到鄰格／後層** | 斜視時射線穿過一柱 4 點 | 閾值 0.45 + **t 較小者**；Message 顯示命中座標方便手測；備案才動 mesh |
| **THREE 不完整** | `BoxGeometry` 不是 constructor；Raycaster 可能只有 stub | 格線只用 `TPolyLine3D`；picking 主方案用純射線+64 點；不建 THREE Box |
| **第一筆 draw AABB 太小** | JSROOT 只框到第一條短線，相機像舊的 z=0 盤 | 先畫完整 12 邊外框 |
| **殼 AutoLoad 跑舊測試** | `sgf_cases` 等仍 `runAll` 且假設 `board[y][x]` | 測試守衛 skip；建議 AutoLoad 拿掉會炸的 cases |
| **少重畫 3D** | 舊坑：第一子像沒貼、Undo 變 Marker | 落子／Undo 同一 `drawAll` 全量同步 |

---

## 9. 手動驗收步驟

假設使用者已在本機用既有映像跑 `Launcher/StartServer.sh`，自己開專頁。GrokBuild **不**代開瀏覽器、不假裝點過。

1. 開 `https://<host>:13931/gogame/gogame.htm`（或殼 GoBoard 連到專頁）。
2. 畫面是 **空間立方格 + 淡格點**，不是木質平面盤，沒有 2D 棋盤，沒有 2D/3D 切換、Size、SGF、Score。
3. 能旋轉／縮放看到 **四層**格點，不是只對準一塊 z=0 板。
4. New Game：黑先；64 格皆空。
5. Place（或拖 Hand）點一個空交叉點 → 該格出現黑球，Message／log 有 `(x,y,z)`。
6. 再點同一格 → 拒絕（occupied），球還在。
7. 點空白（離格點遠）→ 不下子。
8. 白子可下在另一空格；Undo → 最後一子消失，3D 與輪到誰一致。
9. Reset view：鏡頭回到能看見整個立方體；**球還在**；旋轉時不整排消失；console 無 `resolveStack`。
10. 專頁 Reload：場景重建、記憶體路徑回到乾淨分頁（硬重置）；Server 不重啟。
11. 主頁 GoBoard **不**在殼內掛 WebGL 棋盤。
12. 控制台：`GoGame.State.SIZE === 4`；`[go_rules_cases]` P1 PASS；不應再噴平面 SGF／計分 FAIL。

---

## 10. 建議下一份實作 Prompt 檔名

```text
Prompts/02_P1_Apply_SpatialGo_4x4x4.txt
```

已依批准結論寫出（已移除，原 `Prompts/01_1_P1_Plan_Approval.md`）。走 `diff-change-workflow`：先 unified diff，批准再 apply。禁止未批准直接改 `Program_Go`。

---

## 11. 請使用者批准的是非題

已回覆（已移除，原 `Prompts/01_1_P1_Plan_Approval.md`）：

1. **是否批准本 Plan？** — **批准。**
2. **picking 用主方案還是備案？** — **主方案。**
3. **board2d 用 (a) 不載入還是 (b) stub？** — **(a) 不載入；檔先留、不刪、不 stub。**
