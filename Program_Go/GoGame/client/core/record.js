/**
 * GoGame.Record — Go3D JSON export/import (not SGF/FF[4]).
 * coords:"user" = 2*index-(N-1) (step 2). Replay uses Rules.play/pass/resign only.
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};

    function St() { return GoGame.State; }
    function Ru() { return GoGame.Rules; }
    function Co() { return GoGame.Coords; }

    function colorLetter(c) {
        return c === St().BLACK ? "B" : "W";
    }
    function letterColor(ch) {
        return ch === "B" ? St().BLACK : St().WHITE;
    }

    function snapshotScore(r) {
        if (!r) return null;
        return {
            black: r.black,
            white: r.white,
            winner: r.winner,
            territory: {
                black: r.territory && r.territory.black,
                white: r.territory && r.territory.white,
                dame: r.territory && r.territory.dame
            },
            komi: r.komi
        };
    }

    function exportRecord(state) {
        var C = Co();
        var S = St();
        var moves = [];
        var h = (state && state.moveHistory) || [];
        var i, rec, u;
        for (i = 0; i < h.length; i++) {
            rec = h[i];
            if (rec.type === "play") {
                u = C.toUser(rec.x, rec.y, rec.z, state);
                if (!u) {
                    return { ok: false, text: "", message: "Export failed: internal point not displayable" };
                }
                moves.push({ t: "play", c: colorLetter(rec.color), p: [u.x, u.y, u.z] });
            } else if (rec.type === "pass") {
                moves.push({ t: "pass", c: colorLetter(rec.color) });
            } else if (rec.type === "resign") {
                moves.push({ t: "resign", c: colorLetter(rec.color) });
            }
        }
        var dead = [];
        var d = (state && state.deadStones) || [];
        for (i = 0; i < d.length; i++) {
            u = C.toUser(d[i].x, d[i].y, d[i].z, state);
            if (!u) {
                return { ok: false, text: "", message: "Export failed: dead stone not displayable" };
            }
            dead.push([u.x, u.y, u.z]);
        }
        var obj = {
            format: "Go3D",
            size: [state.sizeX || state.size, state.sizeY || state.size, state.sizeZ || state.size],
            komi: state.komi != null ? state.komi : S.DEFAULT_KOMI,
            movesPerTurn: state.movesPerTurn != null ? state.movesPerTurn : (S.DEFAULT_MOVES_PER_TURN || 1),
            coords: "user",
            moves: moves,
            deadStones: dead,
            scoreResult: snapshotScore(state.scoreResult)
        };
        return { ok: true, text: JSON.stringify(obj, null, 2), record: obj };
    }

    function loadRecord(text, prevState) {
        var C = Co();
        var S = St();
        var R = Ru();
        var data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return { ok: false, state: prevState, message: "Load failed: invalid JSON" };
        }
        if (!data || data.format !== "Go3D") {
            return { ok: false, state: prevState, message: "Load failed: format must be Go3D" };
        }
        function parseSizeField(sz) {
            var lo = S.MIN_SIZE || 1, hi = S.MAX_SIZE || 9;
            function okn(v) {
                return typeof v === "number" && v === (v | 0) && v >= lo && v <= hi;
            }
            if (typeof sz === "number" && okn(sz)) return [sz, sz, sz];
            if (Array.isArray(sz) && sz.length === 3 && okn(sz[0]) && okn(sz[1]) && okn(sz[2])) {
                return [sz[0], sz[1], sz[2]];
            }
            return null;
        }
        var dim = parseSizeField(data.size);
        if (!dim) {
            return { ok: false, state: prevState, message: "Load failed: size must be 1..9 or [sx,sy,sz]" };
        }
        if (data.coords !== "user") {
            return { ok: false, state: prevState, message: "Load failed: coords must be user" };
        }
        var komi;
        if (data.komi == null) {
            komi = S.DEFAULT_KOMI;
        } else if (S.isAllowedKomi && S.isAllowedKomi(data.komi)) {
            komi = data.komi;
        } else {
            return { ok: false, state: prevState, message: "Load failed: komi must be 0.5, 1.5, …, 19.5" };
        }
        var mpt;
        if (data.movesPerTurn == null) {
            mpt = S.DEFAULT_MOVES_PER_TURN || 1;
        } else if (S.isAllowedMovesPerTurn && S.isAllowedMovesPerTurn(data.movesPerTurn)) {
            mpt = data.movesPerTurn;
        } else {
            return { ok: false, state: prevState, message: "Load failed: movesPerTurn must be 1..6" };
        }
        var s = S.newGame({
            sizeX: dim[0],
            sizeY: dim[1],
            sizeZ: dim[2],
            komi: komi,
            movesPerTurn: mpt
        });
        var moves = data.moves || [];
        var i, mv, pt, res, expect;
        for (i = 0; i < moves.length; i++) {
            mv = moves[i];
            if (!mv || !mv.t || !mv.c) {
                return { ok: false, state: prevState, message: "Load failed: bad move " + i };
            }
            expect = s.toPlay;
            if (letterColor(mv.c) !== expect && mv.t !== "resign") {
                return { ok: false, state: prevState, message: "Load failed: color mismatch at move " + i };
            }
            if (mv.t === "play") {
                if (!mv.p || mv.p.length !== 3) {
                    return { ok: false, state: prevState, message: "Load failed: play needs p:[x,y,z]" };
                }
                pt = C.fromUser(mv.p[0], mv.p[1], mv.p[2], s);
                if (!pt) {
                    return { ok: false, state: prevState, message: "Load failed: illegal display point at move " + i };
                }
                res = R.play(s, pt.ix, pt.iy, pt.iz);
                if (!res.ok) {
                    return { ok: false, state: prevState, message: "Load failed: " + (res.message || "illegal play") + " at move " + i };
                }
                s = res.state;
            } else if (mv.t === "pass") {
                res = R.pass(s);
                s = res.state;
            } else if (mv.t === "resign") {
                res = R.resign(s);
                s = res.state;
            } else {
                return { ok: false, state: prevState, message: "Load failed: unknown t at move " + i };
            }
        }
        var warning = null;
        if (data.deadStones && data.deadStones.length) {
            if (s.phase !== "ended") {
                warning = "Load warning: deadStones ignored (not ended)";
            } else {
                var dead = [];
                for (i = 0; i < data.deadStones.length; i++) {
                    pt = C.fromUser(data.deadStones[i][0], data.deadStones[i][1], data.deadStones[i][2], s);
                    if (!pt) {
                        return { ok: false, state: prevState, message: "Load failed: illegal dead point" };
                    }
                    dead.push({ x: pt.ix, y: pt.iy, z: pt.iz });
                }
                s.deadStones = dead;
                if (GoGame.Scoring) {
                    s.scoreResult = GoGame.Scoring.score(s, { includePoints: true });
                }
            }
        } else if (s.phase === "ended" && GoGame.Scoring && data.scoreResult) {
            s.scoreResult = GoGame.Scoring.score(s, { includePoints: true });
        }
        if (data.scoreResult && s.scoreResult) {
            if (data.scoreResult.black !== s.scoreResult.black ||
                data.scoreResult.white !== s.scoreResult.white) {
                warning = (warning ? warning + "; " : "") +
                    "Load warning: score snapshot mismatch (board loaded, score recomputed)";
            }
        }
        return { ok: true, state: s, warning: warning, message: warning || "Loaded Go3D record" };
    }

    GoGame.Record = {
        exportRecord: exportRecord,
        loadRecord: loadRecord
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_record] GoGame.Record ready (Go3D JSON, user coords)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
