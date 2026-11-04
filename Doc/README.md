本檔是開發過程中由 GrokBuild 產生的說明，保留當時的架構與階段紀錄。
本檔在 `Doc/`。下面文件連結從這裡往專案根（`../`）。`./run_container.sh` 在專案根執行。

# SpatialGo — 立體空間圍棋 N×N×N

Hotseat **spatial Go** on **ROOT THttpServer + JSROOT**: axes **X/Y/Z = 1..9** (default 4×4×4), six-neighbour, **3D only**. UI has three size menus; Cube sets 4×4×4. Observation clip/fade is a view window (not stored in the record).

P5: Go3D JSON record in a textarea (Export/Load). After Score, empty points color as Black/White/dame territory. Komi selectable 0.5–19.5 (default 6.5). Moves per turn 1–6 (default 1). Not SGF.

演進：P1 定 4×4×4 與六鄰 → P2 提子與劫 → P4 區域計分 → P5 Go3D 棋譜 → P7 立方邊長 → P8 長方體 → P9 觀察用 clip／淡出 → P10 可選貼目與每手連下。細節在 `Plans/`，不必重跑 `Prompts/`。

## Quick start

```bash
# Host
./run_container.sh

# Inside container (cwd / WORKDIR is Program_Go mount)
Launcher/StartServer.sh
```

Open **`https://<host>:13931/gogame/gogame.htm`**.  
Index **GoBoard** only launches that dedicated page (no WebGL in the shell tab).

## Docs

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Architecture, module map, constraints |
| [Plans/01_P1_SpatialGo_4x4x4.md](../Plans/01_P1_SpatialGo_4x4x4.md) | P1 plan (approved) |
| [Plans/03_P2_Capture.md](../Plans/03_P2_Capture.md) | P2 capture / ko / ended |
| [Plans/03_1_UserCoords.md](../Plans/03_1_UserCoords.md) | User-facing coordinates (05) |
| [Plans/16_P8_CuboidData.md](../Plans/16_P8_CuboidData.md) | P8 cuboid sizeX/Y/Z |
| [Plans/19_P9_ClipFade.md](../Plans/19_P9_ClipFade.md) | P9 observation clip / fade |
| [Plans/22_P10_KomiAndMultiMove.md](../Plans/22_P10_KomiAndMultiMove.md) | P10 komi and moves per turn |
| [Reports/00_P0_ReadOnly_Audit.md](../Reports/00_P0_ReadOnly_Audit.md) | P0 audit |
| [Prompts/](../Prompts/) | Spatial-Go prompts (from 01) |

## Smoke checks

Dedicated page console:

- `[go_rules_cases]` — PASS  
- `GoGame.State.SIZE === 4`  
- Lattice (not a wooden 2D board); Place / capture / Undo; Pass×2 ends without score; Reset view keeps stones  

## Stack (short)

- **C++**: `ProgramGo_SV` shell + `GoGame` (Register holder, AutoLoad, `/gogame/`)  
- **JS**: `State` / `Rules` / `Board3D` / `UI` under `window.GoGame`  
- **Board**: `TPolyLine3D` cube + `TGeoSphere` extras  

## License / image

Uses project image `jsroot_forgo3d_<user>` (ROOT 6.40 + JSROOT). Do not bump ROOT/Docker casually. GrokBuild must not wrap another game container.
