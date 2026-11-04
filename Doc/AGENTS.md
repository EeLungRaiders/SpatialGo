本檔為 GrokBuild 開發時的架構與約束說明，非對外文件。
文中 `Plans/`、`Skills/`、`Program_Go/`、`Prompts/` 相對專案根目錄，不是相對 `Doc/`。

# Spatial Go (立體空間圍棋) on ROOT THttpServer + JSROOT

## Project Goal

First release: a two-player **spatial Go** (axes 1..9, default 4×4×4, hotseat; UI three size menus X/Y/Z) with:

- **3D only**: transparent lattice + TGeoSphere stones via **ROOT + JSROOT** (not a canvas engine)
- P2 rules: six-neighbour capture, suicide ban, simple ko; Pass / Resign
- Two passes → mark dead then **territory score** (komi selectable 0.5–19.5, default 6.5). Optional **moves per turn** 1–6 (default 1, both colors). Go3D JSON record (not SGF). Territory coloring only after score. SGF deferred.
- User-facing coordinates: **step 2 per axis** (`user = 2*index-(n-1)`). N=4 cube: **-3,-1,1,3**; N=5: **-4,-2,0,2,4** (center 0 playable). 1×1×1 demo (suicide). Internal flood ±1.
- Observation clip/fade on `GoGame.session.clip` (not in rules or Go3D JSON). Outside fade=0 is not drawn; outside clicks do not Place/mark dead.
- Clean separation: C++ server shell vs JavaScript game

This is **not** planar Go with a z overlay, and **not** a 3D view of a 2D board.

## Architecture Principles

- Keep **game logic in JavaScript** (client-side)
- Use **JSROOT** for visualization (ROOT objects)
- Use existing **THttpServer + Docker** as the serving layer
- Prefer modularity: Skills under `Skills/`
- `ProgramGo_SV` stays a pure shell

## Coding Style

- Comments in C++ and JavaScript
- Separate: Server (C++), Visualization (JSROOT), Rules (JS), UI (JS)
- **Board storage is `board[z][y][x]`** — always `GoGame.State.getStone` / `setStone` with `(x,y,z)`
- ACLiC: `SetSV.C` includes headers first; business `.cpp` must not add extra business `#include`s

## Module map

| Path | Namespace | Skill |
|------|-----------|--------|
| `Program_Go/GoGame/GoGame.{h,cpp}`, `SetSV.C`, `ProgramGo_SV/*`, `Launcher/*` | C++ / THttpServer | `thttpserver-integration` |
| `client/core/state.js` | `GoGame.State` | `go-game-state` |
| `client/core/coords.js` | `GoGame.Coords` | display vs index (`Plans/03_1_UserCoords.md`) |
| `client/core/rules.js` | `GoGame.Rules` | `go-rules-engine` |
| `client/core/scoring.js` | `GoGame.Scoring` | `go-scoring` (territory+captures, komi from state) |
| `client/core/record.js` | `GoGame.Record` | Go3D JSON export/import |
| `client/core/sgf.js` | `GoGame.Sgf` | deferred (P1 unused) |
| `client/render/board3d.js` | `GoGame.Board3D` | `go-board-render` |
| `client/render/board2d.js` | `GoGame.Board2D` | **not loaded / not mounted** (planar reference only) |
| `client/ui/controller.js` | `GoGame.UI` | `go-ui-controller` |
| `client/loader/go_loader.js` | `drawBoardPlaceholder` | opens dedicated page |
| `client/tests/rules_cases.js` | auto-run on load | P2 capture / ko / suicide (internal index) |

Skill docs: `Skills/<name>/SKILL.md`. Safe edits: `diff-change-workflow`.

## How to run

1. From repo root: `./run_container.sh` (mounts `Program_Go` + `Launcher`)
2. Inside container (WORKDIR = `Program_Go`): `Launcher/StartServer.sh`
3. Browser: **HTTPS port 13931**
4. Play on **`/gogame/gogame.htm`**. Index **GoBoard** only opens that page (no shell WebGL).

### insert_files + AutoLoad

Deploy list: `Launcher/insert_files/GoGame_files.txt` (may still copy unused planar files).  
Dedicated page scripts (see `gogame.htm`): no `go_board2d`, no SGF/scoring cases.

Shell AutoLoad (`GoGame::EnsureAutoLoad`):

```text
serverlog.js → go_state → go_rules → go_view_mode → go_board3d →
go_budget → go_render_ctrl → go_ui → go_rules_cases → go_loader
```

## How to test

On dedicated page load:

- `[go_rules_cases]` PASS (includes 1×1×1 suicide, N=5 center, cuboid 4×5×5 / 3×5×9)
- default `newGame().size === 4` and `sizeX===sizeY===sizeZ===4`

Console:

```js
GoGame.RulesTests && GoGame.RulesTests.runAll()
GoGame.UI.dispatch("play", {x:0,y:0,z:0})
```

## Manual acceptance (hotseat, P2)

See `Plans/03_P2_Capture.md` §8 (user opens the dedicated page). Display coords: `Plans/03_1_UserCoords.md` (not this apply).

## Non-goals (do not add in P2)

Online multiplayer, accounts, AI, GTP, planar 2D main board, slice-2D UI, SGF/territory scoring, user-coord conversion (05), odd-N boards, Firefox New Game camera, new C++ game class, `SetSV.C` include-model changes.

## Constraints (3D extras)

- Stones: `TEveGeoShapeExtract` + `TGeoSphere` on the **same** TGeoPainter extras; high `numfaces`/`numnodes`
- Reset view: camera home then re-attach extras; no persistent `drawExtraShape` wrap; do not toggle `select_in_view`
- Do not treat `focusCamera`/`collectVisibles` as “stones still there”
- No bare `TGeoBBox` as the sole `JSROOT.draw`; do not assume `THREE.BoxGeometry` is a constructor
- Do not call `nvidia-smi` every move
- Picking: camera ray → nearest of `sizeX*sizeY*sizeZ` lattice points (`dist ≤ 0.45`, tie-break smaller `t`)

## Patch workflow

Use `Skills/diff-change-workflow`: plan → unified diffs under `Prompts/patches/` → approve → apply. Split **move** vs **semantic** when both exist. 舊 phase diff 已移除，目錄現可新建。
