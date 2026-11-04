# 00 P0 只讀盤點：從平面圍棋複本到立體空間圍棋

**日期：** 2026-05-07  
**性質：** 只讀盤點。未改 `Program_Go`、Launcher、client 規則、SetSV 業務；未實作 4×4×4。  
**歸檔：** 使用者已批准「建議搬的可搬、建議可刪的也可以刪、清空後只留給立體圍棋新檔」。執行結果見文末 §9。  
**工作目錄：** `SpatialGo`（盤點時為平面圍棋專案完整複本）。

---

## 1. 產品目標確認（後續 Plan 前提）

這是新遊戲「立體空間圍棋」，**不是**在平面盤上加一層 z，也**不是**延續平面 Go 的 3D 視圖模式。

使用者已確認第一版：

| 項目 | 第一版定案 |
|------|------------|
| 盤面 | **只做 4×4×4** |
| 氣與包圍 | **六鄰**（±x ±y ±z），**不連對角** |
| 呈現 | **只有 3D**；透明立方格 + 3D 棋子；已沒有平面棋盤的樣子 |
| 延後 | SGF、計分、死子、領地 overlay **全部延後** |
| 規則位置 | 仍在瀏覽器 JS；ROOT / JSROOT 只服務與呈現 |
| Server | `ProgramGo_SV` **維持純殼** |

環境聲明（本 Prompt 與後續大 Prompt 均適用）：

- GrokBuild 在 podman 容器內。**禁止**再 docker / podman 套遊戲映像。
- 不能開瀏覽器就改碼；不能以「打不開頁面」為由改架構。
- 驗收寫成手動步驟即可，不要假裝已在瀏覽器點過。

讀檔時分兩類：

- **A. 架構與約束** — 要繼承到立體版（SetSV／insert_files／專頁／extras 高上限／Reset 後重掛子）。
- **B. 平面棋盤專屬實作** — 第一版不搬（2D `TLine` 棋盤、`SZ` 平面 SGF、四鄰、領地 overlay、2D↔3D 視圖切換、`board[y][x]`、z=0 平面 picking）。

---

## 2. 目錄樹（精簡）

```text
SpatialGo/
├── Doc/
│   ├── AGENTS.md                  # 開發架構說明（非對外）
│   └── README.md                  # 開發過程說明
├── run_container.sh               # 本機 docker 進遊戲映像（GrokBuild 禁止代跑）
├── BuildImage/
│   ├── Dockerfile                 # ubuntu:26.04 + ROOT 6.40.02 + JSROOT 7.11 + nvidia-utils-595
│   ├── build.sh
│   └── scripts/{dl_jsroot,set_ssl,set_user}.sh
├── Launcher/
│   ├── StartServer.sh             # insert_files ×2 → root SetSV.C++
│   ├── scripts/insert_files.sh    # 兩欄 cp：WORKDIR → $JSROOTSYS
│   └── insert_files/
│       ├── ProgramGo_SV_files.txt # serverlog.js
│       └── GoGame_files.txt       # 圍棋 client 全清單
├── Program_Go/                    # 容器 WORKDIR（= $WORKDIR）
│   ├── SetSV.C                    # ACLiC 單一入口
│   ├── ProgramGo_SV/              # 純殼：HTTPS、SV_log、layout 委派
│   ├── GoGame/                    # 功能 class + client + 專頁 HTML
│   └── GoSysMon/                  # Host/proc/gpu 快照（≠ 分頁 WebGL）
├── Skills/
├── Prompts/                       # 立體圍棋從 01 起
│   └── （已移除）早期已套用 diff
├── Plans/
└── Reports/                       # 本檔為立體版第一份報告
```

### 2.1 標出：client / SetSV / 靜態檔 / 專頁

| 角色 | 路徑 | 一句話 |
|------|------|--------|
| **SetSV 入口** | `Program_Go/SetSV.C` | ACLiC 先 include 全部業務 `.h`，再 include 全部業務 `.cpp`，再 `Add_*` |
| **純殼** | `Program_Go/ProgramGo_SV/` | THttpServer HTTPS:13931、`SV_log`、Refresh、layout 委派 |
| **功能 class** | `Program_Go/GoGame/GoGame.{h,cpp}` | Register `TNamed("GoBoard")`、AutoLoad、`AddLocation("gogame/")` |
| **監測 class** | `Program_Go/GoSysMon/` | `TNamed("GoSysMem")` JSON；可選 `nvidia-smi` |
| **遊戲頁（專頁）** | `Program_Go/GoGame/html/gogame.htm` | 實際遊玩 URL：`https://…:13931/gogame/gogame.htm` |
| **靜態部署清單** | `Launcher/insert_files/GoGame_files.txt` | client JS → `$JSROOTSYS/scripts/go_*.js`；HTML 另 copy 到 `$JSROOTSYS/files/gogame.htm` |
| **State** | `Program_Go/GoGame/client/core/state.js` | 平面 `board[y][x]` |
| **Rules** | `…/core/rules.js` | **四鄰**、提子、劫、自殺 |
| **UI** | `…/ui/controller.js` | 熱座 chrome、2D/3D 切換、SGF、Mem. Stat. |
| **2D 主盤** | `…/render/board2d.js` | ROOT `TLine`／`TEllipse`／`TMarker`／`TText`（平面棋盤樣子） |
| **3D 視圖** | `…/render/board3d.js` | 平面盤的 3D 視圖（slab z=0 + 球），**不是**立體格點棋 |
| **入口 loader** | `…/loader/go_loader.js` | 殼內 GoBoard 只開專頁，不在主頁 mount 遊戲 |

**遊戲頁實際路徑：** `/gogame/gogame.htm`（`GoGame::EnsureGoPageLocation`：`AddLocation("gogame/", $WORKDIR/GoGame/html/)`）。  
備援 copy：`/jsrootsys/files/gogame.htm`（insert_files 第二欄）。產品以短路徑為準。

---

## 3. SetSV 擴充方式

### 3.1 SetSV.C 如何 include `.h` 再編譯 `.cpp`

現況（`Program_Go/SetSV.C` 原文結構）：

```cpp
// ACLiC single-entry model (this file only):
//   1) include all business .h first (complete types)
//   2) include all business .cpp next (same translation unit)
// Do not let business .cpp include other business headers.

#include "ProgramGo_SV/ProgramGo_SV.h"
#include "GoGame/GoGame.h"
#include "GoSysMon/GoSysMon.h"

#include "ProgramGo_SV/ProgramGo_SV.cpp"
#include "GoGame/GoGame.cpp"
#include "GoSysMon/GoSysMon.cpp"
```

`Launcher/StartServer.sh` 在 WORKDIR 執行：

```text
insert_files ProgramGo_SV_files.txt
insert_files GoGame_files.txt
root -l -b SetSV.C++("proc_SV.log")
```

新模組必須：在 **header 區塊**加 `.h`、在 **source 區塊**加 `.cpp`。不要另開第二個 ACLiC 入口。

### 3.2 Add_* 既有模式

| 工廠 | 掛載 | 做什麼 |
|------|------|--------|
| `GoGame::Add_GoGame(sv)` | `PROGRAMGO_SV->go_game = …` | Register `TNamed("GoBoard")`、一次 `SetAutoLoad`、`AddLocation("gogame/")` |
| `GoSysMon::Add_GoSysMon(sv)` | `PROGRAMGO_SV->go_sysmon = …` | Register `TNamed("GoSysMem")`、隱藏指令 `/GoSysMemSample`、寫 `$JSROOTSYS/go_sysmem.json` |

`SetSV()` 本體：new `ProgramGo_SV` → 兩個 `Add_*` → `AddItems()` → `Append_IndexPage()`。

`ProgramGo_SV.h` 只 **forward declare** `GoGame` / `GoSysMon`，以指標持有。立體版若要新 C++ 功能 class，應再做一個平行 `Add_*`，不要把邏輯塞進 SV。

### 3.3 業務 `.cpp` 是否互相 include 業務 header

**現況：** 否。三個 `.cpp` 開頭都寫「Includes come from *.h via SetSV.C. Do not add `#include` here. Do not include ProgramGo_SV.h or other business headers here.」

業務 `.h` 自行準備該模組實作所需的 std/ROOT include；對其他業務型別只用 forward declaration（例如 `class ProgramGo_SV;`）。完整型別靠 SetSV 的 include 順序（SV `.h` 在功能 `.cpp` 之前）。

**應遵守的規則（繼承到立體版）：**

1. 只有 `SetSV.C` 是 ACLiC 單一入口。
2. 先全部業務 `.h`，再全部業務 `.cpp`。
3. 業務 `.cpp` **禁止**再 `#include` 其他業務 header。
4. 不要把公開模組函式講成「網路 API」。

### 3.4 ProgramGo_SV 是不是純殼

**是。** 現況職責僅：

- 建 `THttpServer("https:13931?nocache&ssl_cert=…&rw=1")`
- Register `SV_log`
- Refresh 指令
- `AddItems`／`Refresh`／layout **委派**給 `go_game` / `go_sysmon`
- 無圍棋規則、無棋盤幾何、無 SGF、無計分

`init_debuginfo`：若尚未掛 `go_game`，才單獨 AutoLoad `serverlog.js`；掛上後由 `GoGame::EnsureAutoLoad` 一次寫完整腳本鏈（避免蓋掉 serverlog）。

立體版必須維持此純殼。

---

## 4. Client 與 3D extras

### 4.1 Client 檔在哪（部署名）

| 模組 | 原始檔 | insert 後 |
|------|--------|-----------|
| State | `client/core/state.js` | `$JSROOTSYS/scripts/go_state.js` |
| Rules | `client/core/rules.js` | `go_rules.js` |
| Scoring | `client/core/scoring.js` | `go_scoring.js` |
| SGF | `client/core/sgf.js` | `go_sgf.js` |
| Budget | `client/core/budget.js` | `go_budget.js` |
| view mode | `client/render/view_mode.js` | `go_view_mode.js` |
| **2D 主盤** | `client/render/board2d.js` | `go_board2d.js` |
| **3D 視圖** | `client/render/board3d.js` | `go_board3d.js` |
| Render 控制 | `client/render/controller.js` | `go_render_ctrl.js` |
| UI | `client/ui/controller.js` | `go_ui.js` |
| Loader | `client/loader/go_loader.js` | `go_loader.js` |
| 測試 | `client/tests/*_cases.js` | `go_*_cases.js` |
| 專頁 HTML | `GoGame/html/gogame.htm` | `$JSROOTSYS/files/gogame.htm` **且** `AddLocation` 對應 `/gogame/` |

`insert_files.sh`：讀兩欄清單，把 `${WORKDIR}`／`${JSROOTSYS}` 展開後 `cp`。

專頁 **不依賴** 殼的 AutoLoad：`gogame.htm` 先 `import` `/jsrootsys/modules/main.mjs` 設 `globalThis.JSROOT`，再依同一順序載入 classic `go_*.js`，最後 `GoGame.UI.mount(#go-app)`。

殼路徑：點 index 的 GoBoard → `serverlog.js` 的 `TNamed` handler → `GoGame.drawBoardPlaceholder` → **開專頁**，不在主頁 mount WebGL。

### 4.2 哪些是 2D 主盤、哪些是 3D 視圖（皆屬平面棋）

| 檔 | 現況角色 | 立體第一版 |
|----|----------|------------|
| `board2d.js` | **2D 主盤**（格子、hoshi、座標、領地 overlay、死子 X） | **不搬**（B） |
| `board3d.js` | **平面盤的 3D 視圖**：木質 slab、z=0 格線、球在交叉點上；picking = 射線 ∩ **平面 z=0** → `(x,y)` | 呈現技術（extras／Reset）可繼承；**幾何與 picking 要換成立方格** |
| `view_mode.js` | `'2d' \| '3d'`，預設 `'2d'` | 第一版只有 3D，此切換屬 B |
| `state.js` | `board[y][x]`，寬×高 ∈ [1,50] | 改為 `board[z][y][x]`，N=4（A 的模組邊界可留，資料形狀屬 B） |
| `rules.js` | `DIRS` 四鄰 | 改六鄰（B 的鄰接定義） |
| `scoring.js` / `sgf.js` | 平面領地／`SZ[N]` 或 `SZ[W:H]` | **延後**（B） |

### 4.3 3D 子如何掛 extras（實際呼叫鏈）

產品現況（`board3d.js`，`USE_TGEO_STONES === true`）：

```text
UI / Render.redraw(state)
  → Board3D.redraw
       → drawAll(state, { preserveCamera: true })
            → clearDom()                         # 拆 host DOM／canvas
            → syncMarkers(...)                   # TGeo 開時不畫這些 mark
            → buildStonesGeoExtract(state)
                 雙層迴圈 y=0..H-1, x=0..W-1
                 每顆非空格：獨立 TEveGeoShapeExtract + 獨立 TGeoSphere
                   (fNseg:16, fNz:12, ≈384 tris／球)
                 掛入 root extract goStones.fElements (TList)
            → drawSeq(框架：slab hatch / 格線 / 座標 / hoshi / 領地 / 死子X)
                 第一條 TPolyLine3D 建立共用 TGeoPainter（dummy geom）
            → attachStonesToGeoPainter(stonesGeo, state)
                 findGeoExtrasPainter()          # 必須與格線同一 painter
                 刪舊 extras 容器 "goStones"
                 geop.ctrl.maxfaces / maxnodes 提高到高上限
                 【暫時】wrap geop.drawExtraShape：
                    buildFn(obj, { numfaces, numnodes, vislevel:99, instancing:-1 })
                    addToExtrasContainer(mesh)
                 geop.drawExtras(stonesGeo, "goStones", true, true)
                 【立刻還原】drawExtraShape = orig
                 polishGeoStoneMaterials
                 對帳 log：state 子數 / tree 節點 / extras mesh
```

註解與 27_0 一致：**禁止** `JSROOT.draw(stones)` 當第二個 main；子必須走 **同一 TGeoPainter 的 extras**。  
裸 `TGeoBBox` 不當唯一 `JSROOT.draw`（會 Fail）。盤體用 hatch `TPolyLine3D`；THREE slab 僅在 `BoxGeometry` 真的是 constructor 時才加，否則永久 skip。

### 4.4 加子、提子、Undo 是否都走同一條同步路徑

**是（現況）。** `drawAll` 註解寫明：每次 redraw **必須**依 state 全量同步棋子；**禁止**為了保相機而跳過畫子。

```text
落子 / 提子後的 render
Undo
New Game remount
2D→3D remount
  → 都進 redraw 或 drawAll
       → 從 state.board 重建整棵 goStones
       → attachStonesToGeoPainter
```

`resetView` 與 orbit 結束另走 `reattachStonesFromState`（同一 `buildStonesGeoExtract` + `attachStonesToGeoPainter`），不是第二套棋子真相源。

立體版必須沿用「加子／提子／Undo 同一條同步路徑」。平面版曾因少重畫出現：第一子像沒貼盤、3D 不提子、Undo 變 Marker。

---

## 5. maxfaces／Reset view／記憶體約束

以下為必須繼承的約束（**原句級轉述，不淡化**）。來源筆記已刪，不再列舊檔名。要點留在下面；現況仍可對 `board3d.js`。

### 5.1 extras build 的 numfaces／numnodes 過低會靜默少畫球；建樹順序可能整排消失

JSROOT `drawExtraShape` → `build(obj)` **未傳** opt 時，預設約 **`numfaces = 100000`**、**`numnodes = 1000`**。主幾何 GUI 預設 `maxfaces ≈ 200000×more`。`collectVisibles(face_limit)` 達限即 incomplete。

每球 ~384 face → 約 **260 球**（1e5）或 **~520 球**（2e5）觸頂。建樹 **先 y 再 x**：截斷時 **高 y 連續整排消失**。應用若把 `drawExtras` resolve 當成功、且 TGeo 模式不畫 marker，使用者只看到「3D 少整排」；2D 仍在、該點禁下 → **State 有子，屬顯示層**。

現況已把 extras 預算拉到 `STONE_EXTRAS_NUMFACES = 2000000`、`STONE_EXTRAS_NUMNODES = 10000`，且 `faceBudget = max(該常數, nTree×384×2)`。立體 4×4×4 滿盤僅 64 球，遠低於此上限，**仍必須帶高 numfaces 呼叫**，不要退回預設 `build()`。

### 5.2 Reset view 不可走 focusCamera／collectVisibles 當常規手段

較精確的現況／教訓（曾做錯、後已糾正）：

- `focusCamera` 動畫結束可能 `startDrawGeometry` → `completeDraw`，**刪 extras + 用預設上限重建**，子被砍或整排消失。
- 曾有一次錯誤：**常駐替换** `drawExtraShape`、設 `ctrl.select_in_view = false`、改 `_clones.setMaxVisNodes`、用 `adjustCameraPosition("only_set")` 避開 `focusCamera` → **弄壞 ClonedNodes**，mousemove `resolveStack` crash（`reading '0' of undefined`）。

**正確作法：**

- Reset 仍可用 painter 的 `focusCamera` 或 `adjustCameraPosition(true)` + `render3D`（讓 controls／clones 一致）。
- **相機歸位後用高上限再掛 stones extras**（`scheduleReattachStonesAfterCameraSettle`：500／900／1400 ms 多拍）。
- orbit 結束節流再掛一次（≥750 ms，延遲 250 ms），**不要每 mousemove**。

一句話：**正確是相機歸位後用高上限再掛 stones extras。** 不要把 `focusCamera`／`collectVisibles` 當成「只轉鏡頭、子一定還在」的常規假設。

### 5.3 不要常駐替换 drawExtraShape，不要亂改 select_in_view

現況 wrap 是 **單次 attach 期間暫時替换，then/catch 立刻還原**。立體版禁止改成常駐猴補，禁止關 `select_in_view`，禁止改 `_clones` 當 Reset 手段。

### 5.4 不要每手 nvidia-smi

`GoSysMon::QueryNvidiaSmi` 是 **整卡／容器可見 GPU**，**不是**分頁 WebGL。介面自動採樣 **每 25 手** 或按 Mem 鈕。每手 popen `nvidia-smi` 會卡。立體版維持此節流。

### 5.5 TGeoBBox 裸 JSROOT.draw 會 Fail；此環境 THREE.BoxGeometry 常不是 constructor

盤體禁止裸 `TGeoBBox` 當唯一 draw。`getTHREE()` 拿到的常是不完整 THREE（有 Raycaster 無 `BoxGeometry`）。現況 probe 一次，失敗則永遠 skip THREE slab，只用 ROOT hatch。立體透明立方格 **不要**假設 `new THREE.BoxGeometry(...)` 可用；優先 ROOT／JSROOT 物件或已證實的 THREE 建構子。

### 5.6 3D 主戰場在分頁 WebGL，不是 root 行程；每手 clearDom 全量重建會吃 RAM

C++ 只 Register `TNamed` holder，**不持有** 3D GPU 資源。每手 `clearDom` + 全量 `drawSeq` + 全量 TGeo extras 會堆瀏覽器 RSS。`destroy` 目前主要拆 DOM，**未**保證 THREE `geometry/material/renderer.dispose`。

緩解（已有、立體版沿用）：

- **專頁 Reload**（`gogame.htm` 的 Reload → `location.reload()`）清 WebGL／JS 堆，**不重啟** ROOT。
- redraw 應序列化；不要並行多個 `drawAll` 互踩 `clearDom`。
- 4×4×4 負載遠小於 37×37，但仍不要把「每手全量重建」當長期策略而不設專頁硬重置。

Server `nvidia-smi`／`GetMemInfo` **測不到**分頁泄漏。

---

## 6. 平面舊檔（已移除）

平面圍棋的舊筆記、舊報告與已套用 diff 已整批刪除。maxfaces、Reset view、記憶體約束留在 §5。映像定義在 `BuildImage/`。技能在 `Skills/`。

---

## 8. 建議的下一份 Prompt 檔名

該檔已在工作區：

```text
Prompts/01_P1_Plan_SpatialGo_4x4x4.txt
```

內容方向（僅檔名建議）：立體圍棋第一版 Plan — 4×4×4 state、六鄰、只有 3D 透明立方格、P1 極簡合法落子；沿用 SetSV 純殼、insert_files、專頁、高 numfaces extras、Reset 後重掛子；明確不寫 SGF／計分／死子／領地。

---

## P1 前提（本階段不展開實作）

| # | 前提 |
|---|------|
| 1 | **State：** `board[z][y][x]`，N=4，`inBounds` 三軸 |
| 2 | **鄰接：** 六鄰（±x ±y ±z），不連對角 |
| 3 | **呈現：** 透明立方格點 + 球；點選對應 `(x,y,z)` |
| 4 | **規則：** P1 可極簡合法落子；提子／劫可列 P2。SGF／計分／死子／領地 overlay 延後 |
| 5 | **沿用：** 高 numfaces extras、Reset 後重掛子、專頁 Reload 清 WebGL、`ProgramGo_SV` 純殼、規則在 JS |
| 6 | **不要：** 邏輯進 SV、每手 nvidia-smi、常駐猴補 `drawExtraShape`、亂改 `select_in_view`、裸 `TGeoBBox` draw、為打不開頁面而改架構 |

---

## 9. 歸檔之後

平面舊 Prompts、Plans、Reports 已不在樹內。`Prompts/` 從 01 起。`Prompts/01_P1_Plan_SpatialGo_4x4x4.txt` 已在工作區。

*P0 只讀盤點結束。*
