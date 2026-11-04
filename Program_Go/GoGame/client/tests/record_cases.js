/**
 * Go3D JSON record round-trip. Auto-runs on load.
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};
    var State = GoGame.State;
    var Rules = GoGame.Rules;
    var Rec = GoGame.Record;

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || "assertion failed");
    }

    function runAll() {
        if (!State || !Rules || !Rec) {
            console.error("[go_record_cases] missing deps");
            return { ok: false, passed: 0, failed: 1 };
        }
        var passed = 0, failed = 0;
        function t(name, fn) {
            try { fn(); passed++; console.log("[go_record_cases] PASS:", name); }
            catch (e) { failed++; console.error("[go_record_cases] FAIL:", name, e); }
        }

        t("R1 empty export/load", function () {
            var s = State.newGame();
            var ex = Rec.exportRecord(s);
            assert(ex.ok, ex.message);
            var ld = Rec.loadRecord(ex.text, s);
            assert(ld.ok, ld.message);
            assert(ld.state.moveHistory.length === 0, "empty hist");
            assert(State.getStone(ld.state, 0, 0, 0) === State.EMPTY, "empty board");
        });

        t("R2 play capture pass round-trip", function () {
            var s = State.newGame();
            s = Rules.play(s, 1, 0, 0).state;
            s = Rules.play(s, 0, 0, 0).state;
            s = Rules.play(s, 0, 1, 0).state;
            s = Rules.play(s, 3, 3, 3).state;
            var cap = Rules.play(s, 0, 0, 1);
            assert(cap.ok, cap.message);
            s = cap.state;
            assert(State.getStone(s, 0, 0, 0) === State.EMPTY, "white captured");
            s = Rules.pass(s).state;
            var ex = Rec.exportRecord(s);
            assert(ex.ok, ex.message);
            var obj = JSON.parse(ex.text);
            assert(obj.format === "Go3D" && obj.coords === "user", "header");
            var prev = State.newGame();
            var ld = Rec.loadRecord(ex.text, prev);
            assert(ld.ok, ld.message);
            assert(State.getStone(ld.state, 0, 0, 0) === State.EMPTY, "still captured");
            assert(ld.state.capturedWhite === s.capturedWhite, "cap W");
            assert(ld.state.moveHistory.length === s.moveHistory.length, "hist");
        });

        t("Rec N=5 load size", function () {
            var s = State.newGame({ size: 5 });
            s = Rules.play(s, 2, 2, 2).state;
            var ex = Rec.exportRecord(s);
            var exp = JSON.parse(ex.text).size;
            assert(Array.isArray(exp) && exp[0] === 5 && exp[1] === 5 && exp[2] === 5,
                "export size array");
            var prev = State.newGame({ size: 4 });
            var ld = Rec.loadRecord(ex.text, prev);
            assert(ld.ok, ld.message);
            assert(ld.state.size === 5, "loaded 5");
            assert(State.getStone(ld.state, 2, 2, 2) === State.BLACK, "center");
        });

        t("Rec4 old integer size", function () {
            var prev = State.newGame();
            var text = JSON.stringify({
                format: "Go3D", size: 4, coords: "user", komi: 6.5, moves: []
            });
            var ld = Rec.loadRecord(text, prev);
            assert(ld.ok, ld.message);
            assert(ld.state.sizeX === 4 && ld.state.sizeY === 4 && ld.state.sizeZ === 4, "cube 4");
            assert(ld.state.size === 4, "size alias");
        });

        t("Rec5 old integer size", function () {
            var prev = State.newGame({ size: 4 });
            var text = JSON.stringify({
                format: "Go3D", size: 5, coords: "user", komi: 6.5,
                moves: [{ t: "play", c: "B", p: [0, 0, 0] }]
            });
            var ld = Rec.loadRecord(text, prev);
            assert(ld.ok, ld.message);
            assert(ld.state.size === 5, "loaded 5");
            assert(State.getStone(ld.state, 2, 2, 2) === State.BLACK, "center");
        });

        t("RecArr size array cube", function () {
            var prev = State.newGame();
            var text = JSON.stringify({
                format: "Go3D", size: [4, 4, 4], coords: "user", komi: 6.5, moves: []
            });
            var ld = Rec.loadRecord(text, prev);
            assert(ld.ok, ld.message);
            assert(ld.state.size === 4, "equiv int 4");
            assert(ld.state.sizeX === 4 && ld.state.sizeY === 4 && ld.state.sizeZ === 4, "axes");
        });

        t("RecBad size array length 2", function () {
            var prev = State.newGame();
            var ld = Rec.loadRecord(JSON.stringify({
                format: "Go3D", size: [4, 5], coords: "user", komi: 6.5, moves: []
            }), prev);
            assert(!ld.ok, "len 2");
        });

        t("RecBad axis 10", function () {
            var prev = State.newGame();
            var ld = Rec.loadRecord(JSON.stringify({
                format: "Go3D", size: [4, 5, 10], coords: "user", komi: 6.5, moves: []
            }), prev);
            assert(!ld.ok, "axis 10");
        });

        t("Rec cuboid 4x5x5 export/load", function () {
            var s = State.newGame({ sizeX: 4, sizeY: 5, sizeZ: 5 });
            s = Rules.play(s, 0, 0, 0).state;
            var ex = Rec.exportRecord(s);
            assert(ex.ok, ex.message);
            var sz = JSON.parse(ex.text).size;
            assert(Array.isArray(sz) && sz[0] === 4 && sz[1] === 5 && sz[2] === 5, "size arr");
            var prev = State.newGame({ size: 4 });
            var ld = Rec.loadRecord(ex.text, prev);
            assert(ld.ok, ld.message);
            assert(ld.state.sizeX === 4 && ld.state.sizeY === 5 && ld.state.sizeZ === 5, "axes");
            assert(State.getStone(ld.state, 0, 0, 0) === State.BLACK, "corner");
        });

        t("Rec size 10 fails", function () {
            var prev = State.newGame();
            var bad = JSON.stringify({
                format: "Go3D", size: 10, coords: "user", komi: 6.5, moves: []
            });
            var ld = Rec.loadRecord(bad, prev);
            assert(!ld.ok, "size 10");
        });

        t("RecOld missing komi and movesPerTurn", function () {
            var prev = State.newGame();
            State.setStone(prev, 0, 0, 0, State.BLACK);
            var text = JSON.stringify({
                format: "Go3D", size: 4, coords: "user", moves: []
            });
            var ld = Rec.loadRecord(text, prev);
            assert(ld.ok, ld.message);
            assert(ld.state.komi === 6.5, "default komi");
            assert(ld.state.movesPerTurn === 1, "default mpt");
            assert(State.getStone(prev, 0, 0, 0) === State.BLACK, "prev");
        });

        t("RecM2 movesPerTurn 2 two black", function () {
            var s = State.newGame({ movesPerTurn: 2 });
            s = Rules.play(s, 0, 0, 0).state;
            s = Rules.play(s, 1, 0, 0).state;
            var ex = Rec.exportRecord(s);
            assert(ex.ok, ex.message);
            var obj = JSON.parse(ex.text);
            assert(obj.movesPerTurn === 2, "export mpt");
            var ld = Rec.loadRecord(ex.text, State.newGame());
            assert(ld.ok, ld.message);
            assert(ld.state.movesPerTurn === 2, "loaded mpt");
            assert(ld.state.toPlay === State.WHITE, "white after two black");
            assert(State.getStone(ld.state, 0, 0, 0) === State.BLACK, "b0");
            assert(State.getStone(ld.state, 1, 0, 0) === State.BLACK, "b1");
        });

        t("RecM2 bad movesPerTurn 7", function () {
            var prev = State.newGame();
            State.setStone(prev, 2, 2, 2, State.BLACK);
            var ld = Rec.loadRecord(JSON.stringify({
                format: "Go3D", size: 4, coords: "user", komi: 6.5,
                movesPerTurn: 7, moves: []
            }), prev);
            assert(!ld.ok, "mpt 7");
            assert(State.getStone(prev, 2, 2, 2) === State.BLACK, "prev");
        });

        t("RecM2 bad komi 6", function () {
            var prev = State.newGame();
            State.setStone(prev, 2, 2, 2, State.BLACK);
            var ld = Rec.loadRecord(JSON.stringify({
                format: "Go3D", size: 4, coords: "user", komi: 6, moves: []
            }), prev);
            assert(!ld.ok, "komi 6");
            assert(State.getStone(prev, 2, 2, 2) === State.BLACK, "prev");
        });

        t("R3 illegal display aborts", function () {
            var prev = State.newGame();
            State.setStone(prev, 2, 2, 2, State.BLACK);
            var bad = JSON.stringify({
                format: "Go3D", size: 4, coords: "user", komi: 6.5,
                moves: [{ t: "play", c: "B", p: [0, 0, 0] }]
            });
            var ld = Rec.loadRecord(bad, prev);
            assert(!ld.ok, "must fail");
            assert(State.getStone(prev, 2, 2, 2) === State.BLACK, "prev unchanged");
        });

        var summary = { ok: failed === 0, passed: passed, failed: failed };
        console.log("[go_record_cases] done", summary);
        return summary;
    }

    GoGame.RecordTests = { runAll: runAll };
    runAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
