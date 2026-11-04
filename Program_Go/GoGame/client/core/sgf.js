/**
 * 舊參考，已不使用。專頁與 AutoLoad 不載入。SGF deferred。
 * GoGame.Sgf — 平面 FF[4] 匯出入。不是現在的棋譜（棋譜是 Go3D JSON）。
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};
    // a–z (0..25) then A–Z (26..51). Includes 'i' (FF[4]), not print A–T skip-I.
    var ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var DEFAULT_SIZE = 19; // when size arg / SZ omitted
    /** @deprecated use DEFAULT_SIZE; kept as alias for default size when omitted */
    var SUPPORTED_SIZE = DEFAULT_SIZE;

    function State() {
        if (!GoGame.State) throw new Error("GoGame.Sgf requires GoGame.State");
        return GoGame.State;
    }
    function Rules() {
        if (!GoGame.Rules) throw new Error("GoGame.Sgf requires GoGame.Rules");
        return GoGame.Rules;
    }

    function colorLetter(color) {
        var St = State();
        return color === St.BLACK ? "B" : "W";
    }

    function letterToColor(ch) {
        var St = State();
        if (ch === "B" || ch === "b") return St.BLACK;
        if (ch === "W" || ch === "w") return St.WHITE;
        return null;
    }

    /** Product size bounds from State (MIN_SIZE..MAX_SIZE). */
    function productMinSize() {
        return State().MIN_SIZE;
    }
    function productMaxSize() {
        return State().MAX_SIZE;
    }

    /**
     * Resolve {width,height} from state (prefers width/height; falls back to size).
     */
    function boardDims(state) {
        if (!state) return { width: DEFAULT_SIZE, height: DEFAULT_SIZE };
        if (state.width != null && state.height != null) {
            return { width: state.width, height: state.height };
        }
        var n = state.size != null ? state.size : DEFAULT_SIZE;
        return { width: n, height: n };
    }

    /**
     * Normalize point API dims.
     * - number only → square N×N
     * - (width, height) two numbers
     * - { width, height } object as first dims arg
     */
    function normalizePointDims(widthOrDims, height) {
        if (widthOrDims != null && typeof widthOrDims === "object") {
            return {
                width: widthOrDims.width,
                height: widthOrDims.height
            };
        }
        if (height != null) {
            return { width: widthOrDims, height: height };
        }
        var n = widthOrDims != null ? widthOrDims : DEFAULT_SIZE;
        return { width: n, height: n };
    }

    /**
     * tt is legacy pass only when BOTH dimensions are ≤ 19.
     */
    function ttIsPass(width, height) {
        return width <= 19 && height <= 19;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number|{width,height}} [widthOrDims] square size, width, or dims object
     * @param {number} [height] when widthOrDims is width
     * @returns {string|null} two-letter SGF point, or null if out of range
     */
    function toSgfPoint(x, y, widthOrDims, height) {
        var d = normalizePointDims(widthOrDims, height);
        var w = d.width;
        var h = d.height;
        if (typeof x !== "number" || typeof y !== "number") return null;
        if (typeof w !== "number" || typeof h !== "number") return null;
        if (x < 0 || y < 0 || x >= w || y >= h) return null;
        if (w > ALPHABET.length || h > ALPHABET.length) return null;
        return ALPHABET.charAt(x) + ALPHABET.charAt(y);
    }

    /**
     * @returns { pass:true } | { x, y } | { error: string }
     *   pass: empty string, or "tt" when width≤19 && height≤19
     */
    function fromSgfPoint(pt, widthOrDims, height) {
        var d = normalizePointDims(widthOrDims, height);
        var w = d.width;
        var h = d.height;
        if (w == null) w = DEFAULT_SIZE;
        if (h == null) h = DEFAULT_SIZE;
        if (pt == null) return { pass: true };
        pt = String(pt).replace(/^\s+|\s+$/g, "");
        if (pt.length === 0) return { pass: true };
        // Common pass encoding when both dims ≤19; otherwise "tt" may be a real point.
        if (pt === "tt" && ttIsPass(w, h)) return { pass: true };
        if (pt.length !== 2) return { error: "invalid point length: " + pt };
        var cx = ALPHABET.indexOf(pt.charAt(0));
        var cy = ALPHABET.indexOf(pt.charAt(1));
        if (cx < 0 || cy < 0) return { error: "invalid point chars: " + pt };
        if (cx >= w || cy >= h) {
            return {
                error: "point out of range: " + pt + " (board " + w + "×" + h + ")"
            };
        }
        return { x: cx, y: cy };
    }

    function formatKomi(k) {
        if (typeof k !== "number" || isNaN(k)) return "6.5";
        // trim trailing zeros carefully
        var s = String(k);
        return s;
    }

    function resignRE(state) {
        var St = State();
        if (state.phase !== "finished" || state.winner == null) return "";
        // Resign-style result if last action was resign
        var last = state.lastAction;
        if (last && last.type === "resign") {
            return state.winner === St.BLACK ? "B+R" : "W+R";
        }
        return "";
    }

    /**
     * Score-style RE when finished/scoring and not resign (Phase 4 optional).
     * Uses state.scoreResult if present; else live GoGame.Scoring.score.
     */
    function scoreRE(state) {
        var St = State();
        var last = state.lastAction;
        if (last && last.type === "resign") return "";
        if (state.phase !== "finished" && state.phase !== "scoring") return "";
        var res = state.scoreResult;
        if (!res && GoGame.Scoring && typeof GoGame.Scoring.score === "function") {
            try {
                res = GoGame.Scoring.score(state);
            } catch (e) {
                return "";
            }
        }
        if (!res) return "";
        if (res.winner === "draw") return "0";
        var margin = Math.abs(res.black - res.white);
        var letter = res.winner === "black" ? "B" : "W";
        return letter + "+" + margin;
    }

    function resultRE(state) {
        return resignRE(state) || scoreRE(state) || "";
    }

    /**
     * Validate one dimension (width or height or square SZ).
     * @returns {string|null} error message, or null if ok
     */
    function dimErrorMessage(n, label) {
        var min = productMinSize();
        var max = productMaxSize();
        label = label || "dim";
        if (typeof n !== "number" || !isFinite(n) || isNaN(n)) {
            return "invalid SZ " + label;
        }
        if ((n | 0) !== n) {
            return "invalid SZ " + label + " (must be integer, got " + n + ")";
        }
        if (n < min || n > max) {
            return (
                "unsupported board " + label + " " + n +
                " (allowed " + min + "-" + max + " per dimension)"
            );
        }
        if (n > ALPHABET.length) {
            return (
                "board " + label + " " + n +
                " exceeds SGF alphabet capacity " + ALPHABET.length
            );
        }
        return null;
    }

    /**
     * Validate width×height. Messages distinguish square SZ[N] vs compose SZ[W:H].
     * @returns {string|null}
     */
    function dimsErrorMessage(width, height) {
        var ew = dimErrorMessage(width, "width");
        if (ew) {
            if (width === height || height == null) {
                // square-style message when only one dim matters
                return sizeErrorMessageSquare(width);
            }
            return (
                "unsupported board size SZ[" + width + ":" + height + "]: " + ew
            );
        }
        var eh = dimErrorMessage(height, "height");
        if (eh) {
            if (width === height) return sizeErrorMessageSquare(height);
            return (
                "unsupported board size SZ[" + width + ":" + height + "]: " + eh
            );
        }
        return null;
    }

    /** Legacy square SZ[N] error wording (tests look for size numbers). */
    function sizeErrorMessageSquare(size) {
        var min = productMinSize();
        var max = productMaxSize();
        if (typeof size !== "number" || !isFinite(size) || isNaN(size)) {
            return "invalid SZ";
        }
        if ((size | 0) !== size) {
            return "invalid SZ (must be integer, got " + size + ")";
        }
        if (size < min || size > max) {
            return "unsupported board size SZ[" + size + "] (allowed " + min + "-" + max + ")";
        }
        if (size > ALPHABET.length) {
            return "board size " + size + " exceeds SGF alphabet capacity " + ALPHABET.length;
        }
        return null;
    }

    /**
     * Validate product board size for export/import (square API).
     * @returns {string|null} error message, or null if ok
     */
    function sizeErrorMessage(size) {
        return sizeErrorMessageSquare(size);
    }

    /**
     * Parse SZ property value: "N" or "W:H" (columns:rows).
     * @returns {{ width:number, height:number } | { error:string }}
     */
    function parseSzValue(raw) {
        if (raw == null) return { error: "invalid SZ" };
        var s = String(raw).replace(/^\s+|\s+$/g, "");
        if (!s) return { error: "invalid SZ" };
        // Integer N, or W:H with non-negative integers (signs rejected).
        var m = s.match(/^(\d+)(?::(\d+))?$/);
        if (!m) {
            return {
                error: "invalid SZ (expected N or W:H, got " + s + ")"
            };
        }
        var width = parseInt(m[1], 10);
        var height = m[2] != null ? parseInt(m[2], 10) : width;
        // Square form uses SZ[N] wording; compose uses SZ[W:H].
        if (m[2] == null) {
            var se = sizeErrorMessageSquare(width);
            if (se) return { error: se };
            return { width: width, height: height };
        }
        var de = dimsErrorMessage(width, height);
        if (de) return { error: de };
        return { width: width, height: height };
    }

    function formatSzToken(width, height) {
        if (width === height) return String(width);
        return width + ":" + height;
    }

    /**
     * exportSgf(state) -> string
     * Square → SZ[N]; rectangle → SZ[W:H]. Never SZ[N:N] for squares.
     */
    function exportSgf(state) {
        if (!state) throw new Error("exportSgf: missing state");
        var d = boardDims(state);
        var serr = dimsErrorMessage(d.width, d.height);
        if (serr) throw new Error("exportSgf: " + serr);
        // Prefer square error path wording when square fails sizeErrorMessage
        if (d.width === d.height) {
            var se = sizeErrorMessageSquare(d.width);
            if (se) throw new Error("exportSgf: " + se);
        }
        var parts = [];
        parts.push("FF[4]");
        parts.push("GM[1]");
        parts.push("SZ[" + formatSzToken(d.width, d.height) + "]");
        parts.push("KM[" + formatKomi(state.komi) + "]");
        parts.push("AP[ProgramGo:1]");
        var re = resultRE(state);
        if (re) parts.push("RE[" + re + "]");

        var nodes = [parts.join("")];
        var hist = state.moveHistory || [];
        for (var i = 0; i < hist.length; i++) {
            var m = hist[i];
            if (m.type === "resign") continue;
            var L = colorLetter(m.color);
            if (m.type === "pass") {
                nodes.push(L + "[]");
            } else if (m.type === "play") {
                var pt = toSgfPoint(m.x, m.y, d.width, d.height);
                if (!pt) throw new Error("exportSgf: bad coordinates at move " + i);
                nodes.push(L + "[" + pt + "]");
            }
        }
        // (;root;B[pd];W[dd]...)
        return "(;" + nodes.join(";") + ")";
    }

    /**
     * Minimal mainline parser: first game tree, first variation only.
     * Returns { width, height, sz, km, gm, moves: [{colorLetter, rawPoint}] }
     * sz is set only when width===height (square); else null.
     */
    function parseSgfMainline(text) {
        if (text == null) throw new Error("empty SGF");
        var s = String(text);
        // Strip whitespace outside property values for simpler scanning
        // Simple approach: remove newlines/tabs first (values rarely need them in v1)
        s = s.replace(/[\r\n\t]/g, "");

        var start = s.indexOf("(;");
        if (start < 0) {
            // allow leading spaces already stripped
            start = s.indexOf(";");
            if (start < 0) throw new Error("no SGF nodes found");
            // wrap handling: find content from first ;
        } else {
            s = s.substring(start + 1); // drop leading '('  keep from ';'
        }

        // Walk mainline: at each level take first branch only
        var props = []; // list of { key, value } in order, grouped by node later
        var nodes = []; // each node: array of {key, value}
        var i = 0;
        var depth = 0;
        var currentNode = null;
        var inTree = true;

        function readIdent(idx) {
            var j = idx;
            while (j < s.length && s.charAt(j) >= "A" && s.charAt(j) <= "Z") j++;
            // also allow lowercase for robustness
            if (j === idx) {
                while (j < s.length && s.charAt(j) >= "a" && s.charAt(j) <= "z") j++;
            }
            return { id: s.substring(idx, j).toUpperCase(), next: j };
        }

        function readValue(idx) {
            // expect [
            if (s.charAt(idx) !== "[") return { value: null, next: idx };
            var j = idx + 1;
            var out = "";
            while (j < s.length) {
                var ch = s.charAt(j);
                if (ch === "\\" && j + 1 < s.length) {
                    out += s.charAt(j + 1);
                    j += 2;
                    continue;
                }
                if (ch === "]") {
                    return { value: out, next: j + 1 };
                }
                out += ch;
                j++;
            }
            throw new Error("unclosed property value");
        }

        // Parse until matching close of outermost or end
        // Start at first ';'
        if (s.charAt(0) !== ";") {
            var si = s.indexOf(";");
            if (si < 0) throw new Error("no node start");
            s = s.substring(si);
        }

        i = 0;
        depth = 0;
        var skipDepth = 0; // when >0, skip variation content
        while (i < s.length) {
            var c = s.charAt(i);
            if (c === "(") {
                depth++;
                // variation: if we already have moves after root, skip side branch
                if (nodes.length > 1 || (nodes.length === 1 && currentNode && currentNode.length)) {
                    // entering alt variation — skip until this paren closes
                    skipDepth = 1;
                    i++;
                    while (i < s.length && skipDepth > 0) {
                        if (s.charAt(i) === "[") {
                            // skip value
                            var rv = readValue(i);
                            i = rv.next;
                            continue;
                        }
                        if (s.charAt(i) === "(") skipDepth++;
                        else if (s.charAt(i) === ")") skipDepth--;
                        i++;
                    }
                    continue;
                }
                i++;
                continue;
            }
            if (c === ")") {
                break; // end mainline tree
            }
            if (c === ";") {
                if (currentNode) nodes.push(currentNode);
                currentNode = [];
                i++;
                continue;
            }
            // property
            if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z")) {
                if (!currentNode) currentNode = [];
                var idr = readIdent(i);
                i = idr.next;
                // one or more [values]
                if (s.charAt(i) !== "[") {
                    // soft skip
                    continue;
                }
                while (s.charAt(i) === "[") {
                    var valr = readValue(i);
                    currentNode.push({ key: idr.id, value: valr.value });
                    i = valr.next;
                }
                continue;
            }
            // ignore spaces
            i++;
        }
        if (currentNode) nodes.push(currentNode);
        if (!nodes.length) throw new Error("no nodes parsed");

        var root = nodes[0];
        // Missing SZ → default 19×19 (legacy 19×19 files without SZ).
        var width = DEFAULT_SIZE;
        var height = DEFAULT_SIZE;
        var szRaw = null;
        var km = 6.5;
        var gm = 1;
        for (var r = 0; r < root.length; r++) {
            if (root[r].key === "SZ") szRaw = root[r].value;
            if (root[r].key === "KM") km = parseFloat(root[r].value);
            if (root[r].key === "GM") gm = parseInt(root[r].value, 10);
        }
        if (szRaw != null) {
            var parsedSz = parseSzValue(szRaw);
            if (parsedSz.error) throw new Error(parsedSz.error);
            width = parsedSz.width;
            height = parsedSz.height;
        }

        var moves = [];
        for (var n = 1; n < nodes.length; n++) {
            var node = nodes[n];
            for (var p = 0; p < node.length; p++) {
                var k = node[p].key;
                if (k === "B" || k === "W") {
                    moves.push({ color: k, point: node[p].value });
                }
            }
        }
        return {
            width: width,
            height: height,
            // square-only convenience (null when rectangular)
            sz: width === height ? width : null,
            km: km,
            gm: gm,
            moves: moves
        };
    }

    function boardsEqual(a, b) {
        var da = boardDims(a);
        var db = boardDims(b);
        if (da.width !== db.width || da.height !== db.height) return false;
        for (var y = 0; y < da.height; y++) {
            for (var x = 0; x < da.width; x++) {
                if (a.board[y][x] !== b.board[y][x]) return false;
            }
        }
        return true;
    }

    /**
     * importSgf(text) -> { ok, state, message }
     */
    function importSgf(text) {
        try {
            var parsed = parseSgfMainline(text);
            if (parsed.gm !== 1 && !isNaN(parsed.gm)) {
                return { ok: false, state: null, message: "only GM[1] (Go) supported" };
            }
            var width = parsed.width;
            var height = parsed.height;
            if (typeof width !== "number" || typeof height !== "number" ||
                isNaN(width) || isNaN(height)) {
                return { ok: false, state: null, message: "invalid SZ" };
            }
            var serr = dimsErrorMessage(width, height);
            if (serr) {
                return { ok: false, state: null, message: serr };
            }
            // Square path: keep sizeErrorMessage wording for pure N failures already handled.
            if (width === height) {
                var se = sizeErrorMessageSquare(width);
                if (se) return { ok: false, state: null, message: se };
            }
            var komi = isNaN(parsed.km) ? 6.5 : parsed.km;
            var St = State();
            var Ru = Rules();
            var state = St.newGame({ width: width, height: height, komi: komi });

            for (var i = 0; i < parsed.moves.length; i++) {
                var m = parsed.moves[i];
                var col = letterToColor(m.color);
                if (col == null) {
                    return { ok: false, state: null, message: "bad color at move " + i };
                }
                if (state.toPlay !== col) {
                    return {
                        ok: false,
                        state: null,
                        message: "move color mismatch at move " + i + " (expected toPlay=" + state.toPlay + ")"
                    };
                }
                var fp = fromSgfPoint(m.point, width, height);
                if (fp.error) {
                    return { ok: false, state: null, message: fp.error + " at move " + i };
                }
                if (fp.pass) {
                    var pr = Ru.pass(state);
                    state = pr.state;
                } else {
                    var pl = Ru.play(state, fp.x, fp.y);
                    if (!pl.ok) {
                        return {
                            ok: false,
                            state: null,
                            message: "illegal move at " + i + ": " + pl.message
                        };
                    }
                    state = pl.state;
                }
            }
            return { ok: true, state: state, message: "ok" };
        } catch (e) {
            return {
                ok: false,
                state: null,
                message: String(e && e.message ? e.message : e)
            };
        }
    }

    GoGame.Sgf = {
        ALPHABET: ALPHABET,
        DEFAULT_SIZE: DEFAULT_SIZE,
        /** @deprecated alias of DEFAULT_SIZE (default when size/SZ omitted) */
        SUPPORTED_SIZE: SUPPORTED_SIZE,
        boardDims: boardDims,
        parseSzValue: parseSzValue,
        ttIsPass: ttIsPass,
        toSgfPoint: toSgfPoint,
        fromSgfPoint: fromSgfPoint,
        exportSgf: exportSgf,
        importSgf: importSgf,
        // test helper
        boardsEqual: boardsEqual
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_sgf] GoGame.Sgf ready");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
