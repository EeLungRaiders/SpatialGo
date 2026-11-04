/**
 * 舊參考，已不使用。專頁與 AutoLoad 不載入。
 * GoGame 2D board via ROOT primitives (TLine / TEllipse / TMarker / TText) + JSROOT.
 * Not TH2I (avoids histogram/stats look). Intersections at integer (x,y).
 * Board storage remains board[y][x] via State / Rules (this module only maps x,y).
 *
 * Rectangular boards (22_4/22_7): width×height may differ. Grid unit is 1 on both axes
 * (square cells in user space). Outer frame is square in user coords (letterbox short
 * axis). Screen square cells require a **square JSROOT pad host** (drawLayer letterboxed
 * and centered in the board host) so X/Y are not independently stretched to a non-square
 * viewport (22_7 fix).
 *
 * Edge labels (match GoGame.Sgf.toSgfPoint):
 *   - columns (x): SGF alphabet a–z then A–Z (includes i; not print skip-I)
 *   - rows (y): numbers 1..height with y=0 → 1 (bottom in ROOT y-up)
 *
 * Territory overlay (scoring/finished only): small TBox on empty points from
 * state.scoreResult.territory.points (includePoints). Drawn under stones.
 * Dead stones: state.deadStones [{x,y}] drawn as red TLine X after stones.
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};
    var St = function () { return GoGame.State; };

    // Fallback alphabet if Sgf not loaded (same as GoGame.Sgf.ALPHABET / 18_2).
    var SGF_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    function jr() {
        return global.JSROOT || global.jsroot || null;
    }

    function createObj(typename, props) {
        var J = jr();
        var o = (J && typeof J.create === "function")
            ? J.create(typename)
            : { _typename: typename };
        if (!o) o = { _typename: typename };
        if (props) {
            for (var k in props) {
                if (Object.prototype.hasOwnProperty.call(props, k)) o[k] = props[k];
            }
        }
        if (!o._typename) o._typename = typename;
        return o;
    }

    /**
     * Resolve board dims from state or numeric args.
     * @returns {{ width: number, height: number }}
     */
    function boardDimsFrom(stateOrW, height) {
        if (stateOrW != null && typeof stateOrW === "object") {
            var st = stateOrW;
            if (st.width != null && st.height != null) {
                return { width: st.width, height: st.height };
            }
            var n = st.size != null ? st.size : 19;
            return { width: n, height: n };
        }
        var w = stateOrW != null ? stateOrW : 19;
        var h = height != null ? height : w;
        return { width: w, height: h };
    }

    /**
     * Frame geometry in ROOT user coords for width×height.
     * Intersections at 0..width-1 and 0..height-1 with unit spacing 1 (square cells).
     * Outer frame is square in user space (letterbox the short axis) so both axes
     * share the same user span. Combined with a square pad host (mount layout),
     * screen cell width equals cell height.
     *
     * frameGeometry(N) or frameGeometry(N, N) remains valid (square).
     * Legacy fields frameLo/frameHi/boardLo/boardHi mirror the X range (equal to Y when square).
     */
    function frameGeometry(width, height) {
        if (height == null) height = width;
        var w = width;
        var h = height;
        if (typeof w !== "number" || !isFinite(w) || w < 1) w = 19;
        if (typeof h !== "number" || !isFinite(h) || h < 1) h = 19;
        var ref = Math.max(w, h);
        // Extra margin for double-digit row labels on large boards.
        var labelMargin = ref >= 30 ? 1.20 : (ref >= 20 ? 1.05 : 0.95);
        var labelInset = ref >= 30 ? 0.48 : 0.32;

        var contentW = (w - 1) + 2 * labelMargin;
        var contentH = (h - 1) + 2 * labelMargin;
        var side = Math.max(contentW, contentH);
        var extraX = (side - contentW) / 2;
        var extraY = (side - contentH) / 2;

        var frameLoX = -labelMargin - extraX;
        var frameHiX = (w - 1) + labelMargin + extraX;
        var frameLoY = -labelMargin - extraY;
        var frameHiY = (h - 1) + labelMargin + extraY;
        var boardLoX = -0.5;
        var boardHiX = w - 0.5;
        var boardLoY = -0.5;
        var boardHiY = h - 0.5;

        return {
            width: w,
            height: h,
            labelMargin: labelMargin,
            labelInset: labelInset,
            frameLoX: frameLoX,
            frameHiX: frameHiX,
            frameLoY: frameLoY,
            frameHiY: frameHiY,
            boardLoX: boardLoX,
            boardHiX: boardHiX,
            boardLoY: boardLoY,
            boardHiY: boardHiY,
            frameSide: side,
            // Legacy aliases (X range; equals Y when square)
            frameLo: frameLoX,
            frameHi: frameHiX,
            boardLo: boardLoX,
            boardHi: boardHiX
        };
    }

    /**
     * Densify one axis for hoshi (length n). Returns sorted marks in [0, n-1].
     */
    function densifyAxisMarks(n) {
        if (typeof n !== "number" || !isFinite(n) || n < 5) return [];
        var o = n < 13 ? 2 : 3;
        var last = n - 1;
        var hi = last - o;
        var mid = (n - 1) / 2;
        if (hi < o - 1e-9) return [];

        var marks = [];
        function nearExisting(v, minDist) {
            var j;
            for (j = 0; j < marks.length; j++) {
                if (Math.abs(marks[j] - v) < minDist) return true;
            }
            return false;
        }
        function tryAdd(v) {
            if (typeof v !== "number" || !isFinite(v)) return false;
            if (v < o - 1e-9 || v > hi + 1e-9) return false;
            if (Math.abs(v - o) <= 1 + 1e-9 && Math.abs(v - o) > 1e-9) return false;
            if (Math.abs(v - hi) <= 1 + 1e-9 && Math.abs(v - hi) > 1e-9) return false;
            if (nearExisting(v, 0.51)) return false;
            marks.push(v);
            return true;
        }

        tryAdd(o);
        tryAdd(hi);
        tryAdd(mid);

        // N < 15: no further densify (seed only) — used for product on large other axis
        if (n < 15) {
            marks.sort(function (x, y) { return x - y; });
            return marks;
        }

        var guard = 0;
        var i, a, b, m, inserted;
        while (guard++ < 64) {
            marks.sort(function (x, y) { return x - y; });
            inserted = false;
            for (i = 0; i < marks.length - 1; i++) {
                a = marks[i];
                b = marks[i + 1];
                if (b - a < 8 - 1e-12) continue;
                m = (a + b) / 2;
                if (tryAdd(m)) {
                    inserted = true;
                    break;
                }
                m = Math.round(m * 2) / 2;
                if (m > a + 1e-9 && m < b - 1e-9 && tryAdd(m)) {
                    inserted = true;
                    break;
                }
            }
            if (!inserted) break;
        }
        marks.sort(function (x, y) { return x - y; });
        return marks;
    }

    /**
     * Visual star points (hoshi) for width×height. Does not affect rules/play.
     * hoshiPoints(N) → square N×N (Board3D / legacy).
     * hoshiPoints(W, H) → densify each axis then Cartesian product.
     * min(W,H) < 5 → [] (no crash).
     * Square N < 15 → classic five-star (corners + center), not full 3×3.
     */
    function hoshiPoints(width, height) {
        if (height == null) height = width;
        if (typeof width !== "number" || !isFinite(width)) return [];
        if (typeof height !== "number" || !isFinite(height)) return [];
        if (width < 5 || height < 5) return [];

        var pts = [];
        function add(x, y) {
            if (typeof x !== "number" || typeof y !== "number") return;
            if (x < -1e-9 || y < -1e-9 || x > width - 1 + 1e-9 || y > height - 1 + 1e-9) return;
            var i;
            for (i = 0; i < pts.length; i++) {
                if (Math.abs(pts[i][0] - x) < 1e-6 && Math.abs(pts[i][1] - y) < 1e-6) {
                    return;
                }
            }
            pts.push([x, y]);
        }

        // Classic small square boards: five-star only
        if (width === height && width < 15) {
            var n = width;
            var o = n < 13 ? 2 : 3;
            var last = n - 1;
            var hi = last - o;
            var mid = (n - 1) / 2;
            add(o, o);
            add(o, hi);
            add(hi, o);
            add(hi, hi);
            if (n >= 7) add(mid, mid);
            return pts;
        }

        var marksX = densifyAxisMarks(width);
        var marksY = densifyAxisMarks(height);
        var ai, bi;
        for (ai = 0; ai < marksX.length; ai++) {
            for (bi = 0; bi < marksY.length; bi++) {
                add(marksX[ai], marksY[bi]);
            }
        }

        // Distance filter (no pair closer than 0.51)
        var filtered = [];
        var i, j, ok, dx, dy, dist;
        for (i = 0; i < pts.length; i++) {
            ok = true;
            for (j = 0; j < filtered.length; j++) {
                dx = pts[i][0] - filtered[j][0];
                dy = pts[i][1] - filtered[j][1];
                dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1e-9 && dist < 0.51) {
                    ok = false;
                    break;
                }
            }
            if (ok) filtered.push(pts[i]);
        }
        return filtered;
    }

    /**
     * Column letter for internal x — must match GoGame.Sgf.toSgfPoint first char.
     * Project SGF alphabet is a–z then A–Z INCLUDING 'i' (FF[4]), NOT the
     * print convention that skips I (A–T).
     */
    function colLetter(x, width, height) {
        if (height == null) height = width;
        if (GoGame.Sgf && typeof GoGame.Sgf.toSgfPoint === "function") {
            var p = GoGame.Sgf.toSgfPoint(x, 0, width, height);
            if (p && p.length >= 1) return p.charAt(0);
        }
        if (x < 0 || x >= width || x >= SGF_ALPHABET.length) return "?";
        return SGF_ALPHABET.charAt(x);
    }

    /**
     * Row number for internal y: y=0 → "1", y=height-1 → String(height).
     * ROOT draws y upward, so "1" is at the bottom edge; SGF second letter
     * for y=0 is still 'a' (same index mapping as toSgfPoint).
     */
    function rowNumber(y, height) {
        if (y < 0 || y >= height) return "?";
        return String(y + 1);
    }

    /** Label text size; denser boards (by max dim) use smaller type. */
    function labelTextSize(ref) {
        if (ref <= 9) return 0.030;
        if (ref <= 13) return 0.026;
        if (ref <= 19) return 0.022;
        if (ref <= 30) return 0.015;
        return 0.011; // 31..50
    }

    /** Hoshi marker size (ROOT marker size units); ref = max(width,height). */
    function hoshiMarkerSize(ref) {
        if (ref <= 9) return 0.60;
        if (ref <= 13) return 0.55;
        if (ref <= 19) return 0.50;
        if (ref <= 30) return 0.38;
        return 0.28;
    }

    function makeLabel(x, y, text, textSize) {
        // TText: fTitle holds string (TNamed); outside grid so clicks miss stones.
        return createObj("TText", {
            fX: x,
            fY: y,
            fTitle: String(text),
            fTextSize: textSize != null ? textSize : 0.026,
            fTextAlign: 22,
            fTextColor: 1,
            fTextFont: 42
        });
    }

    /**
     * Resolve territory point lists for overlay.
     * Only when phase is scoring|finished and points exist on scoreResult.
     */
    function territoryPointsForOverlay(state) {
        if (!state) return null;
        if (state.phase !== "scoring" && state.phase !== "finished") return null;
        var terr = state.scoreResult && state.scoreResult.territory;
        if (!terr || !terr.points) return null;
        return terr.points;
    }

    /**
     * Territory overlay colors (ROOT color indices on yellow wood fFillColor=5).
     * Chosen for contrast (not the previous teal/peach/green-ish 38/41/30):
     *   black land → kBlack (1), solid, slightly inset so grid peeks
     *   white land → kWhite (10) with black outline (reads as light on wood)
     *   dame       → soft gray (17), lighter / more neutral
     * Overlay is only on empty points and drawn under stone ellipses.
     */
    var TERR_OVERLAY = {
        half: 0.28,
        black: { fill: 1, line: 1, style: 1001 },
        white: { fill: 10, line: 1, style: 1001 },
        dame: { fill: 17, line: 17, style: 1001 }
    };

    /**
     * Small filled boxes on empty intersections (under stones in draw order).
     * half scales slightly on dense boards so boxes do not swallow the grid.
     */
    function appendTerritoryOverlay(list, points, size) {
        if (!points) return;
        var half = TERR_OVERLAY.half;
        if (size != null && size > 25) half = 0.22;
        if (size != null && size > 35) half = 0.18;
        function addBoxes(arr, cfg) {
            if (!arr || !arr.length || !cfg) return;
            var i;
            for (i = 0; i < arr.length; i++) {
                var p = arr[i];
                if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
                list.push(createObj("TBox", {
                    fX1: p.x - half,
                    fY1: p.y - half,
                    fX2: p.x + half,
                    fY2: p.y + half,
                    fFillColor: cfg.fill,
                    fFillStyle: cfg.style != null ? cfg.style : 1001,
                    fLineColor: cfg.line != null ? cfg.line : cfg.fill,
                    fLineWidth: 1
                }));
            }
        }
        // dame first, then white, then black (darker last among overlays)
        addBoxes(points.neutral, TERR_OVERLAY.dame);
        addBoxes(points.white, TERR_OVERLAY.white);
        addBoxes(points.black, TERR_OVERLAY.black);
    }

    /**
     * Draw red X on dead stones (ROOT TLine cross). Drawn after stone ellipses.
     */
    function appendDeadMarks(list, state, size) {
        if (!state || !state.deadStones || !state.deadStones.length) return;
        var d = 0.30;
        if (size != null && size > 25) d = 0.24;
        if (size != null && size > 35) d = 0.20;
        var i;
        for (i = 0; i < state.deadStones.length; i++) {
            var p = state.deadStones[i];
            if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
            // Two diagonals — bright red (ROOT color 2) for contrast on black/white stones
            list.push(createObj("TLine", {
                fX1: p.x - d, fY1: p.y - d, fX2: p.x + d, fY2: p.y + d,
                fLineColor: 2, fLineWidth: size != null && size > 30 ? 2 : 3
            }));
            list.push(createObj("TLine", {
                fX1: p.x - d, fY1: p.y + d, fX2: p.x + d, fY2: p.y - d,
                fLineColor: 2, fLineWidth: size != null && size > 30 ? 2 : 3
            }));
        }
    }

    /**
     * buildPrimitives(width, height, state, opts)
     * Also accepts legacy buildPrimitives(size, state, opts) when 2nd arg is state object.
     */
    function buildPrimitives(width, height, state, opts) {
        if (height != null && typeof height === "object") {
            opts = state;
            state = height;
            height = width;
        }
        opts = opts || {};
        var dragPreview = opts.dragPreview || null;
        var w = width;
        var h = height;
        if (typeof w !== "number" || !isFinite(w)) w = 19;
        if (typeof h !== "number" || !isFinite(h)) h = 19;
        var ref = Math.max(w, h);

        var S = St();
        var list = [];
        var geo = frameGeometry(w, h);

        // Outer frame (square in user space; includes label + letterbox) — wood color
        list.push(createObj("TBox", {
            fX1: geo.frameLoX, fY1: geo.frameLoY, fX2: geo.frameHiX, fY2: geo.frameHiY,
            fFillColor: 5,
            fFillStyle: 1001,
            fLineColor: 1,
            fLineWidth: 1
        }));

        // Inner board edge (actual grid bounding box; may be rectangular)
        list.push(createObj("TBox", {
            fX1: geo.boardLoX, fY1: geo.boardLoY, fX2: geo.boardHiX, fY2: geo.boardHiY,
            fFillColor: 5,
            fFillStyle: 1001,
            fLineColor: 12,
            fLineWidth: 1
        }));

        var i;
        // Horizontal lines: height rows at y=0..h-1, span x=0..w-1
        for (i = 0; i < h; i++) {
            list.push(createObj("TLine", {
                fX1: 0, fY1: i, fX2: w - 1, fY2: i,
                fLineColor: 1, fLineWidth: 1
            }));
        }
        // Vertical lines: width cols at x=0..w-1, span y=0..h-1
        for (i = 0; i < w; i++) {
            list.push(createObj("TLine", {
                fX1: i, fY1: 0, fX2: i, fY2: h - 1,
                fLineColor: 1, fLineWidth: 1
            }));
        }

        var hs = hoshiPoints(w, h);
        var hms = hoshiMarkerSize(ref);
        for (i = 0; i < hs.length; i++) {
            list.push(createObj("TMarker", {
                fX: hs[i][0], fY: hs[i][1],
                fMarkerStyle: 20,
                fMarkerSize: hms,
                fMarkerColor: 1
            }));
        }

        // Coordinate labels (outside intersections; do not block play)
        var tsize = labelTextSize(ref);
        var yBot = geo.frameLoY + geo.labelInset;
        var yTop = geo.frameHiY - geo.labelInset;
        var xLeft = geo.frameLoX + geo.labelInset;
        var xRight = geo.frameHiX - geo.labelInset;
        for (i = 0; i < w; i++) {
            var cl = colLetter(i, w, h);
            list.push(makeLabel(i, yBot, cl, tsize));
            list.push(makeLabel(i, yTop, cl, tsize));
        }
        for (i = 0; i < h; i++) {
            var rn = rowNumber(i, h);
            list.push(makeLabel(xLeft, i, rn, tsize));
            list.push(makeLabel(xRight, i, rn, tsize));
        }

        // Territory overlay under stones (empty points only from scoring)
        appendTerritoryOverlay(list, territoryPointsForOverlay(state), ref);

        // Stone radius in intersection units (grid spacing = 1).
        var r = 0.42;
        if (ref > 25) r = 0.40;
        if (ref > 35) r = 0.38;
        if (state && state.board) {
            for (var y = 0; y < h; y++) {
                for (var x = 0; x < w; x++) {
                    var v = state.board[y] ? state.board[y][x] : null;
                    if (v === S.BLACK) {
                        list.push(createObj("TEllipse", {
                            fX1: x, fY1: y, fR1: r, fR2: r,
                            fPhimin: 0, fPhimax: 360, fTheta: 0,
                            fFillColor: 1, fFillStyle: 1001,
                            fLineColor: 1, fLineWidth: 1
                        }));
                    } else if (v === S.WHITE) {
                        list.push(createObj("TEllipse", {
                            fX1: x, fY1: y, fR1: r, fR2: r,
                            fPhimin: 0, fPhimax: 360, fTheta: 0,
                            fFillColor: 0, fFillStyle: 1001,
                            fLineColor: 1, fLineWidth: 1
                        }));
                    }
                }
            }
        }

        // Dead-stone X marks on top of stones
        appendDeadMarks(list, state, ref);

        // Hand-drag place preview
        if (dragPreview &&
            typeof dragPreview.x === "number" && typeof dragPreview.y === "number" &&
            dragPreview.x >= 0 && dragPreview.y >= 0 &&
            dragPreview.x < w && dragPreview.y < h) {
            var pr = 0.42;
            if (ref > 25) pr = 0.40;
            if (ref > 35) pr = 0.38;
            var isWhitePrev = state && state.toPlay === S.WHITE;
            list.push(createObj("TEllipse", {
                fX1: dragPreview.x,
                fY1: dragPreview.y,
                fR1: pr,
                fR2: pr,
                fPhimin: 0,
                fPhimax: 360,
                fTheta: 0,
                fFillColor: isWhitePrev ? 0 : 1,
                fFillStyle: 0,
                fLineColor: 1,
                fLineWidth: 2,
                fLineStyle: 2
            }));
        }

        return list;
    }

    function mount(dom, opts) {
        opts = opts || {};
        var onPlay = opts.onPlayRequest || function () {};
        var width = opts.width;
        var height = opts.height;
        if (opts.state) {
            if (opts.state.width != null) width = opts.state.width;
            if (opts.state.height != null) height = opts.state.height;
        }
        if (width == null && opts.size != null) width = opts.size;
        if (height == null && opts.size != null) height = opts.size;
        if (width == null) width = 19;
        if (height == null) height = 19;
        // size = max dim for scale helpers / legacy; square keeps size === width
        var size = Math.max(width, height);
        var J = jr();
        if (!J || typeof J.draw !== "function") {
            throw new Error("board2d: JSROOT.draw missing");
        }

        // ---- Lock ROOT primitives: grid/labels/stones must not be user-draggable ----
        // JSROOT TLine/TBox/TText painters call addMoveHandler unless MoveResize is off
        // or pad.fEditable is false (see JSROOT gui/utils addMoveHandler).
        var jsrootSettings = (J && J.settings) || (global.JSROOT && global.JSROOT.settings) || null;
        var prevMoveResize = null;
        if (jsrootSettings && typeof jsrootSettings.MoveResize === "boolean") {
            prevMoveResize = jsrootSettings.MoveResize;
            jsrootSettings.MoveResize = false;
        }

        var painter = null;
        var drawLayer = null;
        var hudEl = null;
        var drawChain = Promise.resolve();
        var destroyed = false;
        var lastState = opts.state || null;
        /** Square pad letterbox inside host: { left, top, side, cw, ch }. */
        var squareLayout = { left: 0, top: 0, side: 0, cw: 0, ch: 0 };
        var resizeObserver = null;
        var resizeRedrawTimer = null;
        /** Hand-drag ghost at board intersection; drawn as ROOT TEllipse (not cursor DOM). */
        var dragPreviewPt = null; // {x,y} | null
        var previewRedrawScheduled = false;

        // ---- View (pan / zoom). Content is drawn unscaled; CSS transform pans/zooms. ----
        var ZOOM_MIN = 1;
        var ZOOM_MAX = 8;
        var ZOOM_STEP = 1.2;
        var zoom = 1;
        var panX = 0;
        var panY = 0;
        var panDrag = null; // { x0, y0, panX0, panY0, moved }
        var PAN_THRESH_PX = 5;

        function clampZoom(z) {
            if (z < ZOOM_MIN) return ZOOM_MIN;
            if (z > ZOOM_MAX) return ZOOM_MAX;
            return z;
        }

        function applyViewTransform() {
            if (!drawLayer) return;
            drawLayer.style.transformOrigin = "0 0";
            drawLayer.style.transform =
                "translate(" + panX + "px," + panY + "px) scale(" + zoom + ")";
            if (hudEl) {
                var lab = hudEl.querySelector("[data-go-2d-zoom-label]");
                if (lab) lab.textContent = Math.round(zoom * 100) + "%";
            }
        }

        function resetView() {
            zoom = 1;
            panX = 0;
            panY = 0;
            applyViewTransform();
            return Promise.resolve(true);
        }

        /**
         * Zoom keeping viewport point (vx,vy) fixed (relative to board host).
         * CSS: translate(pan) scale(zoom) with origin 0,0 →
         *   viewport = layout * zoom + pan
         */
        /**
         * Host-relative (vx,vy) → layout coords inside square drawLayer (pre-pan/zoom).
         * drawLayer is letterboxed; pan/zoom transform is relative to its top-left.
         */
        function hostToDrawLayout(vx, vy) {
            return {
                lx: (vx - squareLayout.left - panX) / zoom,
                ly: (vy - squareLayout.top - panY) / zoom
            };
        }

        function zoomAt(factor, vx, vy) {
            var nz = clampZoom(zoom * factor);
            if (nz === zoom) return;
            // Keep host point fixed under pan/zoom of the letterboxed square layer
            var lay = hostToDrawLayout(vx, vy);
            zoom = nz;
            panX = vx - squareLayout.left - lay.lx * zoom;
            panY = vy - squareLayout.top - lay.ly * zoom;
            applyViewTransform();
        }

        function zoomBy(factor) {
            // Zoom about center of square pad (not full host, which may be rectangular)
            var cx = squareLayout.left + (squareLayout.side || (dom.clientWidth || 1)) / 2;
            var cy = squareLayout.top + (squareLayout.side || (dom.clientHeight || 1)) / 2;
            zoomAt(factor, cx, cy);
        }

        function panBy(dx, dy) {
            panX += dx;
            panY += dy;
            applyViewTransform();
        }

        function ensureDomBase() {
            if (!dom) return;
            if (dom.style) {
                if (!dom.style.position || dom.style.position === "static") {
                    dom.style.position = "relative";
                }
                dom.style.overflow = "hidden";
                // Letterbox gutters (host may be wider/taller than square pad)
                if (!dom.style.background || dom.style.background === "transparent") {
                    dom.style.background = "#d0d0d0";
                }
            }
        }

        /**
         * Size/center drawLayer as a square inside the (possibly rectangular) host.
         * JSROOT maps the square user frame into this square pad → equal cellPx on screen.
         * Returns layout { left, top, side, cw, ch }.
         */
        function layoutSquareDrawLayer() {
            if (!dom || !drawLayer) return squareLayout;
            var cw = dom.clientWidth || 0;
            var ch = dom.clientHeight || 0;
            if (cw < 2) cw = 2;
            if (ch < 2) ch = 2;
            var side = Math.min(cw, ch);
            var left = Math.floor((cw - side) / 2);
            var top = Math.floor((ch - side) / 2);
            squareLayout = { left: left, top: top, side: side, cw: cw, ch: ch };
            drawLayer.style.position = "absolute";
            drawLayer.style.left = left + "px";
            drawLayer.style.top = top + "px";
            drawLayer.style.width = side + "px";
            drawLayer.style.height = side + "px";
            drawLayer.style.right = "auto";
            drawLayer.style.bottom = "auto";
            drawLayer.style.boxSizing = "border-box";
            // Subtle edge so letterbox is visible against host
            drawLayer.style.background = "transparent";
            return squareLayout;
        }

        function ensureDrawLayer() {
            ensureDomBase();
            if (drawLayer && drawLayer.parentNode === dom) {
                layoutSquareDrawLayer();
                return drawLayer;
            }
            drawLayer = document.createElement("div");
            drawLayer.setAttribute("data-go-2d-draw", "1");
            drawLayer.setAttribute("data-go-2d-square-pad", "1");
            drawLayer.style.cssText =
                "position:absolute;transform-origin:0 0;will-change:transform;" +
                "overflow:hidden;";
            // Insert under HUD
            if (dom.firstChild) dom.insertBefore(drawLayer, dom.firstChild);
            else dom.appendChild(drawLayer);
            layoutSquareDrawLayer();
            applyViewTransform();
            return drawLayer;
        }

        function attachResizeObserver() {
            if (resizeObserver || !dom || typeof ResizeObserver === "undefined") return;
            resizeObserver = new ResizeObserver(function () {
                if (destroyed) return;
                var prev = squareLayout.side;
                layoutSquareDrawLayer();
                // Redraw when pad pixel size changes so JSROOT/SVG matches square host
                if (Math.abs((squareLayout.side || 0) - (prev || 0)) >= 1 && lastState) {
                    if (resizeRedrawTimer) {
                        try { clearTimeout(resizeRedrawTimer); } catch (eT) { /* */ }
                    }
                    resizeRedrawTimer = setTimeout(function () {
                        resizeRedrawTimer = null;
                        if (destroyed || !lastState) return;
                        drawChain = drawAll(lastState);
                    }, 80);
                }
            });
            try {
                resizeObserver.observe(dom);
            } catch (eRo) {
                resizeObserver = null;
            }
        }

        function ensureHud() {
            if (hudEl && hudEl.parentNode === dom) return hudEl;
            hudEl = document.createElement("div");
            hudEl.setAttribute("data-go-2d-hud", "1");
            hudEl.style.cssText =
                "position:absolute;right:6px;bottom:6px;z-index:20;" +
                "display:flex;flex-direction:column;gap:4px;align-items:flex-end;" +
                "pointer-events:none;user-select:none;";

            function mkRow() {
                var r = document.createElement("div");
                r.style.cssText = "display:flex;gap:3px;pointer-events:auto;";
                return r;
            }
            function mkBtn(label, title) {
                var b = document.createElement("button");
                b.type = "button";
                b.textContent = label;
                b.title = title || label;
                b.style.cssText =
                    "min-width:28px;height:26px;padding:0 6px;font-size:13px;" +
                    "cursor:pointer;pointer-events:auto;" +
                    "background:rgba(255,255,255,0.92);border:1px solid #888;" +
                    "border-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.12);";
                return b;
            }

            var rowZoom = mkRow();
            var btnIn = mkBtn("+", "Zoom in (wheel)");
            var btnOut = mkBtn("−", "Zoom out (wheel)");
            var zoomLabel = document.createElement("span");
            zoomLabel.setAttribute("data-go-2d-zoom-label", "1");
            zoomLabel.style.cssText =
                "min-width:3.2em;text-align:center;font-size:11px;line-height:26px;" +
                "color:#333;background:rgba(255,255,255,0.85);border-radius:3px;padding:0 4px;";
            zoomLabel.textContent = "100%";
            var btnReset = mkBtn("⟲", "Reset view (full board)");
            btnIn.onclick = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                zoomBy(ZOOM_STEP);
            };
            btnOut.onclick = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                zoomBy(1 / ZOOM_STEP);
            };
            btnReset.onclick = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                resetView();
            };
            rowZoom.appendChild(btnOut);
            rowZoom.appendChild(zoomLabel);
            rowZoom.appendChild(btnIn);
            rowZoom.appendChild(btnReset);

            var rowPan = mkRow();
            var panN = 48;
            var btnU = mkBtn("↑", "Pan up");
            var btnL = mkBtn("←", "Pan left");
            var btnR = mkBtn("→", "Pan right");
            var btnD = mkBtn("↓", "Pan down");
            btnU.onclick = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                panBy(0, panN);
            };
            btnD.onclick = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                panBy(0, -panN);
            };
            btnL.onclick = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                panBy(panN, 0);
            };
            btnR.onclick = function (ev) {
                if (ev) { ev.preventDefault(); ev.stopPropagation(); }
                panBy(-panN, 0);
            };
            rowPan.appendChild(btnL);
            rowPan.appendChild(btnU);
            rowPan.appendChild(btnD);
            rowPan.appendChild(btnR);

            var hint = document.createElement("div");
            hint.style.cssText =
                "font-size:10px;color:#444;background:rgba(255,255,255,0.8);" +
                "padding:2px 5px;border-radius:3px;pointer-events:none;max-width:14em;text-align:right;";
            hint.textContent = "Wheel zoom · Shift-drag pan · Hand drag place";

            hudEl.appendChild(rowZoom);
            hudEl.appendChild(rowPan);
            hudEl.appendChild(hint);
            dom.appendChild(hudEl);
            applyViewTransform();
            return hudEl;
        }

        function clearDrawOnly() {
            if (drawLayer) {
                while (drawLayer.firstChild) drawLayer.removeChild(drawLayer.firstChild);
            }
            painter = null;
            // dragPreviewPt is logical state; re-included via buildPrimitives on next draw
        }

        function clearDom() {
            // Full wipe (destroy path)
            detachInput();
            dragPreviewPt = null;
            if (resizeObserver) {
                try { resizeObserver.disconnect(); } catch (eD) { /* */ }
                resizeObserver = null;
            }
            if (resizeRedrawTimer) {
                try { clearTimeout(resizeRedrawTimer); } catch (eT2) { /* */ }
                resizeRedrawTimer = null;
            }
            while (dom && dom.firstChild) dom.removeChild(dom.firstChild);
            painter = null;
            drawLayer = null;
            hudEl = null;
        }

        // ---- Hit map (drag release / click) — align with ROOT-drawn grid ----
        // Root cause of corner center-pull (19_4_0/19_4_4):
        //   1) Linear pad m=0.06 underestimates JSROOT frame insets (~0.1 + labels)
        //   2) Host-layout px + unvalidated revertAxis can mix pad vs host space
        // Fix chain (no hover preview — 19_4_3 UX kept):
        //   client → pad-local (SVG/canvas rect, CSS pan/zoom aware)
        //        → user via painter grx/revert IFF corner round-trip OK
        //        → else linear frameGeometry + pad f*Margin (default 0.1)
        //        → board Math.round
        var DEBUG_HIT = false; // GoGame.Board2D.DEBUG_HIT = true
        var mapKind = "linear"; // 'painter' | 'linear' after calibrateMap

        /**
         * Host-relative layout for pan/zoom only (inverse of CSS on drawLayer).
         * Do NOT use this alone for hit — prefer clientToPadLocal.
         */
        function pointerLayoutXYFromClient(clientX, clientY) {
            var vrect = dom.getBoundingClientRect();
            var vx = clientX - vrect.left;
            var vy = clientY - vrect.top;
            var vw = dom.clientWidth || vrect.width;
            var vh = dom.clientHeight || vrect.height;
            return {
                lx: (vx - panX) / zoom,
                ly: (vy - panY) / zoom,
                vx: vx,
                vy: vy,
                vw: vw,
                vh: vh
            };
        }

        function pointerLayoutXY(ev) {
            return pointerLayoutXYFromClient(ev.clientX, ev.clientY);
        }

        function getPadElement() {
            if (!drawLayer) return null;
            return drawLayer.querySelector("svg") ||
                drawLayer.querySelector("canvas") ||
                drawLayer.firstElementChild ||
                drawLayer;
        }

        function getFramePainter() {
            try {
                return painter && painter.getFramePainter && painter.getFramePainter();
            } catch (eFp) {
                return null;
            }
        }

        /**
         * Client → pad-local pixels (unscaled).
         * Uses pad getBoundingClientRect so CSS pan/zoom on drawLayer is handled
         * by the browser (no double-apply of pan/zoom).
         */
        function clientToPadLocal(clientX, clientY) {
            var pad = getPadElement();
            if (pad) {
                var r = pad.getBoundingClientRect();
                var lw = pad.clientWidth;
                var lh = pad.clientHeight;
                if (!(lw > 1)) lw = r.width / Math.max(zoom, 1e-6);
                if (!(lh > 1)) lh = r.height / Math.max(zoom, 1e-6);
                var lx = r.width > 1e-6 ? (clientX - r.left) * (lw / r.width) : 0;
                var ly = r.height > 1e-6 ? (clientY - r.top) * (lh / r.height) : 0;
                return { lx: lx, ly: ly, vw: lw, vh: lh, via: "pad" };
            }
            // Fallback: host + explicit inverse of our CSS transform
            var hr = dom.getBoundingClientRect();
            var vx = clientX - hr.left;
            var vy = clientY - hr.top;
            var vw = dom.clientWidth || hr.width;
            var vh = dom.clientHeight || hr.height;
            return {
                lx: (vx - panX) / zoom,
                ly: (vy - panY) / zoom,
                vw: vw,
                vh: vh,
                via: "host"
            };
        }

        /**
         * Pad margins in NDC (0–1). Prefer live TPad; else ROOT-ish 0.1.
         * Old hard-coded m=0.06 was too tight → systematic pull toward center.
         */
        function padMarginsNdc() {
            var ml = 0.1, mr = 0.1, mb = 0.1, mt = 0.1;
            try {
                var pp = null;
                if (painter) {
                    if (typeof painter.getPadPainter === "function") pp = painter.getPadPainter();
                    else if (painter.pad_painter) pp = painter.pad_painter;
                    else if (painter.main) pp = painter.main;
                }
                var pad = null;
                if (pp) {
                    pad = pp.pad || (pp.pad_painter && pp.pad_painter.pad) || null;
                }
                if (pad) {
                    if (typeof pad.fLeftMargin === "number") ml = pad.fLeftMargin;
                    if (typeof pad.fRightMargin === "number") mr = pad.fRightMargin;
                    if (typeof pad.fBottomMargin === "number") mb = pad.fBottomMargin;
                    if (typeof pad.fTopMargin === "number") mt = pad.fTopMargin;
                }
            } catch (eM) { /* defaults */ }
            if (ml < 0.02) ml = 0.02;
            if (mr < 0.02) mr = 0.02;
            if (mb < 0.02) mb = 0.02;
            if (mt < 0.02) mt = 0.02;
            if (ml + mr > 0.5) { ml = 0.1; mr = 0.1; }
            if (mb + mt > 0.5) { mb = 0.1; mt = 0.1; }
            return { ml: ml, mr: mr, mb: mb, mt: mt };
        }

        /** Painter axes only if grx/revert invert at all four board corners. */
        function painterMapOk(fp) {
            if (!fp || typeof fp.revertAxis !== "function") return false;
            if (typeof fp.grx !== "function" || typeof fp.gry !== "function") return false;
            try {
                var samples = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
                var s, px, py, ux, uy;
                for (s = 0; s < samples.length; s++) {
                    px = fp.grx(samples[s][0]);
                    py = fp.gry(samples[s][1]);
                    if (px == null || py == null || !isFinite(px) || !isFinite(py)) return false;
                    ux = fp.revertAxis("x", px);
                    uy = fp.revertAxis("y", py);
                    if (ux == null || uy == null || !isFinite(ux) || !isFinite(uy)) return false;
                    if (Math.abs(ux - samples[s][0]) > 0.35) return false;
                    if (Math.abs(uy - samples[s][1]) > 0.35) return false;
                }
                return true;
            } catch (eOk) {
                return false;
            }
        }

        function calibrateMap() {
            var fp = getFramePainter();
            mapKind = painterMapOk(fp) ? "painter" : "linear";
            if (DEBUG_HIT || (GoGame.Board2D && GoGame.Board2D.DEBUG_HIT)) {
                var mg = padMarginsNdc();
                console.log("[board2d] map calibrate:", mapKind, "dims=", width + "x" + height, "margins=", mg);
            }
        }

        /**
         * Pad-local → ROOT user (y-up). Drawn outer TBox is [frameLo, frameHi].
         */
        function padLocalToUser(lx, ly, vw, vh) {
            var fp = getFramePainter();
            if (mapKind === "painter" && painterMapOk(fp)) {
                return {
                    ux: fp.revertAxis("x", lx),
                    uy: fp.revertAxis("y", ly)
                };
            }
            var geo = frameGeometry(width, height);
            var mg = padMarginsNdc();
            var uNdc = lx / vw;
            var vNdc = ly / vh; // top → bottom
            var spanX = 1 - mg.ml - mg.mr;
            var spanY = 1 - mg.mt - mg.mb;
            if (spanX < 1e-6) spanX = 1;
            if (spanY < 1e-6) spanY = 1;
            var fx = (uNdc - mg.ml) / spanX;
            var fyTop = (vNdc - mg.mt) / spanY;
            // Square outer frame + square pad host → equal user→pixel scale on X/Y
            return {
                ux: geo.frameLoX + fx * (geo.frameHiX - geo.frameLoX),
                uy: geo.frameHiY - fyTop * (geo.frameHiY - geo.frameLoY)
            };
        }

        /**
         * Pad-local → board intersection. Shared by click and Hand pointerup.
         */
        function padLocalToBoard(lx, ly, vw, vh) {
            if (vw < 2 || vh < 2) return null;
            var user = padLocalToUser(lx, ly, vw, vh);
            if (user.ux == null || user.uy == null || !isFinite(user.ux) || !isFinite(user.uy)) {
                return null;
            }
            var x = Math.round(user.ux);
            var y = Math.round(user.uy);
            if (x < 0 || y < 0 || x >= width || y >= height) return null;
            return { x: x, y: y, ux: user.ux, uy: user.uy };
        }

        function clientToXY(clientX, clientY) {
            if (!dom) return null;
            var p = clientToPadLocal(clientX, clientY);
            var b = padLocalToBoard(p.lx, p.ly, p.vw, p.vh);
            if (DEBUG_HIT || (GoGame.Board2D && GoGame.Board2D.DEBUG_HIT)) {
                console.log("[board2d] hit", {
                    via: p.via,
                    map: mapKind,
                    pad: { lx: p.lx, ly: p.ly, vw: p.vw, vh: p.vh },
                    user: b ? { ux: b.ux, uy: b.uy } : null,
                    board: b ? { x: b.x, y: b.y } : null
                });
            }
            return b ? { x: b.x, y: b.y } : null;
        }

        function eventToXY(ev) {
            if (!ev) return null;
            return clientToXY(ev.clientX, ev.clientY);
        }

        /**
         * Schedule board redraw with current dragPreviewPt (ROOT primitives).
         * Coalesces rapid Hand moves onto drawChain.
         */
        function scheduleDragPreviewRedraw() {
            if (destroyed || previewRedrawScheduled) return;
            previewRedrawScheduled = true;
            drawChain = drawChain.then(function () {
                previewRedrawScheduled = false;
                return drawAll(lastState);
            }).catch(function (err) {
                previewRedrawScheduled = false;
                console.warn("[board2d] drag preview redraw", err);
            });
        }

        /**
         * Set Hand-drag ghost at board (x,y) or clear. Same coords as Message hit.
         * Preview is a TEllipse in user space (buildPrimitives) — pans/zooms with drawLayer.
         */
        function setDragPreviewPt(pt) {
            var next = null;
            if (pt && typeof pt.x === "number" && typeof pt.y === "number") {
                next = { x: pt.x | 0, y: pt.y | 0 };
            }
            if (!next && !dragPreviewPt) return;
            if (next && dragPreviewPt &&
                next.x === dragPreviewPt.x && next.y === dragPreviewPt.y) {
                return;
            }
            dragPreviewPt = next;
            if (DEBUG_HIT || (GoGame.Board2D && GoGame.Board2D.DEBUG_HIT)) {
                console.log("[board2d] drag ROOT preview@intersection", dragPreviewPt);
            }
            scheduleDragPreviewRedraw();
        }

        /**
         * Client → board (x,y). Hand drag drop + live drag preview.
         * opts.preview=true: ROOT TEllipse on hit intersection (not cursor DOM).
         * opts.preview=false/omit: clear ghost.
         * No idle mousemove hover (19_4_3).
         */
        function pickAtClient(clientX, clientY, opts) {
            if (opts === true) opts = { preview: true };
            opts = opts || {};
            var pt = clientToXY(clientX, clientY);
            if (opts.preview) {
                setDragPreviewPt(pt);
            } else {
                setDragPreviewPt(null);
            }
            return pt;
        }

        function onClick(ev) {
            if (destroyed) return;
            if (panDrag && panDrag.moved) return;
            var pt = eventToXY(ev);
            if (!pt) return;
            onPlay(pt.x, pt.y);
        }

        /** Pan drag only — no hover stone preview (Hand drag is primary place UX). */
        function onMove(ev) {
            if (destroyed) return;
            if (!panDrag) return;
            var dx = ev.clientX - panDrag.x0;
            var dy = ev.clientY - panDrag.y0;
            if (Math.abs(dx) > PAN_THRESH_PX || Math.abs(dy) > PAN_THRESH_PX) {
                panDrag.moved = true;
            }
            panX = panDrag.panX0 + dx;
            panY = panDrag.panY0 + dy;
            applyViewTransform();
        }

        function onLeave() {
            panDrag = null;
        }

        function onWheel(ev) {
            if (destroyed || !dom) return;
            ev.preventDefault();
            var p = pointerLayoutXY(ev);
            var factor = ev.deltaY < 0 ? ZOOM_STEP : (1 / ZOOM_STEP);
            zoomAt(factor, p.vx, p.vy);
        }

        function onPointerDown(ev) {
            if (destroyed) return;
            // Shift+left or middle button → pan (never confuses with Hand drag on sidebar)
            var isPan = (ev.button === 1) || (ev.button === 0 && ev.shiftKey);
            if (!isPan) return;
            ev.preventDefault();
            panDrag = {
                x0: ev.clientX,
                y0: ev.clientY,
                panX0: panX,
                panY0: panY,
                moved: false
            };
        }

        function onPointerUp(ev) {
            if (!panDrag) return;
            var moved = panDrag.moved;
            panDrag = null;
            // Suppress click play if this was a pan gesture
            if (moved && ev && ev.preventDefault) {
                /* click handler checks panDrag.moved — already cleared; use flag */
            }
            if (moved) {
                // Mark briefly so click is ignored
                panDrag = { moved: true };
                setTimeout(function () { panDrag = null; }, 0);
            }
        }

        function attachInput() {
            if (!dom || dom._goPrimBound) return;
            dom._goPrimBound = true;
            dom.style.cursor = "crosshair";
            dom.addEventListener("click", onClick);
            dom.addEventListener("mousemove", onMove);
            dom.addEventListener("mouseleave", onLeave);
            dom.addEventListener("wheel", onWheel, { passive: false });
            dom.addEventListener("pointerdown", onPointerDown);
            dom.addEventListener("pointerup", onPointerUp);
            dom.addEventListener("pointercancel", onPointerUp);
        }

        function detachInput() {
            if (!dom || !dom._goPrimBound) return;
            dom.removeEventListener("click", onClick);
            dom.removeEventListener("mousemove", onMove);
            dom.removeEventListener("mouseleave", onLeave);
            dom.removeEventListener("wheel", onWheel);
            dom.removeEventListener("pointerdown", onPointerDown);
            dom.removeEventListener("pointerup", onPointerUp);
            dom.removeEventListener("pointercancel", onPointerUp);
            dom._goPrimBound = false;
            panDrag = null;
        }

        /**
         * Disable interactive move/resize of all drawn ROOT primitives on this pad.
         * Preview TEllipse is also non-draggable (redraw-only ghost). CSS pan/zoom unchanged.
         */
        function lockPadPrimitives() {
            try {
                // Keep global MoveResize off for this mount (also set at mount start).
                if (jsrootSettings) jsrootSettings.MoveResize = false;

                var pp = null;
                if (painter) {
                    if (typeof painter.getPadPainter === "function") {
                        try { pp = painter.getPadPainter(); } catch (e0) { pp = null; }
                    }
                    if (!pp) pp = painter.pad_painter || painter.padPainter || null;
                }
                var pad = null;
                if (pp) {
                    pad = pp.pad || null;
                    if (!pad && typeof pp.getRootPad === "function") {
                        try { pad = pp.getRootPad(); } catch (e1) { pad = null; }
                    }
                }
                if (!pad && painter && painter.pad) pad = painter.pad;
                if (pad) pad.fEditable = false;
                if (pp && typeof pp.setEditable === "function") {
                    try { pp.setEditable(false); } catch (e2) { /* */ }
                }

                // Strip d3 drag already attached while pad was editable (first draws).
                var list = null;
                if (pp) {
                    list = pp.painters || null;
                    if (!list && typeof pp.getPainters === "function") {
                        try { list = pp.getPainters(); } catch (e3) { list = null; }
                    }
                }
                if (list && list.length) {
                    var i, p, g;
                    for (i = 0; i < list.length; i++) {
                        p = list[i];
                        if (!p) continue;
                        p.moveEnabled = function () { return false; };
                        try {
                            g = typeof p.getG === "function" ? p.getG() : null;
                            if (g && typeof g.on === "function") {
                                // d3 v6+: remove drag listeners
                                try { g.on(".drag", null); } catch (eD) { /* */ }
                                try { g.on("mousedown.drag", null); } catch (eD2) { /* */ }
                                try { g.on("touchstart.drag", null); } catch (eD3) { /* */ }
                                if (typeof g.style === "function") g.style("cursor", "default");
                                if (typeof g.property === "function") g.property("assigned_move", null);
                            }
                        } catch (eG) { /* */ }
                    }
                }

                // Belt: SVG under drawLayer should not show move cursor on primitives
                if (drawLayer) {
                    var svgs = drawLayer.querySelectorAll("svg g, svg path, svg text, svg rect, svg circle, svg ellipse");
                    var j;
                    for (j = 0; j < svgs.length; j++) {
                        if (svgs[j] && svgs[j].style) {
                            // Do not set pointer-events:none — host still needs geometry; our handlers are on dom
                            if (svgs[j].style.cursor === "move") svgs[j].style.cursor = "default";
                        }
                    }
                }
            } catch (eLock) {
                if (typeof console !== "undefined" && console.debug) {
                    console.debug("[board2d] lockPadPrimitives", eLock);
                }
            }
        }

        function drawAll(state) {
            if (destroyed) return Promise.resolve(null);
            var prevW = width;
            var prevH = height;
            lastState = state || lastState;
            if (state) {
                var d = boardDimsFrom(state);
                width = d.width;
                height = d.height;
                size = Math.max(width, height);
            }
            // New Game / dim change: full-board view
            if (width !== prevW || height !== prevH) {
                zoom = 1;
                panX = 0;
                panY = 0;
            }

            ensureDrawLayer();
            layoutSquareDrawLayer();
            attachResizeObserver();
            ensureHud();
            clearDrawOnly();
            applyViewTransform();

            // Ensure MoveResize stays off for every redraw (incl. drag-preview redraw).
            if (jsrootSettings) jsrootSettings.MoveResize = false;

            var objs = buildPrimitives(width, height, lastState, { dragPreview: dragPreviewPt });
            if (!objs.length) return Promise.resolve(null);

            var target = drawLayer;
            var chain = Promise.resolve(J.draw(target, objs[0], "")).then(function (p) {
                painter = p;
                // After canvas/pad exists: mark non-editable before more "same" draws if possible
                try {
                    var pp0 = p && p.getPadPainter && p.getPadPainter();
                    if (pp0 && pp0.pad) pp0.pad.fEditable = false;
                } catch (ePad) { /* */ }
                return p;
            });
            var i;
            for (i = 1; i < objs.length; i++) {
                (function (obj) {
                    chain = chain.then(function () {
                        return J.draw(target, obj, "same");
                    }).then(function (p2) {
                        if (p2 && !painter) painter = p2;
                    }).catch(function (err) {
                        console.warn("[board2d] same-draw", err);
                    });
                })(objs[i]);
            }
            return chain.then(function () {
                // Keep square pad after JSROOT injects SVG (may set 100% styles)
                layoutSquareDrawLayer();
                lockPadPrimitives();
                attachInput();
                applyViewTransform();
                calibrateMap();
                return painter;
            });
        }

        drawChain = drawAll(lastState).catch(function (err) {
            console.error("[board2d] draw failed", err);
            throw err;
        });

        return {
            kind: "2d",
            rootClass: "TBox+TLine+TEllipse+TMarker+TText",
            redraw: function (state) {
                // width/height handled inside drawAll (may reset view)
                lastState = state || lastState;
                drawChain = drawAll(lastState);
                return drawChain;
            },
            resetView: function () {
                return resetView();
            },
            zoomIn: function () { zoomBy(ZOOM_STEP); },
            zoomOut: function () { zoomBy(1 / ZOOM_STEP); },
            panBy: function (dx, dy) { panBy(dx, dy); },
            getView: function () {
                return { zoom: zoom, panX: panX, panY: panY };
            },
            destroy: function () {
                destroyed = true;
                dragPreviewPt = null;
                // Restore JSROOT MoveResize if we changed it for this mount
                if (jsrootSettings && prevMoveResize !== null) {
                    jsrootSettings.MoveResize = prevMoveResize;
                }
                detachInput();
                clearDom();
            },
            /** Client → board (x,y); used by UI Hand drag. */
            pickAtClient: pickAtClient,
            whenReady: function () { return drawChain; }
        };
    }

    GoGame.Board2D = {
        mount: mount,
        buildPrimitives: buildPrimitives,
        hoshiPoints: hoshiPoints,
        densifyAxisMarks: densifyAxisMarks,
        frameGeometry: frameGeometry,
        boardDimsFrom: boardDimsFrom,
        colLetter: colLetter,
        rowNumber: rowNumber,
        labelTextSize: labelTextSize,
        territoryPointsForOverlay: territoryPointsForOverlay,
        TERR_OVERLAY: TERR_OVERLAY,
        /** Log pad/user/board hit: GoGame.Board2D.DEBUG_HIT = true */
        DEBUG_HIT: false
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_board2d] ready (square pad letterbox + square cells + Hand)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
