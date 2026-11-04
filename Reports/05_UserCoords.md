# 05 顯示座標 apply 摘要

**skill：** `Skills/diff-change-workflow/SKILL.md`  
**SSOT：** `Plans/03_1_UserCoords.md`（對照表一字不差：內部 0 1 2 3 ↔ 顯示 -3 -1 1 3）。  
不 reverse 04.x。`worldOf`／`Rules.play`／`rules_cases` 仍用內部 index。

| 給人看 | 內部 |
|--------|------|
| Message、著手紀錄、Hand hover | `GoGame.Coords.formatUser` |
| picking／play | 仍 `ix,iy,iz` |

`(0,0,0)` 顯示非法（`fromUser` → null）。軸刻字未做。

## 驗收（使用者自測）

1. 下內部 (0,0,0) 的角 → 印 `(-3,-3,-3)`。  
2. 距中心最近可下點印 `(±1,±1,±1)` 之一。  
3. 沒有可點的顯示 (0,0,0)。  
4. 提子／滾輪／旋轉與 04.x 相同。  
5. `[go_rules_cases]` 內部向量 PASS；`[go_coords_cases]` PASS。
