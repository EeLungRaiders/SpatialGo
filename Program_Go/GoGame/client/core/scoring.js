/**
 * GoGame.Scoring — Japanese territory scoring (P4b). Default cube is 4×4×4.
 * black = terr + capturedWhite + deadWhite
 * white = terr + capturedBlack + deadBlack + state.komi (default 6.5)
 * Live stones are NOT added to the score. Board account: live+terr+dame===sx*sy*sz.
 * Dead stones count as empty for flood-fill. Six-neighbour, no diagonals.
 * Read-only on board. Internal index; volume from sizeX/Y/Z.
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};
    var DIRS = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
    ];

    function S() {
        if (!GoGame.State) throw new Error("GoGame.Scoring requires GoGame.State");
        return GoGame.State;
    }

    function dims(state) {
        var St = S();
        var sx = (state && (state.sizeX != null ? state.sizeX : state.size)) || St.SIZE;
        var sy = (state && (state.sizeY != null ? state.sizeY : state.size)) || St.SIZE;
        var sz = (state && (state.sizeZ != null ? state.sizeZ : state.size)) || St.SIZE;
        return { x: sx | 0, y: sy | 0, z: sz | 0 };
    }

    function deadKey(x, y, z) {
        return x + "," + y + "," + z;
    }

    function deadSetFrom(state, extra) {
        var set = {};
        var list = extra || (state && state.deadStones) || [];
        var i, p;
        for (i = 0; i < list.length; i++) {
            p = list[i];
            if (!p) continue;
            set[deadKey(p.x, p.y, p.z)] = true;
        }
        return set;
    }

    function isLiveStone(state, x, y, z, dSet) {
        var St = S();
        var v = St.getStone(state, x, y, z);
        if (v !== St.BLACK && v !== St.WHITE) return 0;
        if (dSet[deadKey(x, y, z)]) return 0;
        return v;
    }

    function isEmptyForFill(state, x, y, z, dSet) {
        var St = S();
        var v = St.getStone(state, x, y, z);
        if (v === St.EMPTY) return true;
        if ((v === St.BLACK || v === St.WHITE) && dSet[deadKey(x, y, z)]) return true;
        return false;
    }

    function countLive(state, dSet) {
        var St = S();
        var d = dims(state);
        var b = 0, w = 0, z, y, x, v;
        for (z = 0; z < d.z; z++) {
            for (y = 0; y < d.y; y++) {
                for (x = 0; x < d.x; x++) {
                    v = isLiveStone(state, x, y, z, dSet);
                    if (v === St.BLACK) b++;
                    else if (v === St.WHITE) w++;
                }
            }
        }
        return { black: b, white: w };
    }

    function computeTerritory(state, dSet, includePoints) {
        var St = S();
        var d = dims(state);
        var visited = {};
        var blackTerr = 0, whiteTerr = 0, dame = 0;
        var blackPts = [], whitePts = [], damePts = [];
        var z, y, x, key, region, q, i, p, nx, ny, nz, nk, live, touchB, touchW;

        function visitKey(a, b, c) { return a + "," + b + "," + c; }

        for (z = 0; z < d.z; z++) {
            for (y = 0; y < d.y; y++) {
                for (x = 0; x < d.x; x++) {
                    key = visitKey(x, y, z);
                    if (visited[key]) continue;
                    if (!isEmptyForFill(state, x, y, z, dSet)) {
                        visited[key] = true;
                        continue;
                    }
                    region = [];
                    q = [{ x: x, y: y, z: z }];
                    visited[key] = true;
                    touchB = false;
                    touchW = false;
                    while (q.length) {
                        p = q.pop();
                        region.push(p);
                        for (i = 0; i < DIRS.length; i++) {
                            nx = p.x + DIRS[i][0];
                            ny = p.y + DIRS[i][1];
                            nz = p.z + DIRS[i][2];
                            if (!St.inBounds(state, nx, ny, nz)) continue;
                            live = isLiveStone(state, nx, ny, nz, dSet);
                            if (live === St.BLACK) { touchB = true; continue; }
                            if (live === St.WHITE) { touchW = true; continue; }
                            if (!isEmptyForFill(state, nx, ny, nz, dSet)) continue;
                            nk = visitKey(nx, ny, nz);
                            if (visited[nk]) continue;
                            visited[nk] = true;
                            q.push({ x: nx, y: ny, z: nz });
                        }
                    }
                    if (touchB && !touchW) {
                        blackTerr += region.length;
                        if (includePoints) blackPts = blackPts.concat(region);
                    } else if (touchW && !touchB) {
                        whiteTerr += region.length;
                        if (includePoints) whitePts = whitePts.concat(region);
                    } else {
                        dame += region.length;
                        if (includePoints) damePts = damePts.concat(region);
                    }
                }
            }
        }
        var out = { black: blackTerr, white: whiteTerr, dame: dame };
        if (includePoints) {
            out.points = { black: blackPts, white: whitePts, dame: damePts };
        }
        return out;
    }

    function score(state, opts) {
        opts = opts || {};
        if (!state || !state.board) {
            throw new Error("GoGame.Scoring.score: missing state");
        }
        var St = S();
        var dSet = deadSetFrom(state, opts.deadStones);
        var live = countLive(state, dSet);
        var terr = computeTerritory(state, dSet, !!opts.includePoints);
        var komi = state.komi != null ? state.komi : St.DEFAULT_KOMI;
        var capB = state.capturedBlack || 0;
        var capW = state.capturedWhite || 0;
        var deadB = 0, deadW = 0, z, y, x, v;
        var dim = dims(state);
        for (z = 0; z < dim.z; z++) {
            for (y = 0; y < dim.y; y++) {
                for (x = 0; x < dim.x; x++) {
                    if (!dSet[deadKey(x, y, z)]) continue;
                    v = St.getStone(state, x, y, z);
                    if (v === St.BLACK) deadB++;
                    else if (v === St.WHITE) deadW++;
                }
            }
        }
        var black = terr.black + capW + deadW;
        var white = terr.white + capB + deadB + komi;
        var cells = live.black + live.white + terr.black + terr.white + terr.dame;
        var winnerStr = white > black ? "white" : "black";
        var winnerColor = white > black ? St.WHITE : St.BLACK;
        return {
            black: black,
            white: white,
            winner: winnerStr,
            winnerColor: winnerColor,
            territory: {
                black: terr.black,
                white: terr.white,
                dame: terr.dame,
                points: terr.points || null
            },
            stones: { black: live.black, white: live.white },
            captures: { black: capW, white: capB },
            dead: { black: deadW, white: deadB },
            komi: komi,
            cells: cells,
            reason: "territory B " + terr.black + "+" + capW + "+" + deadW +
                " W " + terr.white + "+" + capB + "+" + deadB + "+" + komi
        };
    }

    GoGame.Scoring = {
        score: score,
        computeTerritory: function (state) {
            return computeTerritory(state, deadSetFrom(state));
        },
        countLive: function (state) {
            return countLive(state, deadSetFrom(state));
        }
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_scoring] GoGame.Scoring ready (territory+captures, komi 6.5)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
