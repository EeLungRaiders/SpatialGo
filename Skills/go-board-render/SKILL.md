---
name: go-board-render
description: >
  Render spatial 4×4×4 lattice via ROOT/JSROOT 3D: TPolyLine3D grid,
  TEveGeoShapeExtract+TGeoSphere extras, ray-to-lattice picking.
  Triggers: /go-board-render, board3d, JSROOT, TGeo.
---

# go-board-render

**只有 3D。** 透明立方格 + 球。不當可玩 2D。`board2d.js` 留檔不載入、不 mount。

## 檔案

| 路徑 | 說明 |
|------|------|
| `client/render/board3d.js` | `GoGame.Board3D` |
| `client/render/view_mode.js` | 固定 `'3d'` |
| `client/render/controller.js` | 只 `Board3D.mount` |

## 呈現

- `worldOf(x,y,z)` **只定義一次**（中心 1.5，CELL=1，球心在格點，R≈0.32）
- 先畫立方體 12 邊 AABB，再三軸 `TPolyLine3D`
- 空點淡 `TPolyMarker3D`（失敗不卡關）
- 子：extras `drawExtras`；高 numfaces／numnodes；暫時 wrap `drawExtraShape` 後還原
- 建樹 z,y,x；加子／Undo 全量 `clearDom`+重建
- Reset：`focusCamera` 後高上限重掛；禁止常駐 wrap；禁止改 `select_in_view`
- 禁止裸 `TGeoBBox` 當唯一 draw；不要假設 `THREE.BoxGeometry` 是 constructor
- 相機 up／framing 沿用現況 painter，不另發明 Y-up／Z-up

## Picking（主方案）

相機射線對 64 格點吸附：`dist ≤ 0.45`，平手較小 `t`。回傳 `{x,y,z}`。

```text
GoGame.Board3D.mount(host, { state, onPlayRequest, getState })
boardCtrl.render / remount / pickAtClient / resetView / setPlaceMode
```
