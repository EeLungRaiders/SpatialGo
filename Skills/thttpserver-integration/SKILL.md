---
name: thttpserver-integration
description: >
  Integrate Go game with ROOT THttpServer via ProgramGo_SV and GoGame C++ class.
  Covers SetSV.C mounting, Register of ROOT holders, insert_files, AutoLoad,
  and layout. Use when implementing server bootstrap, GoGame::Add_GoGame, WORKDIR
  extension pattern, or deploying client JS to JSROOTSYS. Triggers: /thttpserver-integration,
  SetSV, THttpServer, ProgramGo_SV, insert_files, AutoLoad.
---

# thttpserver-integration

## 職責說明

本 Skill 負責 **THttpServer 服務層與圍棋功能的 C++ 掛載**，讓瀏覽器能載入遊戲腳本並透過 JSROOT 繪製已 Register 的 ROOT 物件。

1. 維持 `ProgramGo_SV` 為 **純 Server 主機**（serverlog、Refresh、layout 委派）
2. 平行 class **`GoGame`**，經 **`SetSV.C` + `GoGame::Add_GoGame`** 掛載
3. **Register** 邏輯 holder：`TNamed("GoBoard", …)`（client 再建立 3D 立方格 ROOT 物件；P1 不 mount 2D）
4. **insert_files** 部署 client JS 到 `$JSROOTSYS/scripts/`
5. **SetAutoLoad** 一次設定完整腳本鏈（含 `go_loader.js`）
6. Layout 提供 GoBoard draw item；保留 `SV_log` / serverlog

**不負責**：規則、計分、SGF、UI 文案、棋盤點擊（其他 Skills）。

## 主要負責檔案 / 路徑

| 路徑 | 說明 |
|------|------|
| `Program_Go/ProgramGo_SV/ProgramGo_SV.h` | `GoGame *go_game` |
| `Program_Go/ProgramGo_SV/ProgramGo_SV.cpp` | 委派 AddItems / Refresh / layout |
| `Program_Go/ProgramGo_SV/js/serverlog.js` | TNamed 分發（SV_log / GoBoard） |
| `Program_Go/SetSV.C` | `#include` 順序 + `Add_GoGame` |
| `Program_Go/GoGame/GoGame.h` / `GoGame.cpp` | Register holder、AutoLoad、layout |
| `Program_Go/GoGame/client/loader/go_loader.js` | 客戶端入口 → `UI.mount` |
| `Launcher/insert_files/ProgramGo_SV_files.txt` | serverlog 等 SV 腳本 |
| `Launcher/insert_files/GoGame_files.txt` | **圍棋 client 全清單** |
| `Launcher/scripts/insert_files.sh` | 部署腳本 |
| `Launcher/StartServer.sh` | insert 兩邊 list 後 `SetSV.C++` |
| `run_container.sh` | Docker 掛載 `Program_Go` + `Launcher` |

> **未採用**：`BoardView2D/3D` C++ 類別（第一版 client 直接建 TH2I / 3D 物件）。

## WORKDIR + SetSV.C 擴充模式（必遵）

```cpp
// ProgramGo_SV.h
class GoGame;
GoGame *go_game = nullptr;

// SetSV.C — headers first, then sources (ACLiC single-entry)
PROGRAMGO_SV->go_game = GoGame::Add_GoGame(PROGRAMGO_SV);
```

`GoGame.cpp` **不要**再 `#include` 業務標頭（由 SetSV / GoGame.h 帶入）。

## AutoLoad 順序（與 GoGame.cpp 一致；P1 空間棋）

專頁 `gogame.htm` 自列腳本（**不**載 `go_board2d`／SGF／scoring cases）。
殼 AutoLoad：

```text
serverlog.js
go_state.js → go_rules.js
go_view_mode.js → go_board3d.js → go_budget.js → go_render_ctrl.js → go_ui.js
go_rules_cases.js
go_loader.js
```

`insert_files/GoGame_files.txt` 仍可 copy 舊平面檔；能部署 ≠ 允許 mount 2D。

## 模組公開函式規格（C++）

```text
GoGame::Add_GoGame(ProgramGo_SV* sv) -> GoGame*
  Register TNamed("GoBoard")
  EnsureAutoLoad()  // 上表腳本

GoGame
  RegisterBoardHolder() / EnsureAutoLoad()
  AddItems() / Refresh() / AppendLayoutItems(...)
```

## 驗收標準

- [ ] `./run_container.sh` + `Launcher/StartServer.sh` 可起 HTTPS:13931
- [ ] `Add_GoGame` 掛載；規則不在 `ProgramGo_SV`
- [ ] 無 404：`go_loader.js` 與 go_*.js
- [ ] GoBoard 可 draw；`SV_log` 仍可用
- [ ] `ProgramGo_SV/js/` 僅 server 相關
- [ ] Docker / ROOT 版本未被無故改動

## 禁止事項

- 禁止在 C++ 實作合法著手、提子、劫、計分、SGF
- 禁止把圍棋 client 塞進 `ProgramGo_SV/`
- 禁止破壞 serverlog / insert_files
- 禁止 Register 路徑服務「非 ROOT 主棋盤」方案
- 禁止線上對戰、帳號、AI、GTP

## 與其他 Skill 的依賴關係

| 關係 | Skill | 說明 |
|------|--------|------|
| 被依賴 | 其餘全部 | 部署與載入基礎 |
| 下游 | go-board-render / go-ui-controller | 使用頁面與 GoBoard draw |

**實作順序**：① 最先（Phase 0）。
