/**
 * Clip/fade observation window. Auto-runs on load. No DOM.
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || "assertion failed");
    }

    function runAll() {
        var B = GoGame.Board3D;
        var State = GoGame.State;
        if (!B || !State || typeof B.inClip !== "function") {
            console.error("[go_clip_cases] missing Board3D clip helpers");
            return { ok: false, passed: 0, failed: 1 };
        }
        var passed = 0, failed = 0;
        var prevSession = GoGame.session;
        function t(name, fn) {
            try {
                fn();
                passed++;
                console.log("[go_clip_cases] PASS:", name);
            } catch (e) {
                failed++;
                console.error("[go_clip_cases] FAIL:", name, e);
            }
        }

        t("Cfull inClip whole 4x4x4", function () {
            var s = State.newGame();
            GoGame.session = { state: s, clip: B.fullClipOf(s, 0) };
            assert(B.inClip(0, 0, 0), "origin");
            assert(B.inClip(3, 3, 3), "far");
            assert(!B.inClip(4, 0, 0), "oob");
        });

        t("Clayer z only", function () {
            var s = State.newGame({ size: 9 });
            GoGame.session = {
                state: s,
                clip: { x0: 0, x1: 8, y0: 0, y1: 8, z0: 4, z1: 4, fade: 0 }
            };
            assert(B.inClip(0, 0, 4), "layer");
            assert(!B.inClip(0, 0, 3), "below");
            assert(!B.inClip(4, 4, 5), "above");
        });

        t("Cfade0 skip outside stones", function () {
            var s = State.newGame({ size: 4 });
            State.setStone(s, 0, 0, 0, State.BLACK);
            State.setStone(s, 3, 3, 3, State.WHITE);
            GoGame.session = {
                state: s,
                clip: { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0, fade: 0 }
            };
            var geo = B.buildStonesGeoExtract(s);
            assert(geo && geo.fElements && geo.fElements.arr.length === 1, "one stone");
        });

        t("Cfade1 draws outside live", function () {
            var s = State.newGame({ size: 4 });
            State.setStone(s, 0, 0, 0, State.BLACK);
            State.setStone(s, 3, 3, 3, State.WHITE);
            GoGame.session = {
                state: s,
                clip: { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0, fade: 1 }
            };
            var geo = B.buildStonesGeoExtract(s);
            assert(geo && geo.fElements && geo.fElements.arr.length === 2, "both stones");
        });

        t("Cgrid clip z-layer is a sheet", function () {
            var s = State.newGame({ size: 9 });
            GoGame.session = {
                state: s,
                clip: { x0: 0, x1: 8, y0: 0, y1: 8, z0: 4, z1: 4, fade: 0 }
            };
            var grid = B.createAxisGrid();
            assert(grid && grid.length === 18, "9+9 in-plane lines, no z-run, got " + (grid && grid.length));
            var frame = B.createCubeFrame();
            assert(frame && frame.length >= 1, "clip frame");
        });

        t("Cgrid full 4x4x4 count", function () {
            var s = State.newGame();
            GoGame.session = { state: s, clip: B.fullClipOf(s, 0) };
            var grid = B.createAxisGrid();
            assert(grid && grid.length === 48, "16*3, got " + (grid && grid.length));
        });

        t("Alabels six ends ignore clip", function () {
            var s = State.newGame({ size: 9 });
            GoGame.session = { state: s, clip: B.fullClipOf(s, 0) };
            var a = B.createAxisLabels();
            assert(a && a.length === 25, "25 strokes got " + (a && a.length));
            assert(a[0].obj.fLineColor === 2, "X red");
            GoGame.session.clip = { x0: 0, x1: 8, y0: 0, y1: 8, z0: 4, z1: 4, fade: 0 };
            var b = B.createAxisLabels();
            assert(b.length === a.length, "clip does not drop labels");
        });

        t("Creset keeps fade", function () {
            var s = State.newGame({ sizeX: 4, sizeY: 5, sizeZ: 5 });
            GoGame.session = {
                state: s,
                clip: { x0: 1, x1: 1, y0: 0, y1: 0, z0: 0, z1: 0, fade: 0.4 }
            };
            var c = B.resetClipToFull(s);
            assert(c.x0 === 0 && c.x1 === 3 && c.y1 === 4 && c.z1 === 4, "full");
            assert(c.fade === 0.4, "fade kept");
        });

        GoGame.session = prevSession;
        var summary = { ok: failed === 0, passed: passed, failed: failed };
        console.log("[go_clip_cases] done", summary);
        return summary;
    }

    GoGame.ClipTests = { runAll: runAll };
    runAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
