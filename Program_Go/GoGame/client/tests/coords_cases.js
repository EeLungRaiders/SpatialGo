/**
 * Display-coordinate table vs Plans/03_1_UserCoords.md. Auto-runs on load.
 * Does not replace rules_cases (those use internal index).
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};
    var C = GoGame.Coords;

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || "assertion failed");
    }

    function runAll() {
        if (!C) {
            console.error("[go_coords_cases] GoGame.Coords missing");
            return { ok: false, passed: 0, failed: 1 };
        }
        var passed = 0;
        var failed = 0;
        function t(name, fn) {
            try {
                fn();
                passed++;
                console.log("[go_coords_cases] PASS:", name);
            } catch (e) {
                failed++;
                console.error("[go_coords_cases] FAIL:", name, e);
            }
        }

        t("axis 0 1 2 3 <-> -3 -1 1 3", function () {
            assert(C.axisToUser(0, 4) === -3, "0 -> -3");
            assert(C.axisToUser(1, 4) === -1, "1 -> -1");
            assert(C.axisToUser(2, 4) === 1, "2 -> 1");
            assert(C.axisToUser(3, 4) === 3, "3 -> 3");
            assert(C.axisFromUser(-3, 4) === 0, "-3 -> 0");
            assert(C.axisFromUser(-1, 4) === 1, "-1 -> 1");
            assert(C.axisFromUser(1, 4) === 2, "1 -> 2");
            assert(C.axisFromUser(3, 4) === 3, "3 -> 3");
            assert(C.fromUser(0, 0, 0, 4) === null, "N=4 no center");
        });

        t("N=1 N=3 N=5 display step 2", function () {
            assert(C.axisToUser(0, 1) === 0, "N=1");
            assert(C.fromUser(0, 0, 0, 1).ix === 0, "N=1 from");
            assert(C.axisToUser(0, 3) === -2 && C.axisToUser(1, 3) === 0 && C.axisToUser(2, 3) === 2, "N=3");
            assert(C.axisToUser(2, 5) === 0, "N=5 center");
            assert(C.fromUser(0, 0, 0, 5).ix === 2, "N=5 from center");
            assert(C.axisToUser(0, 5) === -4 && C.axisToUser(4, 5) === 4, "N=5 ends");
            assert(C.fromUser(2, 0, 0, 5).ix === 3, "N=5 neighbor +2");
            assert(C.fromUser(1, 0, 0, 5) === null, "N=5 odd user illegal");
        });

        t("corner internal 0,0,0 is display (-3,-3,-3)", function () {
            var u = C.toUser(0, 0, 0, 4);
            assert(u.x === -3 && u.y === -3 && u.z === -3, JSON.stringify(u));
            assert(C.formatUser(0, 0, 0, 4) === "(-3,-3,-3)", C.formatUser(0, 0, 0, 4));
        });

        t("nearest playable (±1,±1,±1) is internal {1,2}^3", function () {
            var u = C.toUser(2, 2, 2, 4);
            assert(u.x === 1 && u.y === 1 && u.z === 1, "internal 2,2,2 -> (1,1,1)");
            var i = C.fromUser(1, 1, 1, 4);
            assert(i.ix === 2 && i.iy === 2 && i.iz === 2, "display (1,1,1) -> 2,2,2");
            i = C.fromUser(-1, -1, -1, 4);
            assert(i.ix === 1 && i.iy === 1 && i.iz === 1, "(-1,-1,-1) -> 1,1,1");
        });

        t("illegal display (0,0,0) and even/mixed return null", function () {
            assert(C.fromUser(0, 0, 0, 4) === null, "(0,0,0)");
            assert(C.fromUser(2, 1, 1, 4) === null, "(2,1,1)");
            assert(C.fromUser(1.5, 1, 1, 4) === null, "non-int");
            assert(C.fromUser(5, 1, 1, 4) === null, "oob user");
        });

        t("round-trip all 64 lattice points", function () {
            var ix, iy, iz, u, b;
            for (iz = 0; iz < 4; iz++) {
                for (iy = 0; iy < 4; iy++) {
                    for (ix = 0; ix < 4; ix++) {
                        u = C.toUser(ix, iy, iz, 4);
                        b = C.fromUser(u.x, u.y, u.z, 4);
                        assert(b && b.ix === ix && b.iy === iy && b.iz === iz,
                            ix + "," + iy + "," + iz);
                    }
                }
            }
        });

        t("Z4 N=4 corner and no center", function () {
            var u = C.toUser(0, 0, 0, 4);
            assert(u.x === -3 && u.y === -3 && u.z === -3, "corner");
            assert(C.fromUser(0, 0, 0, 4) === null, "no (0,0,0)");
        });

        t("IntC cuboid per-axis step 2", function () {
            var st = { sizeX: 4, sizeY: 5, sizeZ: 5 };
            var u = C.toUser(0, 0, 0, st);
            assert(u.x === -3 && u.y === -4 && u.z === -4, JSON.stringify(u));
            assert(C.fromUser(0, 0, 0, st) === null, "X even: no (0,0,0)");
            assert(C.toUser(3, 4, 4, st).x === 3, "far x");
            assert(C.fromUser(-3, 0, 0, st).ix === 0, "from user");
            assert(C.fromUser(-3, 0, 0, st).iy === 2, "Y center");
        });

        t("U3 3x5x9 center (0,0,0)", function () {
            var st = { sizeX: 3, sizeY: 5, sizeZ: 9 };
            var u = C.toUser(1, 2, 4, st);
            assert(u.x === 0 && u.y === 0 && u.z === 0, JSON.stringify(u));
            var i = C.fromUser(0, 0, 0, st);
            assert(i.ix === 1 && i.iy === 2 && i.iz === 4, JSON.stringify(i));
        });

        var summary = { ok: failed === 0, passed: passed, failed: failed };
        console.log("[go_coords_cases] done", summary);
        return summary;
    }

    GoGame.CoordsTests = { runAll: runAll };
    runAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
