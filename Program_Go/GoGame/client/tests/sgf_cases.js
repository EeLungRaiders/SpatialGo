/**
 * 舊參考，已不使用。SGF deferred。State.SIZE===4 時 skip。
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};
    var State = GoGame.State;
    var Rules = GoGame.Rules;
    var Sgf = GoGame.Sgf;

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || "assertion failed");
    }

    function boardStr(state) {
        var w = state.width != null ? state.width : state.size;
        var h = state.height != null ? state.height : state.size;
        var lines = [];
        for (var y = 0; y < h; y++) {
            lines.push(state.board[y].join(""));
        }
        return lines.join("/");
    }

    var cases = [];
    function test(name, fn) {
        cases.push({ name: name, fn: fn });
    }

    test("coord inverse pd", function () {
        var pt = Sgf.toSgfPoint(15, 3, 19);
        assert(pt === "pd", "expected pd got " + pt);
        var fp = Sgf.fromSgfPoint("pd", 19);
        assert(!fp.pass && !fp.error && fp.x === 15 && fp.y === 3, "from pd");
    });

    test("empty point is pass", function () {
        var fp = Sgf.fromSgfPoint("", 19);
        assert(fp.pass, "empty is pass");
        fp = Sgf.fromSgfPoint("tt", 19);
        assert(fp.pass, "tt is pass");
    });

    test("coord alphabet a-z then A-Z", function () {
        // indices 0..25 = a..z; 26..51 = A..Z
        assert(Sgf.toSgfPoint(0, 0, 50) === "aa", "0,0 → aa");
        assert(Sgf.toSgfPoint(25, 0, 50) === "za", "25 → z");
        assert(Sgf.toSgfPoint(26, 0, 50) === "Aa", "26 → A");
        assert(Sgf.toSgfPoint(49, 49, 50) === "XX", "49,49 → XX on 50");
        var fp = Sgf.fromSgfPoint("Aa", 50);
        assert(!fp.pass && !fp.error && fp.x === 26 && fp.y === 0, "from Aa");
        fp = Sgf.fromSgfPoint("XX", 50);
        assert(!fp.pass && !fp.error && fp.x === 49 && fp.y === 49, "from XX");
        // out of range on smaller board
        fp = Sgf.fromSgfPoint("za", 9);
        assert(fp.error, "z out of range on 9");
        // invalid char
        fp = Sgf.fromSgfPoint("@@", 19);
        assert(fp.error, "invalid chars");
    });

    test("tt is real point on size > 19", function () {
        var fp = Sgf.fromSgfPoint("tt", 50);
        assert(!fp.pass && !fp.error && fp.x === 19 && fp.y === 19, "tt on 50 is (19,19)");
    });

    test("tt pass rule uses both dims ≤19", function () {
        // width≤19 && height≤19 → pass
        var fp = Sgf.fromSgfPoint("tt", 5, 3);
        assert(fp.pass, "tt pass on 5×3");
        // either dim > 19 → not pass (may be OOB on short axis)
        fp = Sgf.fromSgfPoint("tt", 25, 9);
        assert(!fp.pass, "tt not pass when width>19");
        assert(fp.error || (fp.x === 19 && fp.y === 19), "tt as point or OOB on 25×9");
    });

    test("missing SZ defaults to 19", function () {
        var imp = Sgf.importSgf("(;FF[4]GM[1]KM[6.5];B[pd])");
        assert(imp.ok, imp.message);
        assert(imp.state.size === 19, "default size 19, got " + imp.state.size);
    });

    test("short game round-trip", function () {
        var s = State.newGame({ size: 19, komi: 6.5 });
        var r;
        r = Rules.play(s, 3, 3); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 15, 3); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 3, 15); assert(r.ok, r.message); s = r.state;
        var text = Sgf.exportSgf(s);
        assert(text.indexOf("FF[4]") >= 0, "FF[4]");
        assert(text.indexOf("GM[1]") >= 0, "GM[1]");
        assert(text.indexOf("SZ[19]") >= 0, "SZ[19]");
        assert(text.indexOf("SZ[19:19]") < 0, "must not export SZ[19:19]");
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.toPlay === s.toPlay, "toPlay");
        assert(boardStr(imp.state) === boardStr(s), "board mismatch");
        assert(imp.state.moveHistory.length === s.moveHistory.length, "history length");
    });

    test("pass round-trip", function () {
        var s = State.newGame({ size: 19 });
        s = Rules.play(s, 3, 3).state;
        s = Rules.pass(s).state;
        var text = Sgf.exportSgf(s);
        assert(/W\[\]/.test(text) || /B\[\]/.test(text), "pass brackets: " + text);
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.passCount === s.passCount, "passCount");
        assert(boardStr(imp.state) === boardStr(s), "board after pass");
    });

    test("capture round-trip", function () {
        // Same capture sequence as rules tests, on 19 board (corner)
        var s = State.newGame({ size: 19 });
        s = Rules.play(s, 0, 1).state;
        s = Rules.play(s, 0, 0).state;
        s = Rules.play(s, 1, 0).state;
        assert(s.board[0][0] === State.EMPTY, "precondition capture");
        assert(s.capturedWhite === 1, "precondition capturedWhite");
        var text = Sgf.exportSgf(s);
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.board[0][0] === State.EMPTY, "still empty after import");
        assert(imp.state.capturedWhite === 1, "capturedWhite after import");
        assert(boardStr(imp.state) === boardStr(s), "board after capture import");
    });

    test("size 9 round-trip", function () {
        var s = State.newGame({ size: 9, komi: 6.5 });
        var r;
        r = Rules.play(s, 2, 2); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 6, 2); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 2, 6); assert(r.ok, r.message); s = r.state;
        var text = Sgf.exportSgf(s);
        assert(text.indexOf("SZ[9]") >= 0, "SZ[9] in export: " + text);
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.size === 9, "size 9");
        assert(imp.state.width === 9 && imp.state.height === 9, "9 square dims");
        assert(boardStr(imp.state) === boardStr(s), "board mismatch 9");
        assert(imp.state.moveHistory.length === s.moveHistory.length, "history 9");
    });

    test("size 50 round-trip with extended coords", function () {
        var s = State.newGame({ size: 50, komi: 6.5 });
        var r;
        r = Rules.play(s, 0, 0); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 49, 49); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 26, 10); assert(r.ok, r.message); s = r.state; // A + k
        var text = Sgf.exportSgf(s);
        assert(text.indexOf("SZ[50]") >= 0, "SZ[50]");
        assert(text.indexOf("B[aa]") >= 0, "B[aa]");
        assert(text.indexOf("W[XX]") >= 0, "W[XX]");
        assert(text.indexOf("B[Ak]") >= 0, "B[Ak]");
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.size === 50, "size 50");
        assert(boardStr(imp.state) === boardStr(s), "board mismatch 50");
    });

    test("size 9 pass and capture round-trip", function () {
        var s = State.newGame({ size: 9 });
        s = Rules.play(s, 0, 1).state;
        s = Rules.play(s, 0, 0).state;
        s = Rules.play(s, 1, 0).state; // capture white
        assert(s.capturedWhite === 1, "precondition capture on 9");
        s = Rules.pass(s).state;
        var text = Sgf.exportSgf(s);
        assert(/W\[\]/.test(text) || /B\[\]/.test(text), "pass in export: " + text);
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.capturedWhite === 1, "capturedWhite after import 9");
        assert(imp.state.passCount === s.passCount, "passCount 9");
        assert(boardStr(imp.state) === boardStr(s), "board after pass+capture 9");
    });

    test("reject SZ[0] and SZ[51]", function () {
        var imp0 = Sgf.importSgf("(;FF[4]GM[1]SZ[0]KM[6.5])");
        assert(!imp0.ok, "SZ[0] should fail");

        var imp51 = Sgf.importSgf("(;FF[4]GM[1]SZ[51]KM[6.5])");
        assert(!imp51.ok, "SZ[51] should fail");
        assert(imp51.message && /51/.test(imp51.message), "message mentions 51: " + imp51.message);
    });

    test("accept empty SZ[1] and SZ[9] games", function () {
        var imp1 = Sgf.importSgf("(;FF[4]GM[1]SZ[1]KM[6.5])");
        assert(imp1.ok, imp1.message);
        assert(imp1.state.size === 1, "empty 1 board");
        var imp = Sgf.importSgf("(;FF[4]GM[1]SZ[9]KM[6.5])");
        assert(imp.ok, imp.message);
        assert(imp.state.size === 9, "empty 9 board");
    });

    test("size 3 demo export/import", function () {
        var s = State.newGame({ size: 3, komi: 6.5 });
        var r = Rules.play(s, 1, 1);
        assert(r.ok, r.message);
        s = r.state;
        var text = Sgf.exportSgf(s);
        assert(text.indexOf("SZ[3]") >= 0, "SZ[3] in export");
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.size === 3, "size 3");
    });

    // --- rectangular SZ[W:H] (22_3) ---
    test("rectangular 5×3 short game round-trip", function () {
        var s = State.newGame({ width: 5, height: 3, komi: 6.5 });
        var r;
        r = Rules.play(s, 0, 0); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 4, 2); assert(r.ok, r.message); s = r.state;
        r = Rules.play(s, 2, 1); assert(r.ok, r.message); s = r.state;
        var text = Sgf.exportSgf(s);
        assert(text.indexOf("SZ[5:3]") >= 0, "SZ[5:3] in export: " + text);
        assert(text.indexOf("SZ[5:5]") < 0, "not square compose");
        assert(!/SZ\[5\]/.test(text), "must not export square SZ[5] for 5×3");
        var imp = Sgf.importSgf(text);
        assert(imp.ok, imp.message);
        assert(imp.state.width === 5 && imp.state.height === 3, "dims 5×3");
        assert(imp.state.size == null, "non-square size null");
        assert(boardStr(imp.state) === boardStr(s), "board mismatch rect");
        assert(imp.state.moveHistory.length === s.moveHistory.length, "history length");
        assert(imp.state.toPlay === s.toPlay, "toPlay");
    });

    test("import SZ[5:3] empty and reject illegal compose", function () {
        var imp = Sgf.importSgf("(;FF[4]GM[1]SZ[5:3]KM[6.5])");
        assert(imp.ok, imp.message);
        assert(imp.state.width === 5 && imp.state.height === 3, "import dims");
        assert(imp.state.board.length === 3 && imp.state.board[0].length === 5, "board shape");

        var imp0 = Sgf.importSgf("(;FF[4]GM[1]SZ[0:9]KM[6.5])");
        assert(!imp0.ok, "SZ[0:9] should fail");
        assert(imp0.message && /0/.test(imp0.message), "message mentions 0: " + imp0.message);

        var imp51 = Sgf.importSgf("(;FF[4]GM[1]SZ[51:9]KM[6.5])");
        assert(!imp51.ok, "SZ[51:9] should fail");
        assert(imp51.message && /51/.test(imp51.message), "message mentions 51: " + imp51.message);

        var impBad = Sgf.importSgf("(;FF[4]GM[1]SZ[5:x]KM[6.5])");
        assert(!impBad.ok, "SZ[5:x] should fail");
    });

    test("rectangular point out of range on import", function () {
        // on 5×3, x=5 is out (letter f); y ok with a
        var imp = Sgf.importSgf("(;FF[4]GM[1]SZ[5:3];B[fa])");
        assert(!imp.ok, "B[fa] OOB on 5×3");
        assert(imp.message && /out of range|range/i.test(imp.message),
            "OOB message: " + imp.message);
        // y=3 is out (letter d) on height 3
        imp = Sgf.importSgf("(;FF[4]GM[1]SZ[5:3];B[ad])");
        assert(!imp.ok, "B[ad] OOB y on 5×3");
    });

    test("axis-split toSgfPoint/fromSgfPoint", function () {
        assert(Sgf.toSgfPoint(4, 2, 5, 3) === "ec", "4,2 on 5×3 → ec");
        assert(Sgf.toSgfPoint(5, 0, 5, 3) === null, "x=5 OOB");
        assert(Sgf.toSgfPoint(0, 3, 5, 3) === null, "y=3 OOB");
        var fp = Sgf.fromSgfPoint("ec", 5, 3);
        assert(!fp.pass && !fp.error && fp.x === 4 && fp.y === 2, "from ec");
        fp = Sgf.fromSgfPoint("ec", 3, 5);
        // x=4 >= width 3
        assert(fp.error, "ec OOB on 3×5");
    });

    test("illegal move in sgf fails import", function () {
        // Two black moves in a row without white — after B[aa] next B[bb] while white to play
        // Actually: B[aa];B[bb] — second B when white to play → color mismatch
        var imp = Sgf.importSgf("(;FF[4]GM[1]SZ[19];B[aa];B[bb])");
        assert(!imp.ok, "should fail on color mismatch");
    });

    function runAll() {
        if (!State || !Rules || !Sgf) {
            console.error("[go_sgf_cases] missing State/Rules/Sgf");
            return { passed: 0, failed: 1, results: [] };
        }
        // P1 spatial skip: 4×4×4 board is not FF[4] plane SGF.
        if (State.SIZE === 4) {
            console.log("[go_sgf_cases] skip (spatial 4×4×4; SGF deferred)");
            return { passed: 0, failed: 0, results: [], skipped: true };
        }
        var results = [];
        var passed = 0;
        var failed = 0;
        for (var i = 0; i < cases.length; i++) {
            var c = cases[i];
            try {
                c.fn();
                results.push({ name: c.name, ok: true });
                passed++;
                console.log("[go_sgf_cases] PASS:", c.name);
            } catch (e) {
                results.push({ name: c.name, ok: false, error: String(e && e.message ? e.message : e) });
                failed++;
                console.error("[go_sgf_cases] FAIL:", c.name, e);
            }
        }
        console.log("[go_sgf_cases] done: " + passed + " passed, " + failed + " failed, " + cases.length + " total");
        return { passed: passed, failed: failed, results: results };
    }

    GoGame.SgfTests = { cases: cases, runAll: runAll };
    runAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
