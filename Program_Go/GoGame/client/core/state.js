/**
 * GoGame.State — spatial Go board[z][y][x], axes sizeX/Y/Z in [1,9].
 * UI still uses newGame({size:N}) → cube. Cuboid via sizeX/Y/Z (tests).
 * Always use getStone / setStone(state, x, y, z, ...).
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};

    var EMPTY = 0;
    var BLACK = 1;
    var WHITE = 2;
    var MIN_SIZE = 1;
    var MAX_SIZE = 9;
    var DEFAULT_SIZE = 4;
    var SIZE = DEFAULT_SIZE;
    var DEFAULT_KOMI = 6.5;
    var DEFAULT_MOVES_PER_TURN = 1;
    var MIN_MOVES_PER_TURN = 1;
    var MAX_MOVES_PER_TURN = 6;

    function isAllowedKomi(k) {
        if (typeof k !== "number" || !isFinite(k)) return false;
        var i;
        for (i = 0; i <= 19; i++) {
            if (k === i + 0.5) return true;
        }
        return false;
    }

    function clampKomi(k) {
        if (k == null) return DEFAULT_KOMI;
        return isAllowedKomi(k) ? k : DEFAULT_KOMI;
    }

    function isAllowedMovesPerTurn(n) {
        return typeof n === "number" && n === (n | 0) &&
            n >= MIN_MOVES_PER_TURN && n <= MAX_MOVES_PER_TURN;
    }

    function clampMovesPerTurn(n) {
        if (n == null) return DEFAULT_MOVES_PER_TURN;
        return isAllowedMovesPerTurn(n) ? n : DEFAULT_MOVES_PER_TURN;
    }

    function clampSize(n) {
        n = n | 0;
        if (n < MIN_SIZE || n > MAX_SIZE) return DEFAULT_SIZE;
        return n;
    }

    function opponent(color) {
        return color === BLACK ? WHITE : BLACK;
    }

    function axisLen(state, axis) {
        if (!state) return SIZE;
        if (axis === "x" && state.sizeX != null) return state.sizeX;
        if (axis === "y" && state.sizeY != null) return state.sizeY;
        if (axis === "z" && state.sizeZ != null) return state.sizeZ;
        if (state.size != null) return state.size;
        return SIZE;
    }

    function inBounds(state, x, y, z) {
        return x >= 0 && y >= 0 && z >= 0 &&
            x < axisLen(state, "x") &&
            y < axisLen(state, "y") &&
            z < axisLen(state, "z");
    }

    function emptyBoard(sx, sy, sz) {
        if (sy == null && sz == null) {
            sx = clampSize(sx != null ? sx : DEFAULT_SIZE);
            sy = sz = sx;
        } else {
            sx = clampSize(sx);
            sy = clampSize(sy);
            sz = clampSize(sz);
        }
        var board = [];
        var z, y, x, layer, row;
        for (z = 0; z < sz; z++) {
            layer = [];
            for (y = 0; y < sy; y++) {
                row = [];
                for (x = 0; x < sx; x++) {
                    row.push(EMPTY);
                }
                layer.push(row);
            }
            board.push(layer);
        }
        return board;
    }

    function copyBoard(board) {
        var out = [];
        var z, y;
        for (z = 0; z < board.length; z++) {
            out[z] = [];
            for (y = 0; y < board[z].length; y++) {
                out[z][y] = board[z][y].slice();
            }
        }
        return out;
    }

    function copyPoint(p) {
        return p ? { x: p.x, y: p.y, z: p.z } : null;
    }

    function copyDeadList(list) {
        if (!list || !list.length) return [];
        return list.map(function (pt) {
            return { x: pt.x, y: pt.y, z: pt.z };
        });
    }

    function deadKey(x, y, z) {
        return x + "," + y + "," + z;
    }

    function isDead(state, x, y, z) {
        var d = (state && state.deadStones) || [];
        var i;
        for (i = 0; i < d.length; i++) {
            if (d[i].x === x && d[i].y === y && d[i].z === z) return true;
        }
        return false;
    }

    function copyHistoryRecord(rec) {
        if (!rec) return null;
        var out = {
            type: rec.type,
            color: rec.color
        };
        if (rec.x !== undefined) out.x = rec.x;
        if (rec.y !== undefined) out.y = rec.y;
        if (rec.z !== undefined) out.z = rec.z;
        if (rec.prevPassCount !== undefined) out.prevPassCount = rec.prevPassCount;
        if (rec.prevPlaysThisTurn !== undefined) out.prevPlaysThisTurn = rec.prevPlaysThisTurn;
        if (rec.prevKoPoint !== undefined) out.prevKoPoint = copyPoint(rec.prevKoPoint);
        if (rec.captured) {
            out.captured = rec.captured.map(function (c) {
                return { x: c.x, y: c.y, z: c.z, color: c.color };
            });
        }
        return out;
    }

    function newGame(opts) {
        opts = opts || {};
        var komi = clampKomi(opts.komi != null ? opts.komi : DEFAULT_KOMI);
        var movesPerTurn = clampMovesPerTurn(
            opts.movesPerTurn != null ? opts.movesPerTurn : DEFAULT_MOVES_PER_TURN
        );
        var base = clampSize(opts.size != null ? opts.size : DEFAULT_SIZE);
        var sx = clampSize(opts.sizeX != null ? opts.sizeX : base);
        var sy = clampSize(opts.sizeY != null ? opts.sizeY : base);
        var sz = clampSize(opts.sizeZ != null ? opts.sizeZ : base);
        var cube = (sx === sy && sy === sz) ? sx : null;
        return {
            sizeX: sx,
            sizeY: sy,
            sizeZ: sz,
            size: cube,
            board: emptyBoard(sx, sy, sz),
            toPlay: BLACK,
            capturedBlack: 0,
            capturedWhite: 0,
            koPoint: null,
            passCount: 0,
            moveHistory: [],
            lastAction: null,
            phase: "playing",
            komi: komi,
            movesPerTurn: movesPerTurn,
            playsThisTurn: 0,
            winner: null,
            deadStones: [],
            scoreResult: null
        };
    }

    function clone(state) {
        return {
            sizeX: state.sizeX,
            sizeY: state.sizeY,
            sizeZ: state.sizeZ,
            size: state.size,
            board: copyBoard(state.board),
            toPlay: state.toPlay,
            capturedBlack: state.capturedBlack,
            capturedWhite: state.capturedWhite,
            koPoint: copyPoint(state.koPoint),
            passCount: state.passCount,
            moveHistory: state.moveHistory.map(copyHistoryRecord),
            lastAction: copyHistoryRecord(state.lastAction),
            phase: state.phase,
            komi: state.komi,
            movesPerTurn: state.movesPerTurn != null ? state.movesPerTurn : DEFAULT_MOVES_PER_TURN,
            playsThisTurn: state.playsThisTurn != null ? state.playsThisTurn : 0,
            winner: state.winner,
            deadStones: copyDeadList(state.deadStones),
            scoreResult: state.scoreResult || null
        };
    }

    function undo(state) {
        if (!state.moveHistory || state.moveHistory.length === 0) {
            return clone(state);
        }
        var s = clone(state);
        var rec = s.moveHistory.pop();
        s.lastAction = s.moveHistory.length
            ? copyHistoryRecord(s.moveHistory[s.moveHistory.length - 1])
            : null;

        if (rec.type === "play") {
            setStone(s, rec.x, rec.y, rec.z, EMPTY);
            var captured = rec.captured || [];
            var i, c;
            for (i = 0; i < captured.length; i++) {
                c = captured[i];
                setStone(s, c.x, c.y, c.z, c.color);
                if (c.color === BLACK) s.capturedBlack -= 1;
                else if (c.color === WHITE) s.capturedWhite -= 1;
            }
            s.koPoint = copyPoint(rec.prevKoPoint);
            s.passCount = rec.prevPassCount != null ? rec.prevPassCount : 0;
            s.toPlay = rec.color;
            s.playsThisTurn = rec.prevPlaysThisTurn != null ? rec.prevPlaysThisTurn : 0;
            s.phase = "playing";
            s.winner = null;
            s.deadStones = [];
            s.scoreResult = null;
        } else if (rec.type === "pass") {
            s.passCount = rec.prevPassCount != null ? rec.prevPassCount : 0;
            s.koPoint = copyPoint(rec.prevKoPoint);
            s.toPlay = rec.color;
            s.playsThisTurn = rec.prevPlaysThisTurn != null ? rec.prevPlaysThisTurn : 0;
            s.phase = "playing";
            s.winner = null;
            s.deadStones = [];
            s.scoreResult = null;
        } else if (rec.type === "resign") {
            s.toPlay = rec.color;
            s.playsThisTurn = rec.prevPlaysThisTurn != null ? rec.prevPlaysThisTurn : 0;
            s.phase = "playing";
            s.winner = null;
            s.deadStones = [];
            s.scoreResult = null;
        }
        return s;
    }

    function getStone(state, x, y, z) {
        if (!inBounds(state, x, y, z)) return null;
        return state.board[z][y][x];
    }

    function setStone(state, x, y, z, color) {
        if (!inBounds(state, x, y, z)) return;
        state.board[z][y][x] = color;
    }

    GoGame.State = {
        EMPTY: EMPTY,
        BLACK: BLACK,
        WHITE: WHITE,
        SIZE: DEFAULT_SIZE,
        DEFAULT_SIZE: DEFAULT_SIZE,
        MIN_SIZE: MIN_SIZE,
        MAX_SIZE: MAX_SIZE,
        DEFAULT_KOMI: DEFAULT_KOMI,
        DEFAULT_MOVES_PER_TURN: DEFAULT_MOVES_PER_TURN,
        MIN_MOVES_PER_TURN: MIN_MOVES_PER_TURN,
        MAX_MOVES_PER_TURN: MAX_MOVES_PER_TURN,
        isAllowedKomi: isAllowedKomi,
        clampKomi: clampKomi,
        isAllowedMovesPerTurn: isAllowedMovesPerTurn,
        clampMovesPerTurn: clampMovesPerTurn,
        clampSize: clampSize,
        axisLen: axisLen,
        opponent: opponent,
        inBounds: inBounds,
        newGame: newGame,
        clone: clone,
        undo: undo,
        getStone: getStone,
        setStone: setStone,
        isDead: isDead,
        deadKey: deadKey,
        copyDeadList: copyDeadList
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_state] GoGame.State ready (sizeX/Y/Z spatial)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
