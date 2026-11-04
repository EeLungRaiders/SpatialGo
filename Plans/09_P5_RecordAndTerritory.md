# 09 P5 Plan：棋譜 JSON 與計分領地著色

**階段：** 只寫計畫。未改程式、未產 patch。  
**環境：** GrokBuild 在 podman 內；禁止再套映像；驗收為手動步驟；模組公開函式不要講成網路 API。  
**不修：** 提子、komi、Firefox／3D 相機、真 SGF 互通、切層 2D。

現況：4×4×4 可玩；目＋提子＋komi 6.5；ended 標死；英文 Message；顯示座標；軸。UI **沒有** Export／Load。舊 `sgf.js` 是平面 FF[4]，**不要假裝相容**。

---

## 1. 目標與非目標

**目標**

1. **棋譜**：能匯出／讀取並**正確重現**對局（含提子）。不是 SGF、不是 FF[4]。
2. **計分著色**：`ended` 且已有 `scoreResult` 時，空點分黑地／白地／dame 三色。活子仍黑白球；死子仍淡／X。

**非目標**

- Sabaki／GoGui／FF[4] 互通
- 變長 N、一檔多局
- 領地 TH2、2D overlay、每手 `clearDom` 整盤
- 改提子／劫／komi／軸／`worldOf`

---

## 2. JSON schema（建議 `.go3d.json`）

`coords: "user"` → 著手與 dead 用顯示座標 `{-3,-1,1,3}`；讀檔 `Coords.fromUser`。非法點 → **整檔失敗**，不下到一半。

**實例**（黑 (0,0,0) 內部＝顯示 (-3,-3,-3)；白提該子；黑 Pass）：

```json
{
  "format": "Go3D",
  "size": 4,
  "komi": 6.5,
  "coords": "user",
  "moves": [
    { "t": "play", "c": "B", "p": [-3, -3, -3] },
    { "t": "play", "c": "W", "p": [-1, -3, -3] },
    { "t": "pass", "c": "B" }
  ],
  "deadStones": [],
  "scoreResult": null
}
```

（第二手是否真提第一子依當時氣；重播必須走 `Rules.play`，與現場同一套，**禁止**只 `setStone` 不提子。）

可選尾：`deadStones: [[x,y,z], ...]`（顯示座標）；`scoreResult` 快照（讀檔後可 `Scoring.score` 核對，不一致英文警告但仍可載入局面）。

頭欄必填：`format==="Go3D"`、`size===4`、`coords==="user"`。缺一即失敗。

---

## 3. Load 重現步驟

```text
1. JSON.parse；校驗 format/size/coords
2. State.newGame({ komi })
3. 依 moves 順序：
     play → fromUser(p)；失敗或 play !ok → abort，state 不留下半局
     pass  → Rules.pass
     resign → Rules.resign（之後不得再有著手）
4. 若有 deadStones：僅當最終 phase==='ended' 才套用（fromUser）；
     否則忽略並英文警告
5. 若 ended：不自動當最終分；有死子則套用後等使用者 Score，
     或 Load 結束若檔內要求可呼叫一次 score（Plan 預設：套用死子後重算著色，
     與現場「標死立即重算」一致）
6. UI 換上新 state、redraw；失敗 Message 英文，盤面維持載入前
```

Export：從 `moveHistory` 轉出（play 的 x,y,z **toUser**）；附當前 `deadStones`／`scoreResult`。英文按鈕 Export（textarea + 可選下載）、Load（貼上或選檔）。

---

## 4. 領地著色

**何時：** 僅 `phase==='ended'` **且** 已有 `scoreResult`。playing／Undo 回 playing → 清著色。標死切換後重算 → 著色跟新 flood。

**資料：** `Scoring.score(state, { includePoints: true })` 回傳

```text
territory: {
  black, white, dame,
  points: { black: [{x,y,z},...], white: [...], dame: [...] }  // 內部 index
}
```

**禁止** UI 自己再 flood 一套。點數必須等於 Message 的 terr／dame。

**怎麼畫（主）：** 現況 `refreshEmptyMarkers` 已用 `TPolyMarker3D` 換空點、不 `clearDom` 整盤。P5 改為 **最多三組** Points（黑地／白地／dame 不同 `fMarkerColor`），只畫 `points.*`（含死子當空的格）。活子仍 extras 球；死子仍淡 alpha，**不要**把死子球塗成領地色。

**備案：** 若換色導致 extras／滾輪／tooltip 退步 → 關掉著色，只留數字。不要 TH2、不要 2D。

**picking：** ended 點活子仍標死；點空地／著色點 **不** `play`。

---

## 5. 檔案分派

| 路徑 | P5 | 不做 |
|------|-----|------|
| **新** `client/core/record.js` → `go_record.js` | Export／Load JSON；`toUser`／`fromUser`；重播只呼叫 Rules | **不**改名假裝 SGF；不改 `sgf.js` |
| `scoring.js` | `includePoints` 列出內部格點 | 不改目＋提子公式 |
| `tests/record_cases.js` | 匯出再載入局面一致；含一提 | — |
| `tests/scoring_cases.js` | 有 points 時長度＝ terr／dame 計數 | — |
| `ui/controller.js` | 英文 Export／Load／textarea；ended 著色觸發 | 不叫 SGF |
| `board3d.js` | ended+score 時三色空點標記；playing 灰淡點 | 不 clearDom 整盤；不 overlay 活／死球 |
| `gogame.htm`／AutoLoad／insert_files | 載入 `go_record.js`（coords／rules 之後） | 不載 board2d |
| `AGENTS.md`／README | apply 時短句 | 本 Plan 階段不動 |

舊 `sgf.js` 留檔不載入（與 board2d 相同策略）。

---

## 6. 測試

| # | 要點 |
|---|------|
| R1 | 空局 export／load → 空盤 |
| R2 | play＋capture＋pass 匯出再載入：`board`、`toPlay`、`captured*` 與現場一致 |
| R3 | 非法顯示座標或中途 `play !ok` → load 失敗，state 不變 |
| R4 | 不宣稱 FF[4] |
| T1 | `includePoints`：`points.black.length === territory.black`（白／dame 同） |
| T2 | 標死後 points 總空格（含死子格）與 Message 地＋dame 一致 |

---

## 7. 建議下一份

```text
Prompts/10_P5_Apply_RecordAndTerritory.txt
```

批准後才寫／執行。走 `diff-change-workflow`。

---

## 8. 手動驗收（apply 後使用者自測）

1. Export 一份含提子的 JSON；New Game；Load 後盤面與提子結果相同。  
2. 壞 JSON／越界座標 → 英文錯誤，盤不變。  
3. 兩 Pass 尚未 Score：空點仍是淡灰，無三色。  
4. Score 後黑地／白地／dame 可辨；活子黑白、死子淡。  
5. 標死再算：著色更新；點空地不下子。  
6. Undo Pass：著色消失。滾輪／軸／提子不退步。

---

## 9. 請使用者批准的是非題

未批准不得寫 10 apply。

1. **是否批准本 Plan？**
2. **檔案用 JSON + 顯示座標，可以嗎？**
3. **著色只在 ended 且已計分後，可以嗎？**

請回覆例如：「1 批准；2 JSON 顯示座標可以；3 只在計分後著色。」
