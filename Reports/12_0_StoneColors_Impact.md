# 12_0 棋子換色影響評估

**性質：** 只讀。未改程式、未產 patch、未寫 12 apply／Plans。  
**功能尚未批准實作。** 11 的暫停／不做清單仍有效。

規則仍是先手＝`State.BLACK`（1）、後手＝`State.WHITE`（2）。只評估 3D／UI 外觀。

---

## 現況色

| 角色 | 來源 | 值 |
|------|------|-----|
| 先手球 | `board3d.js` 常數 `GEO_RGBA_BLACK` → `TEveGeoShapeExtract.fRGBA` | `[0.06, 0.06, 0.06, 1]` |
| 後手球 | `GEO_RGBA_WHITE` 同上 | `[1, 1, 1, 1]` |
| 後手「陰影邊框」 | `polishGeoStoneMaterials`：只對「白」球（`fRGBA` 三通道 ≥0.9 **或** 節點名 `/^w\d/`）設 `DoubleSide`、emissive `(0.55,0.55,0.55)`、`emissiveIntensity≥0.45` | **不是** ROOT 預設邊框，是 JS 後處理 |
| 死子 | 同一 `fRGBA`，`alpha=0.32` | 淡化 |
| Hand | `refreshHandStone` CSS `#111`／`#f4f4f4`，邊 `#333` | 與 3D 分開寫死 |
| 領地空點 | ROOT `fMarkerColor` 1／10／5（黑／淺／黃 dame） | 與子色無關的調色盤 |

棋譜 `record.js` 只寫 `"B"`／`"W"`，不存 RGB。

---

## 檔案影響與 New Game UI

| 檔 | 換色時 |
|----|--------|
| `board3d.js` | 必動：建球 rgba 改讀外觀表；polish 不能再只認「夠白」／`w` 前綴 |
| `ui/controller.js` | New Game 兩個 `<input type="color">`（先手／後手）；Hand 預覽跟色；建議一顆 **Defaults** 回到現況黑／帶陰影白 |
| `state.js` | **不必**改 `BLACK`／`WHITE`／`newGame` 語意。外觀可放 `session.stoneColors` 或 `state` 旁的 UI 偏好（**不要**當規則欄位） |
| `scoring.js` 領地色 | 不必改公式；若子色靠近 1／10／5 要對比檢查 |
| `record.js` | **不應**寫 `#rrggbb` |

New Game：**兩個色盤 + Defaults** 即可，不必第三套「主題」。色在 New Game 生效（或寫入偏好後新局用），避免中局換色搞亂死子／著色。

---

## 分級：**中**

- **不是小：** 白球邊框綁在「夠白」偵測；死子淡化、Hand、領地三色對比、文案 Black／White 都要決策。
- **不是大：** Rules／棋譜／計分語意可維持 1／2 與 B／W。不必改 `play`、komi、JSON `c`。

---

## 風險

1. **白球陰影：** 現況 polish 用亮度門檻。自訂淺紅／灰也會被當白而洗成 emissive 白。自訂深藍當「後手」則沒有邊框。  
   建議：預設白走現況 polish；**任意自訂色一律加加深色輪廓**（或依亮度自動：淺色加深色輪廓、深色不加 emissive 洗白）。
2. **兩色太近／撞領地：** 兩色歐氏距離下限；避開 dame 黃、純黑／純白領地點。Defaults 保證可玩對比。
3. **extras／Reset／提子：** 仍走同一 extras 重建。只改 `fRGBA`／polish 條件，不應再 `clearDom` 整盤。風險是 polish 誤傷非白自訂色 → 提子後顏色跳。須用「是否後手」旗標（節點名 `w*` 已有）而不是亮度。
4. **棋譜：** 繼續只存 B／W。外觀是客戶端偏好，Load 棋譜不改別人的色。

---

## 建議：**可以進行，範圍只限外觀**

不要現在做成大功能。下一份建議 **`Prompts/12_1_P6_Apply_StoneColors.txt`**（或極短 12 Plan 再 apply）：New Game 兩色盤 + Defaults；`board3d` rgba／polish 跟「先手／後手」走；Hand 跟色；棋譜與 Message 仍 Black／White。

不建議把 Message／banner 改成色名（「Red wins」），計分與棋譜會對不齊。

---

## 給使用者的三題（本階段不當已批准實作）

1. **是否同意評估結論（小／中／大）？** 本報告：**中**。  
2. **自訂色是否一律加深色輪廓，預設白保留現況陰影？**  
3. **棋譜與 Message 是否維持 Black／White，不改成色名？**
