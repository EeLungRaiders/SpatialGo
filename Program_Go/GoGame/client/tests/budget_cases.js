/**
 * GoGame.Budget test cases — static estimate acceptance (26_3).
 * Auto-runs runAll() on load.
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};
    var Budget = GoGame.Budget;

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || "assertion failed");
    }

    function runAll() {
        if (!Budget || typeof Budget.estimate3dBudget !== "function") {
            console.error("[go_budget_cases] GoGame.Budget missing");
            return { passed: 0, failed: 1 };
        }
        var St = GoGame.State;
        if (St && St.SIZE === 4) {
            console.log("[go_budget_cases] skip (spatial 4×4×4; plane budget model deferred)");
            return { passed: 0, failed: 0, skipped: true };
        }
        var passed = 0;
        var failed = 0;

        function check(name, fn) {
            try {
                fn();
                passed++;
                console.log("[go_budget_cases] PASS " + name);
            } catch (e) {
                failed++;
                console.error("[go_budget_cases] FAIL " + name, e && e.message ? e.message : e);
            }
        }

        check("19x19 sphere magnitude", function () {
            var r = Budget.estimate3dBudget(19, 19, "sphere");
            assert(r.ok, r.message);
            assert(r.N === 361, "N");
            assert(r.sphere.trisEst === 361 * 384, "tris exact N*384");
            assert(r.sphere.trisEst > 1.3e5 && r.sphere.trisEst < 1.5e5, "tris ~1.4e5");
            assert(typeof r.sphere.gbEstRough === "number" && isFinite(r.sphere.gbEstRough), "gbEstRough number");
            // 361*384*2048/GiB ≈ 0.264; keep loose band for coefficient stability
            assert(r.sphere.gbEstRough > 0.2 && r.sphere.gbEstRough < 0.35, "gbEstRough ~0.26 GiB");
            assert(Budget.BYTES_PER_TRI_ROUGH === 2048, "BYTES_PER_TRI_ROUGH");
            assert(r.framework.gridLines === 38, "grid");
            assert(r.sphere.whiteOutlineExtraSpheres === 0, "single white sphere");
        });

        check("37x37 sphere magnitude", function () {
            var r = Budget.estimate3dBudget(37, 37);
            assert(r.ok, r.message);
            assert(r.N === 1369, "N");
            assert(r.sphere.trisEst > 5e5 && r.sphere.trisEst < 5.5e5, "tris ~5.3e5");
        });

        check("50x50 sphere magnitude", function () {
            var r = Budget.estimate3dBudget(50, 50, "sphere");
            assert(r.ok, r.message);
            assert(r.N === 2500, "N");
            assert(r.sphere.trisEst === 2500 * 384, "tris");
            assert(r.sphere.trisEst > 9e5 && r.sphere.trisEst < 1e6, "tris ~9.6e5");
        });

        check("reject out of range", function () {
            var r = Budget.estimate3dBudget(0, 19);
            assert(!r.ok, "expect fail");
            r = Budget.estimate3dBudget(19, 51);
            assert(!r.ok, "expect fail");
        });

        check("marker contrast present", function () {
            var r = Budget.estimate3dBudget(19, 19, "marker");
            assert(r.ok, r.message);
            assert(r.mode === "marker", "mode");
            assert(r.marker.stoneMarkerObjects === 3, "3 marker objs");
            assert(r.marker.pointsTotalEst === 361 + 180, "body+outline approx");
        });

        console.log("[go_budget_cases] done", { passed: passed, failed: failed });
        return { passed: passed, failed: failed };
    }

    GoGame.BudgetTests = { runAll: runAll };
    runAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
