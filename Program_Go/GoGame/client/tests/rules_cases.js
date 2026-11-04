/**
 * Spatial rules cases (cube and cuboid). Auto-runs on load. Internal index.
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};
    var State = GoGame.State;
    var Rules = GoGame.Rules;

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || "assertion failed");
    }

    function setup(blackPts, whitePts, toPlay) {
        var s = State.newGame();
        var i;
        blackPts = blackPts || [];
        whitePts = whitePts || [];
        for (i = 0; i < blackPts.length; i++) {
            State.setStone(s, blackPts[i][0], blackPts[i][1], blackPts[i][2], State.BLACK);
        }
        for (i = 0; i < whitePts.length; i++) {
            State.setStone(s, whitePts[i][0], whitePts[i][1], whitePts[i][2], State.WHITE);
        }
        if (toPlay != null) s.toPlay = toPlay;
        return s;
    }

    function libertyCount(s, x, y, z) {
        return Rules.getLiberties(s, Rules.getGroup(s, x, y, z)).count;
    }

    var cases = [];
    function test(name, fn) {
        cases.push({ name: name, fn: fn });
    }

    test("newGame is 4×4×4 empty black to play", function () {
        var s = State.newGame();
        assert(State.DEFAULT_SIZE === 4 || State.SIZE === 4, "default 4");
        assert(s.size === 4, "state.size");
        assert(s.sizeX === 4 && s.sizeY === 4 && s.sizeZ === 4, "axes 4");
        assert(s.board.length === 4 && s.board[0].length === 4 && s.board[0][0].length === 4, "dims");
        assert(s.toPlay === State.BLACK, "black first");
        assert(s.komi === 6.5, "komi 6.5");
        assert(s.movesPerTurn === 1, "mpt 1");
        assert(s.playsThisTurn === 0, "plays 0");
        assert(s.phase === "playing", "playing");
        assert(State.getStone(s, 0, 0, 0) === State.EMPTY, "empty origin");
        assert(State.inBounds(s, 3, 3, 3), "corner in");
        assert(!State.inBounds(s, 4, 0, 0), "x=4 oob");
        assert(!State.inBounds(s, 0, 0, -1), "z=-1 oob");
    });

    test("play empty point", function () {
        var s = State.newGame();
        var r = Rules.play(s, 1, 2, 3);
        assert(r.ok, r.message);
        s = r.state;
        assert(State.getStone(s, 1, 2, 3) === State.BLACK, "black at 1,2,3");
        assert(s.toPlay === State.WHITE, "white to play");
        assert(s.moveHistory.length === 1, "history");
        assert(s.moveHistory[0].z === 3, "history z");
    });

    test("occupied rejected", function () {
        var s = State.newGame();
        var r = Rules.play(s, 0, 0, 0);
        assert(r.ok, r.message);
        s = r.state;
        r = Rules.play(s, 0, 0, 0);
        assert(!r.ok, "must reject occupied");
        assert(String(r.message).indexOf("occupied") >= 0, "message occupied");
        assert(State.getStone(r.state, 0, 0, 0) === State.BLACK, "stone stays");
        assert(r.state.toPlay === State.WHITE, "turn unchanged on fail clone");
    });

    test("out of bounds rejected", function () {
        var s = State.newGame();
        var r = Rules.play(s, 0, 0, 4);
        assert(!r.ok, "oob");
        assert(String(r.message).indexOf("bounds") >= 0, "bounds msg");
        assert(!Rules.isLegal(s, -1, 0, 0), "isLegal oob");
    });

    test("turns alternate", function () {
        var s = State.newGame();
        var r = Rules.play(s, 0, 0, 0);
        s = r.state;
        r = Rules.play(s, 1, 0, 0);
        assert(r.ok, r.message);
        s = r.state;
        assert(State.getStone(s, 1, 0, 0) === State.WHITE, "white stone");
        assert(s.toPlay === State.BLACK, "black again");
    });

    test("undo restores stone and toPlay", function () {
        var s = State.newGame();
        var r = Rules.play(s, 2, 2, 2);
        s = r.state;
        r = Rules.play(s, 0, 1, 0);
        s = r.state;
        s = State.undo(s);
        assert(State.getStone(s, 0, 1, 0) === State.EMPTY, "white undone");
        assert(State.getStone(s, 2, 2, 2) === State.BLACK, "black remains");
        assert(s.toPlay === State.WHITE, "white to play after undo");
        s = State.undo(s);
        assert(State.getStone(s, 2, 2, 2) === State.EMPTY, "black undone");
        assert(s.toPlay === State.BLACK, "black to play");
        assert(s.moveHistory.length === 0, "empty history");
    });

    test("six-neighbour group, diagonal not connected", function () {
        var s = State.newGame();
        State.setStone(s, 1, 1, 1, State.BLACK);
        State.setStone(s, 2, 1, 1, State.BLACK);
        State.setStone(s, 1, 1, 2, State.BLACK);
        var g = Rules.getGroup(s, 1, 1, 1);
        assert(g.length === 3, "three connected by face, not diagonal");
        State.setStone(s, 2, 2, 2, State.BLACK);
        g = Rules.getGroup(s, 1, 1, 1);
        assert(g.length === 3, "diagonal 2,2,2 not in group");
    });

    test("L liberty counts corner/edge/face/interior", function () {
        var s = State.newGame();
        State.setStone(s, 0, 0, 0, State.BLACK);
        assert(libertyCount(s, 0, 0, 0) === 3, "corner 3");
        s = State.newGame();
        State.setStone(s, 1, 0, 0, State.BLACK);
        assert(libertyCount(s, 1, 0, 0) === 4, "edge 4");
        s = State.newGame();
        State.setStone(s, 1, 1, 0, State.BLACK);
        assert(libertyCount(s, 1, 1, 0) === 5, "face 5");
        s = State.newGame();
        State.setStone(s, 1, 1, 1, State.BLACK);
        assert(libertyCount(s, 1, 1, 1) === 6, "interior 6");
    });

    test("C1 capture one interior stone", function () {
        var s = setup(
            [
                [0, 1, 1],
                [2, 1, 1],
                [1, 0, 1],
                [1, 2, 1],
                [1, 1, 0]
            ],
            [[1, 1, 1]],
            State.BLACK
        );
        assert(libertyCount(s, 1, 1, 1) === 1, "white in atari");
        var r = Rules.play(s, 1, 1, 2);
        assert(r.ok, r.message);
        assert(r.message === "capture", "capture message");
        s = r.state;
        assert(State.getStone(s, 1, 1, 1) === State.EMPTY, "white gone");
        assert(s.capturedWhite === 1, "capturedWhite");
        assert(r.captured.length === 1, "one captured");
    });

    test("C2 capture two groups with one play", function () {
        var s = setup(
            [
                [1, 0, 0],
                [0, 1, 0],
                [1, 0, 2],
                [0, 1, 2],
                [0, 0, 3]
            ],
            [
                [0, 0, 0],
                [0, 0, 2]
            ],
            State.BLACK
        );
        assert(libertyCount(s, 0, 0, 0) === 1, "corner atari");
        assert(libertyCount(s, 0, 0, 2) === 1, "other atari");
        var r = Rules.play(s, 0, 0, 1);
        assert(r.ok, r.message);
        s = r.state;
        assert(State.getStone(s, 0, 0, 0) === State.EMPTY, "first white gone");
        assert(State.getStone(s, 0, 0, 2) === State.EMPTY, "second white gone");
        assert(r.captured.length === 2, "two captured");
        assert(s.capturedWhite === 2, "capturedWhite 2");
    });

    test("S suicide rejected at corner", function () {
        var s = setup(
            [],
            [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ],
            State.BLACK
        );
        assert(!Rules.isLegal(s, 0, 0, 0), "isLegal false");
        var r = Rules.play(s, 0, 0, 0);
        assert(!r.ok, "play fail");
        assert(String(r.message).indexOf("suicide") >= 0, "suicide message");
        assert(State.getStone(r.state, 0, 0, 0) === State.EMPTY, "corner empty");
        assert(r.state.toPlay === State.BLACK, "turn unchanged");
    });

    test("S2 capture instead of suicide", function () {
        var s = setup(
            [
                [2, 0, 0],
                [1, 1, 0],
                [1, 0, 1]
            ],
            [[1, 0, 0]],
            State.BLACK
        );
        assert(libertyCount(s, 1, 0, 0) === 1, "white last lib 0,0,0");
        var r = Rules.play(s, 0, 0, 0);
        assert(r.ok, r.message);
        s = r.state;
        assert(State.getStone(s, 1, 0, 0) === State.EMPTY, "white captured");
        assert(State.getStone(s, 0, 0, 0) === State.BLACK, "black placed");
    });

    function koSetup() {
        return setup(
            [
                [0, 1, 0],
                [2, 1, 0],
                [1, 0, 0],
                [1, 1, 1]
            ],
            [
                [1, 1, 0],
                [0, 2, 0],
                [2, 2, 0],
                [1, 3, 0],
                [1, 2, 1]
            ],
            State.BLACK
        );
    }

    test("K1 simple ko recapture rejected", function () {
        var s = koSetup();
        var r = Rules.play(s, 1, 2, 0);
        assert(r.ok, "black takes: " + r.message);
        s = r.state;
        assert(State.getStone(s, 1, 1, 0) === State.EMPTY, "white taken");
        assert(s.koPoint && s.koPoint.x === 1 && s.koPoint.y === 1 && s.koPoint.z === 0, "koPoint");
        assert(!Rules.isLegal(s, 1, 1, 0), "isLegal ko false");
        r = Rules.play(s, 1, 1, 0);
        assert(!r.ok, "recapture rejected");
        assert(String(r.message).indexOf("ko") >= 0, "ko message");
    });

    test("K2 ko recapture allowed after tenuki", function () {
        var s = koSetup();
        var r = Rules.play(s, 1, 2, 0);
        s = r.state;
        r = Rules.play(s, 3, 3, 3);
        assert(r.ok, "white tenuki");
        s = r.state;
        assert(s.koPoint === null, "ko cleared");
        r = Rules.pass(s);
        s = r.state;
        r = Rules.play(s, 1, 1, 0);
        assert(r.ok, "white recapture after wait: " + r.message);
        s = r.state;
        assert(State.getStone(s, 1, 1, 0) === State.WHITE, "white back");
        assert(State.getStone(s, 1, 2, 0) === State.EMPTY, "black taken");
    });

    test("P2p two passes end without scoring", function () {
        var s = State.newGame();
        var r = Rules.pass(s);
        s = r.state;
        assert(s.phase === "playing", "one pass still playing");
        r = Rules.pass(s);
        s = r.state;
        assert(s.phase === "ended", "ended");
        assert(r.ended, "ended flag");
        assert(s.scoreResult == null, "no scoreResult");
        r = Rules.play(s, 0, 0, 0);
        assert(!r.ok, "no play after ended");
        assert(String(r.message).indexOf("playing") >= 0, "not playing");
    });

    test("U undo restores captured stone", function () {
        var s = setup(
            [
                [0, 1, 1],
                [2, 1, 1],
                [1, 0, 1],
                [1, 2, 1],
                [1, 1, 0]
            ],
            [[1, 1, 1]],
            State.BLACK
        );
        var r = Rules.play(s, 1, 1, 2);
        s = r.state;
        s = State.undo(s);
        assert(State.getStone(s, 1, 1, 1) === State.WHITE, "white restored");
        assert(State.getStone(s, 1, 1, 2) === State.EMPTY, "play undone");
        assert(s.capturedWhite === 0, "count restored");
        assert(s.toPlay === State.BLACK, "black to play");
    });

    test("Z1 1x1x1 suicide", function () {
        var s = State.newGame({ size: 1 });
        assert(s.size === 1, "size 1");
        assert(!Rules.isLegal(s, 0, 0, 0), "illegal");
        var r = Rules.play(s, 0, 0, 0);
        assert(!r.ok, "play fail");
        assert(String(r.message).indexOf("suicide") >= 0, r.message);
    });

    test("Z5 N=5 center playable", function () {
        var s = State.newGame({ size: 5 });
        assert(s.size === 5, "size 5");
        assert(s.sizeX === 5 && s.sizeY === 5 && s.sizeZ === 5, "axes 5");
        var r = Rules.play(s, 2, 2, 2);
        assert(r.ok, r.message);
        assert(State.getStone(r.state, 2, 2, 2) === State.BLACK, "center stone");
    });

    test("IntC cuboid 4x5x5 newGame", function () {
        var s = State.newGame({ sizeX: 4, sizeY: 5, sizeZ: 5 });
        assert(s.sizeX === 4 && s.sizeY === 5 && s.sizeZ === 5, "axes");
        assert(s.size == null, "size alias null when unequal");
        assert(s.board.length === 5 && s.board[0].length === 5 &&
            s.board[0][0].length === 4, "board[z][y][x]");
        assert(State.inBounds(s, 3, 4, 4), "far corner in");
        assert(!State.inBounds(s, 4, 0, 0), "x=4 oob");
        assert(!State.inBounds(s, 0, 5, 0), "y=5 oob");
        var C = GoGame.Coords;
        if (C) {
            assert(C.fromUser(0, 0, 0, s) === null, "X even: no (0,0,0)");
        }
        var r = Rules.play(s, 0, 0, 0);
        assert(r.ok, "corner play " + r.message);
        assert(State.getStone(r.state, 0, 0, 0) === State.BLACK, "corner stone");
    });

    test("M2 two stones then white", function () {
        var s = State.newGame({ movesPerTurn: 2 });
        var r = Rules.play(s, 0, 0, 0);
        assert(r.ok, r.message);
        s = r.state;
        assert(s.toPlay === State.BLACK, "still black");
        assert(s.playsThisTurn === 1, "played 1");
        r = Rules.play(s, 1, 0, 0);
        assert(r.ok, r.message);
        s = r.state;
        assert(s.toPlay === State.WHITE, "white after two");
        assert(s.playsThisTurn === 0, "turn reset");
        assert(State.getStone(s, 0, 0, 0) === State.BLACK, "first");
        assert(State.getStone(s, 1, 0, 0) === State.BLACK, "second");
    });

    test("P1 pass ends turn with movesPerTurn 2", function () {
        var s = State.newGame({ movesPerTurn: 2 });
        s = Rules.play(s, 0, 0, 0).state;
        var r = Rules.pass(s);
        s = r.state;
        assert(s.toPlay === State.WHITE, "white after pass");
        assert(s.passCount === 1, "passCount 1");
        assert(s.phase === "playing", "still playing");
        assert(s.playsThisTurn === 0, "plays reset");
    });

    test("P2 two passes end with movesPerTurn 2", function () {
        var s = State.newGame({ movesPerTurn: 2 });
        s = Rules.pass(s).state;
        var r = Rules.pass(s);
        s = r.state;
        assert(s.phase === "ended", "ended");
        assert(r.ended, "ended flag");
    });

    test("Ill illegal does not consume remaining", function () {
        var s = State.newGame({ size: 1, movesPerTurn: 2 });
        var r = Rules.play(s, 0, 0, 0);
        assert(!r.ok, "suicide");
        assert(r.state.playsThisTurn === 0, "not consumed");
        assert(r.state.toPlay === State.BLACK, "still black");
        s = State.newGame({ movesPerTurn: 2 });
        s = Rules.play(s, 0, 0, 0).state;
        r = Rules.play(s, 0, 0, 0);
        assert(!r.ok, "occupied");
        assert(s.playsThisTurn === 1, "original stays 1");
        assert(r.state.playsThisTurn === 1, "fail clone stays 1");
        assert(r.state.toPlay === State.BLACK, "still black");
    });

    test("U1 undo one stone in double move", function () {
        var s = State.newGame({ movesPerTurn: 2 });
        s = Rules.play(s, 0, 0, 0).state;
        s = Rules.play(s, 1, 0, 0).state;
        assert(s.toPlay === State.WHITE, "white after two");
        s = State.undo(s);
        assert(State.getStone(s, 1, 0, 0) === State.EMPTY, "second gone");
        assert(State.getStone(s, 0, 0, 0) === State.BLACK, "first remains");
        assert(s.toPlay === State.BLACK, "black to play");
        assert(s.playsThisTurn === 1, "plays 1");
    });

    test("U3 3x5x9 center playable", function () {
        var s = State.newGame({ sizeX: 3, sizeY: 5, sizeZ: 9 });
        var C = GoGame.Coords;
        var pt = C.fromUser(0, 0, 0, s);
        assert(pt && pt.ix === 1 && pt.iy === 2 && pt.iz === 4, JSON.stringify(pt));
        var r = Rules.play(s, pt.ix, pt.iy, pt.iz);
        assert(r.ok, r.message);
        assert(State.getStone(r.state, 1, 2, 4) === State.BLACK, "center stone");
    });

    function runAll() {

        if (!State || !Rules) {
            console.error("[go_rules_cases] missing deps");
            return { ok: false, passed: 0, failed: 1 };
        }
        var passed = 0;
        var failed = 0;
        var errors = [];
        var i;
        for (i = 0; i < cases.length; i++) {
            try {
                cases[i].fn();
                passed++;
                console.log("[go_rules_cases] PASS:", cases[i].name);
            } catch (e) {
                failed++;
                errors.push({ name: cases[i].name, error: String(e && e.message ? e.message : e) });
                console.error("[go_rules_cases] FAIL:", cases[i].name, e);
            }
        }
        var summary = { ok: failed === 0, passed: passed, failed: failed, errors: errors };
        console.log("[go_rules_cases] done", summary);
        return summary;
    }

    GoGame.RulesTests = { cases: cases, runAll: runAll };
    runAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
