/**
 * P4b territory+captures cases — 4×4×4 internal index. Auto-runs on load.
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};
    var State = GoGame.State;
    var Rules = GoGame.Rules;
    var Scoring = GoGame.Scoring;

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || "assertion failed");
    }

    function setup(blackPts, whitePts) {
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
        return s;
    }

    function accountN(r, nExpect) {
        nExpect = nExpect != null ? nExpect : 64;
        var n = r.stones.black + r.stones.white + r.territory.black +
            r.territory.white + r.territory.dame;
        assert(n === nExpect, "cells " + n + " expect " + nExpect + " " + r.reason);
        assert(r.cells === nExpect, "cells field");
    }

    function runAll() {
        if (!State || !Scoring) {
            console.error("[go_scoring_cases] missing deps");
            return { ok: false, passed: 0, failed: 1 };
        }
        var passed = 0, failed = 0;

        function t(name, fn) {
            try {
                fn();
                passed++;
                console.log("[go_scoring_cases] PASS:", name);
            } catch (e) {
                failed++;
                console.error("[go_scoring_cases] FAIL:", name, e);
            }
        }

        t("E empty board white 6.5", function () {
            var r = Scoring.score(State.newGame());
            assert(r.territory.dame === 64, "dame");
            assert(r.black === 0, "black");
            assert(r.white === 6.5, "white");
            assert(r.winner === "white", "winner");
            accountN(r);
        });

        t("Sc05 empty board komi 0.5", function () {
            var r = Scoring.score(State.newGame({ komi: 0.5 }));
            assert(r.white === 0.5, "white 0.5");
            assert(r.komi === 0.5, "komi field");
            assert(r.black === 0, "black");
            assert(r.winner === "white", "winner");
            accountN(r);
        });

        t("S two corner stones", function () {
            var s = setup([[0, 0, 0]], [[3, 3, 3]]);
            var r = Scoring.score(s);
            assert(r.stones.black === 1 && r.stones.white === 1, "stones");
            assert(r.black === 0, "no live stones in score");
            assert(r.white === 6.5, "white komi only");
            assert(r.winner === "white", "winner");
            accountN(r);
        });

        t("C corner territory", function () {
            var s = setup([[1, 0, 0], [0, 1, 0], [0, 0, 1]], []);
            var r = Scoring.score(s);
            assert(r.territory.black >= 1, "at least corner");
            assert(r.black === r.territory.black, "score is territory only");
            accountN(r);
        });

        t("D dame at interior", function () {
            var s = setup(
                [[0, 1, 1], [1, 0, 1], [1, 1, 0]],
                [[2, 1, 1], [1, 2, 1], [1, 1, 2]]
            );
            var terr = Scoring.computeTerritory(s);
            assert(terr.dame >= 1, "dame >= 1");
            accountN(Scoring.score(s));
        });

        t("H hollow black territory", function () {
            var s = setup(
                [[0, 1, 1], [2, 1, 1], [1, 0, 1], [1, 2, 1], [1, 1, 0], [1, 1, 2]],
                []
            );
            var r = Scoring.score(s);
            assert(r.territory.black >= 1, "hole is black");
            assert(r.black === r.territory.black, "score is territory only");
            accountN(r);
        });

        t("T account 64", function () {
            var s = setup([[0, 0, 0], [1, 1, 1]], [[3, 3, 3], [2, 2, 2]]);
            accountN(Scoring.score(s));
        });

        t("T1 includePoints lengths match counts", function () {
            var s = setup([[1, 0, 0], [0, 1, 0], [0, 0, 1]], []);
            var r = Scoring.score(s, { includePoints: true });
            var pts = r.territory.points;
            assert(pts && pts.black.length === r.territory.black, "black pts");
            assert(pts.white.length === r.territory.white, "white pts");
            assert(pts.dame.length === r.territory.dame, "dame pts");
            accountN(r);
        });

        t("M mark dead changes score", function () {
            var s = setup(
                [[0, 0, 0], [1, 0, 0]],
                [[3, 3, 3]]
            );
            var before = Scoring.score(s);
            s.deadStones = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }];
            var after = Scoring.score(s);
            assert(after.stones.black === 0, "no live black");
            assert(after.dead.white === 0 && after.dead.black === 2, "two dead black");
            assert(after.white === before.white + 2 || after.territory.white + after.territory.dame >= before.territory.white, "white prisoners or terr");
            assert(after.white > before.white, "white score up from dead black");
            accountN(after);
        });

        t("M2 undo pass clears marks and score", function () {
            var s = State.newGame();
            s = Rules.pass(s).state;
            s = Rules.pass(s).state;
            assert(s.phase === "ended", "ended");
            s.deadStones = [{ x: 0, y: 0, z: 0 }];
            s.scoreResult = { black: 0, white: 6.5 };
            s = State.undo(s);
            assert(s.phase === "playing", "playing");
            assert(!s.deadStones || s.deadStones.length === 0, "no dead");
            assert(!s.scoreResult, "no score");
        });

        t("Acc N=5 cells 125", function () {
            var s = State.newGame({ size: 5 });
            accountN(Scoring.score(s), 125);
        });

        t("Acc cuboid 4x5x5 cells 100", function () {
            var s = State.newGame({ sizeX: 4, sizeY: 5, sizeZ: 5 });
            accountN(Scoring.score(s), 100);
        });

        t("R resign does not require area score", function () {
            var s = State.newGame();
            var r = Rules.resign(s);
            assert(r.state.phase === "finished", "finished");
            assert(r.winner === State.WHITE, "white wins");
        });

        var summary = { ok: failed === 0, passed: passed, failed: failed };
        console.log("[go_scoring_cases] done", summary);
        return summary;
    }

    GoGame.ScoringTests = { runAll: runAll };
    runAll();
})(typeof globalThis !== "undefined" ? globalThis : this);
