/**
 * GoGame.Rules — P2 spatial: six-neighbour capture, suicide, simple ko.
 * Mutates only clones; callers use returned state.
 * Coordinates are internal index. Display conversion is GoGame.Coords.
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};
    var State = null;

    function S() {
        if (!State) State = GoGame.State;
        if (!State) throw new Error("GoGame.Rules requires GoGame.State");
        return State;
    }

    var DIRS = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1]
    ];

    function pointKey(x, y, z) {
        return x + "," + y + "," + z;
    }

    function copyPt(p) {
        return p ? { x: p.x, y: p.y, z: p.z } : null;
    }

    function samePoint(a, b) {
        return !!(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
    }

    function getGroup(state, x, y, z) {
        var St = S();
        if (!St.inBounds(state, x, y, z)) return [];
        var color = St.getStone(state, x, y, z);
        if (color === St.EMPTY) return [];

        var group = [];
        var seen = {};
        var stack = [{ x: x, y: y, z: z }];
        seen[pointKey(x, y, z)] = true;

        while (stack.length) {
            var p = stack.pop();
            group.push({ x: p.x, y: p.y, z: p.z });
            var i, nx, ny, nz, k;
            for (i = 0; i < DIRS.length; i++) {
                nx = p.x + DIRS[i][0];
                ny = p.y + DIRS[i][1];
                nz = p.z + DIRS[i][2];
                if (!St.inBounds(state, nx, ny, nz)) continue;
                k = pointKey(nx, ny, nz);
                if (seen[k]) continue;
                if (St.getStone(state, nx, ny, nz) !== color) continue;
                seen[k] = true;
                stack.push({ x: nx, y: ny, z: nz });
            }
        }
        return group;
    }

    function getLiberties(state, group) {
        var St = S();
        var seen = {};
        var points = [];
        if (!group || !group.length) {
            return { count: 0, points: points };
        }
        var g, i, p, nx, ny, nz, k;
        for (g = 0; g < group.length; g++) {
            p = group[g];
            for (i = 0; i < DIRS.length; i++) {
                nx = p.x + DIRS[i][0];
                ny = p.y + DIRS[i][1];
                nz = p.z + DIRS[i][2];
                if (!St.inBounds(state, nx, ny, nz)) continue;
                if (St.getStone(state, nx, ny, nz) !== St.EMPTY) continue;
                k = pointKey(nx, ny, nz);
                if (seen[k]) continue;
                seen[k] = true;
                points.push({ x: nx, y: ny, z: nz });
            }
        }
        return { count: points.length, points: points };
    }

    function captureDeadNeighbors(state, x, y, z, opp) {
        var St = S();
        var captured = [];
        var seenGroup = {};
        var i, nx, ny, nz, gk, group, g, p, k;
        for (i = 0; i < DIRS.length; i++) {
            nx = x + DIRS[i][0];
            ny = y + DIRS[i][1];
            nz = z + DIRS[i][2];
            if (!St.inBounds(state, nx, ny, nz)) continue;
            if (St.getStone(state, nx, ny, nz) !== opp) continue;
            gk = pointKey(nx, ny, nz);
            if (seenGroup[gk]) continue;
            group = getGroup(state, nx, ny, nz);
            for (g = 0; g < group.length; g++) {
                seenGroup[pointKey(group[g].x, group[g].y, group[g].z)] = true;
            }
            if (getLiberties(state, group).count !== 0) continue;
            for (g = 0; g < group.length; g++) {
                p = group[g];
                k = pointKey(p.x, p.y, p.z);
                captured.push({ x: p.x, y: p.y, z: p.z, color: opp });
                St.setStone(state, p.x, p.y, p.z, St.EMPTY);
            }
        }
        return captured;
    }

    function fail(state, message) {
        var St = S();
        return {
            ok: false,
            state: St.clone(state),
            captured: [],
            message: message
        };
    }

    function play(state, x, y, z) {
        var St = S();
        if (!state || state.phase !== "playing") {
            return fail(state, "game is not in playing phase");
        }
        if (!St.inBounds(state, x, y, z)) {
            return fail(state, "out of bounds");
        }
        if (St.getStone(state, x, y, z) !== St.EMPTY) {
            return fail(state, "point occupied");
        }

        var next = St.clone(state);
        var color = next.toPlay;
        var opp = St.opponent(color);
        var prevKoPoint = copyPt(next.koPoint);
        var prevPassCount = next.passCount;
        var prevPlaysThisTurn = next.playsThisTurn || 0;

        St.setStone(next, x, y, z, color);
        var captured = captureDeadNeighbors(next, x, y, z, opp);

        var ownGroup = getGroup(next, x, y, z);
        if (getLiberties(next, ownGroup).count === 0 && captured.length === 0) {
            return fail(state, "illegal suicide");
        }

        if (captured.length === 1 && samePoint({ x: x, y: y, z: z }, state.koPoint)) {
            return fail(state, "illegal ko recapture");
        }

        var koPoint = null;
        if (captured.length === 1 && ownGroup.length === 1) {
            koPoint = {
                x: captured[0].x,
                y: captured[0].y,
                z: captured[0].z
            };
        }

        var i;
        for (i = 0; i < captured.length; i++) {
            if (captured[i].color === St.BLACK) next.capturedBlack += 1;
            else if (captured[i].color === St.WHITE) next.capturedWhite += 1;
        }

        next.koPoint = koPoint;
        next.passCount = 0;
        var record = {
            type: "play",
            color: color,
            x: x,
            y: y,
            z: z,
            captured: captured.map(function (c) {
                return { x: c.x, y: c.y, z: c.z, color: c.color };
            }),
            prevKoPoint: prevKoPoint,
            prevPassCount: prevPassCount,
            prevPlaysThisTurn: prevPlaysThisTurn
        };
        next.moveHistory.push(record);
        next.lastAction = record;
        next.playsThisTurn = prevPlaysThisTurn + 1;
        var mpt = next.movesPerTurn != null ? next.movesPerTurn : 1;
        if (next.playsThisTurn >= mpt) {
            next.toPlay = opp;
            next.playsThisTurn = 0;
        } else {
            next.toPlay = color;
        }

        return {
            ok: true,
            state: next,
            captured: record.captured,
            message: captured.length ? "capture" : "ok"
        };
    }

    function isLegal(state, x, y, z) {
        return play(state, x, y, z).ok;
    }

    function pass(state) {
        var St = S();
        if (!state || state.phase !== "playing") {
            return {
                state: St.clone(state),
                finished: !!(state && state.phase !== "playing"),
                ended: !!(state && state.phase === "ended"),
                message: "game is not in playing phase"
            };
        }
        var next = St.clone(state);
        var color = next.toPlay;
        var record = {
            type: "pass",
            color: color,
            prevKoPoint: copyPt(next.koPoint),
            prevPassCount: next.passCount,
            prevPlaysThisTurn: next.playsThisTurn || 0
        };
        next.moveHistory.push(record);
        next.lastAction = record;
        next.koPoint = null;
        next.playsThisTurn = 0;
        next.passCount = next.passCount + 1;
        var ended = next.passCount >= 2;
        if (ended) {
            next.phase = "ended";
        } else {
            next.toPlay = St.opponent(color);
        }
        return {
            state: next,
            finished: false,
            ended: ended,
            message: ended ? "雙方停手（計分延後）" : "pass"
        };
    }

    function resign(state) {
        var St = S();
        var next = St.clone(state);
        if (next.phase !== "playing") {
            return { state: next, winner: next.winner };
        }
        var color = next.toPlay;
        var winner = St.opponent(color);
        var record = {
            type: "resign",
            color: color,
            prevPlaysThisTurn: next.playsThisTurn || 0
        };
        next.playsThisTurn = 0;
        next.moveHistory.push(record);
        next.lastAction = record;
        next.phase = "finished";
        next.winner = winner;
        return { state: next, winner: winner };
    }

    GoGame.Rules = {
        DIRS: DIRS,
        getGroup: getGroup,
        getLiberties: getLiberties,
        isLegal: isLegal,
        play: play,
        pass: pass,
        resign: resign
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_rules] GoGame.Rules ready (P2 capture / suicide / simple ko)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
