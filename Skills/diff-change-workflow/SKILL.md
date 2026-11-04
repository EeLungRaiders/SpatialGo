---
name: diff-change-workflow
description: >
  After planning code changes, produce git-style unified diff file(s) first.
  Prefer splitting pure moves/relocations from semantic changes into stacked
  diffs. Support review, apply, and reverse in order. Use when the user wants
  patch-style edits, create/update via unified diff, or safe rollback.
  Triggers: /diff-change, git diff, apply patch, reverse patch, unified diff,
  move diff, semantic diff, stacked patch.
---

# diff-change-workflow

## 職責說明

本 Skill 定義本專案的「安全改檔流程」：

1. 先 Plan
2. 再產生 **unified git diff**（可多份、可堆疊）
3. 把 diff 寫到獨立檔案供人工檢查
4. 確認後才 apply
5. 需要時可 reverse 還原

適用於：

- 新增檔案
- 修改檔案
- 跨檔搬移
- 小範圍修正
- 需要可回退的變更

## 標準流程

### Step A — Plan

- 先說明要改什麼、為什麼
- 列出會動到的檔案
- 標註哪些變更是 **move（搬移）**、哪些是 **semantic（意義改動）**
- 先不直接改工作區（除非使用者明確說可直接改）

### Step B — 產生 diff 檔

- 產出 unified diff（git diff 風格）
- 預設寫入：
  - `Prompts/patches/<主題>_01_move.diff`（若有搬移）
  - `Prompts/patches/<主題>_02_semantic.diff`（意義改動）
  - 需要時可有 `_03_...` 等後續
- 或使用者指定路徑
- diff 必須可被人工閱讀，並盡量可被 `git apply` / `patch` 使用
- 在回覆中完整顯示每個 diff 的內容（不只寫檔）

### Step C — 等待批准

- 使用者審查 diff
- 使用者明確說 approve / apply 後才套用

### Step D — Apply

- 依序號 **由小到大** 套用
- 回報成功 / 失敗
- 若失敗，說明衝突點與已套用到哪一份

### Step E — Reverse（可選）

- 依序號 **由大到小** reverse
- 用於回退這次變更序列

## 拆分策略（搬移 vs 意義改動）

若一次變更同時包含「程式搬移」與「行為/功能改動」，**預設拆成至少兩個 diff**。

### 1. move（單純搬移）

僅限「相同內容換位置」，行為必須可被視為等價：

允許：
- 跨檔：同一段程式從 A 檔剪下、貼到 B 檔（可僅改最少的匯出/掛名）
- 同檔：同一段程式移到新函數名下，舊呼叫點改為呼叫新函數（wrapper），
  函數體內容實質相同

不允許算作 move：
- 重寫演算法或控制流再宣稱搬移
- 一邊抽函數一邊改 API 語意、錯誤處理、狀態流
- 新功能、新 DOM、新按鈕、新模組行為
- 「為了之後好用而重構」但內容已明顯不同

若無法做到「內容實質相同」，不要標 move，改標 semantic，
或拆成：
- 01_extract_or_refactor（可選，type: semantic）
- 02_feature（semantic）

### 2. semantic（意義改動）

檔名建議：`*_02_semantic.diff`（可再拆 03、04…）

包含：

- 新功能、邏輯修正、API 變更
- **從 0 建立且具實際行為的新檔**（視為 semantic）
- bugfix、與驗收相關的測試變更
- 行為會改變的重構

### 3. 無法乾淨拆開時

若技術上難以拆成兩份可獨立 apply 的 patch：

- 允許單一 diff
- 但檔頭與正文必須用清楚章節標註：
  - `## MOVE`
  - `## SEMANTIC`
- 並在 purpose 說明為何無法拆分

## 檔名與順序

### 建議命名

```text
Prompts/patches/<PhaseOrTopic>_01_move.diff
Prompts/patches/<PhaseOrTopic>_02_semantic.diff
Prompts/patches/<PhaseOrTopic>_03_semantic.diff
```

### Apply 順序

1. `01_move`（若有）
2. `02_semantic`
3. `03_...`

### Reverse 順序

1. 最大序號先 reverse
2. 再往小序號

範例（樹內無 08_Phase3_UI_*.diff，只示範 apply／reverse 順序）：

```text
# apply
git apply --whitespace=nowarn Prompts/patches/08_Phase3_UI_01_move.diff
git apply --whitespace=nowarn Prompts/patches/08_Phase3_UI_02_semantic.diff

# reverse
git apply -R --whitespace=nowarn Prompts/patches/08_Phase3_UI_02_semantic.diff
git apply -R --whitespace=nowarn Prompts/patches/08_Phase3_UI_01_move.diff
```

## diff 格式要求

1. 使用 unified diff
2. 新增檔案要用 `/dev/null` 起點
3. 路徑以專案相對路徑為準
4. 一次一個主題；有搬移+語意時用 stacked diffs
5. 每個 diff 檔開頭必須有說明區

### 檔頭必填欄位

```text
# title: <短標題>
# type: move | semantic
# purpose: >
#   <這份 patch 做什麼、不做什麼>
# files:
#   - path/to/file1
#   - path/to/file2
# sequence: 1 of 2
# apply:   git apply --whitespace=nowarn Prompts/patches/<this>.diff
# reverse: git apply -R --whitespace=nowarn Prompts/patches/<this>.diff
# stack_apply: >
#   # 完整序列（若有多份）
# stack_reverse: >
#   # 完整倒序
# notes: >
#   # 例如：此為搬移，行為應與套用前等價
```

### move 檔頭補充

```text
# type: move
# behavior: equivalent (same logic, new location only)
# relocation:
#   from: file/path + optional old function name
#   to: file/path + optional new function name
# sameness: body text essentially unchanged except renames/exports
```

### semantic 檔頭補充

```text
# type: semantic
# behavior: changed
# highlights:
#   - new API ...
#   - new UI ...
```

## 模組公開約定

當使用者要求「用 diff 流程」時，必須遵守：

1. 先給變更摘要（含 move / semantic 如何拆）
2. 再寫 diff 檔（一個或多個）
3. 回傳以下資訊：
   - 每個 diff 的路徑與 type
   - 影響檔案列表
   - 完整 stack 的 apply 指令（依序）
   - 完整 stack 的 reverse 指令（倒序）
4. 在回覆中完整貼出每個 diff 原文
5. 非經批准，不直接改檔

若使用者說：

- 請使用 diff-change-workflow
- 先產 diff
- 可 reverse
- 搬移與意義改動要分開

即啟用本 Skill，並啟用拆分策略。

## 驗收標準

- [ ] 有獨立 `.diff` 檔（或 stacked 多份）
- [ ] 每個 diff 有完整檔頭（含 type）
- [ ] 有搬移+語意時，已拆分或已在單檔標註 MOVE/SEMANTIC
- [ ] diff 可讀、路徑正確
- [ ] apply 順序明確，可依序套用
- [ ] reverse 順序明確，可倒序回退
- [ ] apply 後變更符合計畫
- [ ] 未混入無關重構

## 禁止事項

- 禁止未經批准直接改檔（當使用者指定走 diff 流程時）
- 禁止產出無法對應實際檔案路徑的假 diff
- 禁止一次混多個不相干主題
- 禁止把大段搬移與大段新邏輯混在同一個未標註的 diff 裡
- 禁止用 diff 流程掩蓋大範圍無關重寫
- 禁止只改測試來「通過」行為錯誤，卻標成無關的 move


## Phase patch 命名慣例（本專案）

```text
Prompts/patches/NN_PhaseX_<Topic>_01_move.diff      # 若有 pure move
Prompts/patches/NN_PhaseX_<Topic>_01_semantic.diff  # 或 _02_semantic
```

- 無搬移時可**只產 semantic**，檔頭註明「無 pure move / 無 move」
- move = 相同邏輯換位置（跨檔剪貼或同檔 extract + thin wrapper）；重寫控制流勿標 move
- apply 小→大；reverse 大→小；批准後才 apply

## 與其他 Skill 的關係

- 可套用在任何實作 Skill 之上（Phase 修正、UI、render 重構都可用）
- 不取代業務 Skill，只約束「如何提交變更」
- 與本專案 ACLiC / SetSV.C 契約無關時，不擅自改編譯模型；若 patch 動到 include/編譯組織，須在 semantic diff 中明確標註

