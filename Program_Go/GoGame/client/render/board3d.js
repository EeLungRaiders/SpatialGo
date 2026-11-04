/**
 * Spatial lattice (default cube 4×4×4) — TPolyLine3D + TGeoSphere extras.
 * worldOf(x,y,z) is the single mapping for grid, empty marks, stones, picking.
 * No wooden slab. No z=0 plane pick. No Board2D.
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};
    var St = function () { return GoGame.State; };

    var CELL = 1;
    var PICK_DIST = 0.45;

    function dimsNow() {
        var sess = GoGame.session;
        var st = sess && sess.state;
        if (st && st.sizeX != null) {
            return { x: st.sizeX | 0, y: st.sizeY | 0, z: st.sizeZ | 0 };
        }
        var n = 4;
        if (st && st.size != null) n = st.size | 0;
        else {
            var S = St();
            if (S && S.DEFAULT_SIZE != null) n = S.DEFAULT_SIZE | 0;
            else if (S && S.SIZE) n = S.SIZE | 0;
        }
        return { x: n, y: n, z: n };
    }
    function volNow() {
        var d = dimsNow();
        return d.x * d.y * d.z;
    }
    function nMaxNow() {
        var d = dimsNow();
        return Math.max(d.x, d.y, d.z);
    }

    function fullClipOf(state, fade) {
        var d;
        if (state && state.sizeX != null) {
            d = { x: state.sizeX | 0, y: state.sizeY | 0, z: state.sizeZ | 0 };
        } else {
            d = dimsNow();
        }
        var f = fade != null && isFinite(fade) ? +fade : 0;
        if (f < 0) f = 0;
        if (f > 1) f = 1;
        return {
            x0: 0, x1: Math.max(0, d.x - 1),
            y0: 0, y1: Math.max(0, d.y - 1),
            z0: 0, z1: Math.max(0, d.z - 1),
            fade: f
        };
    }

    function clampClip(clip, state) {
        var base = fullClipOf(state, clip && clip.fade);
        if (!clip) return base;
        function pair(a, b, hi) {
            a = a | 0;
            b = b | 0;
            if (a > b) {
                var t = a;
                a = b;
                b = t;
            }
            if (a < 0) a = 0;
            if (b > hi) b = hi;
            if (a > b) a = b;
            return [a, b];
        }
        var x = pair(clip.x0, clip.x1, base.x1);
        var y = pair(clip.y0, clip.y1, base.y1);
        var z = pair(clip.z0, clip.z1, base.z1);
        return {
            x0: x[0], x1: x[1],
            y0: y[0], y1: y[1],
            z0: z[0], z1: z[1],
            fade: base.fade
        };
    }

    function clipNow() {
        var sess = GoGame.session;
        var st = sess && sess.state;
        if (!sess || !sess.clip) return fullClipOf(st, 0);
        return clampClip(sess.clip, st);
    }

    function inClip(ix, iy, iz) {
        var S = St();
        var st = GoGame.session && GoGame.session.state;
        if (S && st && typeof S.inBounds === "function" && !S.inBounds(st, ix, iy, iz)) {
            return false;
        }
        var c = clipNow();
        return ix >= c.x0 && ix <= c.x1 &&
            iy >= c.y0 && iy <= c.y1 &&
            iz >= c.z0 && iz <= c.z1;
    }

    function resetClipToFull(state) {
        var sess = GoGame.session;
        if (!sess) return fullClipOf(state, 0);
        var fade = sess.clip && isFinite(sess.clip.fade) ? +sess.clip.fade : 0;
        sess.clip = fullClipOf(state || sess.state, fade);
        return sess.clip;
    }

    function stoneDrawn(state, x, y, z) {
        var S = St();
        if (!S) return false;
        var v = S.getStone(state, x, y, z);
        if (v !== S.BLACK && v !== S.WHITE) return false;
        var c = clipNow();
        var inside = inClip(x, y, z);
        if (inside) return true;
        if (c.fade <= 0) return false;
        var dead = S.isDead && S.isDead(state, x, y, z);
        if (dead && c.fade < 1) return false;
        return true;
    }
    var STONE_R = 0.32;
    var PICK_DIST = 0.45;
    var STONES_EXTRAS_NAME = "goStones";
    var USE_TGEO_STONES = true;
    var GEO_RGBA_BLACK = [0.06, 0.06, 0.06, 1];
    var GEO_RGBA_WHITE = [1.0, 1.0, 1.0, 1];

    function stoneRgbaForRole(isSecond) {
        var sc = GoGame.session && GoGame.session.stoneColors;
        var src = isSecond
            ? (sc && sc.second) || GEO_RGBA_WHITE
            : (sc && sc.first) || GEO_RGBA_BLACK;
        return src.slice();
    }

    function isDefaultWhiteRgba(rgba) {
        return !!(rgba && rgba[0] >= 0.99 && rgba[1] >= 0.99 && rgba[2] >= 0.99);
    }
    function isDefaultBlackRgba(rgba) {
        return !!(rgba && rgba[0] <= 0.08 && rgba[1] <= 0.08 && rgba[2] <= 0.08);
    }
    var STONE_EXTRAS_NUMFACES = 2000000;
    var STONE_EXTRAS_NUMNODES = 10000;
    var STONE_TRIS_PER_SPHERE_EST = 2 * 16 * 12;

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
            var k;
            for (k in props) {
                if (Object.prototype.hasOwnProperty.call(props, k)) o[k] = props[k];
            }
        }
        if (!o._typename) o._typename = typename;
        return o;
    }

    /** Single world mapping. Cube centered at origin. */
    function worldOf(x, y, z) {
        var d = dimsNow();
        return {
            X: x - (d.x - 1) / 2,
            Y: y - (d.y - 1) / 2,
            Z: z - (d.z - 1) / 2
        };
    }

    function sizeOf(state) {
        if (state && state.size != null) return state.size | 0;
        var S = St();
        if (S && S.DEFAULT_SIZE != null) return S.DEFAULT_SIZE | 0;
        if (S && S.SIZE) return S.SIZE | 0;
        return 4;
    }

    function createGeoSphereShape(r) {
        return createObj("TGeoSphere", {
            fShapeId: 1,
            fShapeBits: 0,
            fDX: r,
            fDY: r,
            fDZ: r,
            fOrigin: [0, 0, 0],
            fRmin: 0,
            fRmax: r,
            fTheta1: 0,
            fTheta2: 180,
            fPhi1: 0,
            fPhi2: 360,
            fNseg: 16,
            fNz: 12
        });
    }

    function eveTrans(tx, ty, tz) {
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
    }

    function ensureTList(lst) {
        if (!lst) lst = createObj("TList", {});
        if (!lst.arr) lst.arr = [];
        if (!lst.opt) lst.opt = [];
        if (typeof lst.Add !== "function") {
            lst.Add = function (elem, opt) {
                this.arr.push(elem);
                this.opt.push(typeof opt === "string" ? opt : "");
            };
        }
        if (typeof lst.Clear !== "function") {
            lst.Clear = function () {
                this.arr = [];
                this.opt = [];
            };
        }
        return lst;
    }

    function makeEveSphereNode(name, r, x, y, z, rgba) {
        return createObj("TEveGeoShapeExtract", {
            fName: String(name),
            fTitle: String(name),
            fTrans: eveTrans(x, y, z),
            fShape: createGeoSphereShape(r),
            fRGBA: rgba,
            fElements: null,
            fRnrSelf: true
        });
    }

    function polyline(pts, col, w) {
        var pl = createObj("TPolyLine3D", {});
        var fP = [];
        var i;
        for (i = 0; i < pts.length; i++) {
            fP.push(pts[i][0], pts[i][1], pts[i][2]);
        }
        pl.fN = pts.length;
        pl.fP = fP;
        pl.fLineColor = col;
        pl.fLineWidth = w;
        return { kind: "line", obj: pl };
    }

    /** Outer 12 edges of the clip cuboid (not the full-board shell). */
    function createCubeFrame() {
        var c = clipNow();
        var a = worldOf(c.x0, c.y0, c.z0);
        var b = worldOf(c.x1, c.y1, c.z1);
        var ax = a.X, bx = b.X;
        var ay = a.Y, by = b.Y;
        var az = a.Z, bz = b.Z;
        var col = 1;
        var w = 2;
        // First polyline walks +X then +Y then +Z so JSROOT AABB
        // includes the clip extents (a z-slice is a flat rectangle).
        var edges = [
            [[ax, ay, az], [bx, ay, az], [bx, by, az], [bx, by, bz]],
            [[ax, by, az], [bx, by, az]],
            [[ax, ay, bz], [bx, ay, bz]],
            [[ax, by, bz], [bx, by, bz]],
            [[ax, ay, az], [ax, by, az]],
            [[ax, ay, bz], [ax, by, bz]],
            [[bx, ay, bz], [bx, by, bz]],
            [[ax, ay, az], [ax, ay, bz]],
            [[bx, ay, az], [bx, ay, bz]],
            [[ax, by, az], [ax, by, bz]]
        ];
        var out = [];
        var i, e, p0, p1;
        for (i = 0; i < edges.length; i++) {
            e = edges[i];
            if (e.length === 2) {
                p0 = e[0];
                p1 = e[1];
                if (p0[0] === p1[0] && p0[1] === p1[1] && p0[2] === p1[2]) continue;
            }
            out.push(polyline(e, col, w));
        }
        if (!out.length) out.push(polyline([[ax, ay, az], [bx, by, bz]], col, w));
        return out;
    }

    /**
     * World-axis rays through geometric center (0,0,0) = display origin.
     * Shaft length 2× the 05_1 L=2.4. Arrowheads only on +X/+Y/+Z.
     */
    function createAxisRays() {
        var n = nMaxNow();
        var L = Math.max(2.4, 1.6 * (n - 1));
        var w = 3;
        var head = Math.max(0.35, L * 0.09);
        var spr = Math.max(0.14, L * 0.038);
        var out = [
            polyline([[-L, 0, 0], [L, 0, 0]], 2, w),
            polyline([[0, -L, 0], [0, L, 0]], 3, w),
            polyline([[0, 0, -L], [0, 0, L]], 4, w)
        ];
        function wing(a, b, col) {
            out.push(polyline([a, b], col, w));
        }
        var hx = L - head;
        wing([hx, spr, 0], [L, 0, 0], 2);
        wing([hx, -spr, 0], [L, 0, 0], 2);
        wing([hx, 0, spr], [L, 0, 0], 2);
        wing([hx, 0, -spr], [L, 0, 0], 2);
        var hy = L - head;
        wing([spr, hy, 0], [0, L, 0], 3);
        wing([-spr, hy, 0], [0, L, 0], 3);
        wing([0, hy, spr], [0, L, 0], 3);
        wing([0, hy, -spr], [0, L, 0], 3);
        var hz = L - head;
        wing([spr, 0, hz], [0, 0, L], 4);
        wing([-spr, 0, hz], [0, 0, L], 4);
        wing([0, spr, hz], [0, 0, L], 4);
        wing([0, -spr, hz], [0, 0, L], 4);
        return out;
    }

    /**
     * +X/-X +Y/-Y +Z/-Z as TPolyLine3D strokes just beyond the arrow tips.
     * TText is 2D-pad only here; these share the axis painter, ignore clip,
     * and use the same ROOT colors (X=2 red, Y=3 green, Z=4 blue).
     */
    function createAxisLabels() {
        var n = nMaxNow();
        var L = Math.max(2.4, 1.6 * (n - 1));
        var pad = Math.max(0.55, L * 0.14);
        var s = Math.max(0.34, L * 0.08);
        var w = 4;
        var p = L + pad;
        var out = [];

        function add(pts, col) {
            out.push(polyline(pts, col, w));
        }
        function pt(c, uu, vv, a, b) {
            return [
                c[0] + a * uu[0] * s + b * vv[0] * s,
                c[1] + a * uu[1] * s + b * vv[1] * s,
                c[2] + a * uu[2] * s + b * vv[2] * s
            ];
        }
        function seg(c, uu, vv, a0, b0, a1, b1, col) {
            add([pt(c, uu, vv, a0, b0), pt(c, uu, vv, a1, b1)], col);
        }
        function glyphPlus(c, uu, vv, col) {
            seg(c, uu, vv, -1, 0, 1, 0, col);
            seg(c, uu, vv, 0, -1, 0, 1, col);
        }
        function glyphMinus(c, uu, vv, col) {
            seg(c, uu, vv, -1, 0, 1, 0, col);
        }
        function glyphX(c, uu, vv, col) {
            seg(c, uu, vv, -1, -1, 1, 1, col);
            seg(c, uu, vv, -1, 1, 1, -1, col);
        }
        function glyphY(c, uu, vv, col) {
            seg(c, uu, vv, -1, 1, 0, 0.15, col);
            seg(c, uu, vv, 1, 1, 0, 0.15, col);
            seg(c, uu, vv, 0, 0.15, 0, -1, col);
        }
        function glyphZ(c, uu, vv, col) {
            seg(c, uu, vv, -1, 1, 1, 1, col);
            seg(c, uu, vv, 1, 1, -1, -1, col);
            seg(c, uu, vv, -1, -1, 1, -1, col);
        }
        function pair(c, uu, vv, sign, letter, col) {
            var gap = 1.25;
            var cSign = [
                c[0] - gap * s * uu[0],
                c[1] - gap * s * uu[1],
                c[2] - gap * s * uu[2]
            ];
            var cLet = [
                c[0] + gap * s * uu[0],
                c[1] + gap * s * uu[1],
                c[2] + gap * s * uu[2]
            ];
            if (sign === "+") glyphPlus(cSign, uu, vv, col);
            else glyphMinus(cSign, uu, vv, col);
            if (letter === "X") glyphX(cLet, uu, vv, col);
            else if (letter === "Y") glyphY(cLet, uu, vv, col);
            else glyphZ(cLet, uu, vv, col);
        }

        var yzU = [0, 1, 0], yzV = [0, 0, 1];
        var xzU = [1, 0, 0], xzV = [0, 0, 1];
        var xyU = [1, 0, 0], xyV = [0, 1, 0];
        pair([p, 0, 0], yzU, yzV, "+", "X", 2);
        pair([-p, 0, 0], yzU, yzV, "-", "X", 2);
        pair([0, p, 0], xzU, xzV, "+", "Y", 3);
        pair([0, -p, 0], xzU, xzV, "-", "Y", 3);
        pair([0, 0, p], xyU, xyV, "+", "Z", 4);
        pair([0, 0, -p], xyU, xyV, "-", "Z", 4);
        return out;
    }

    function createAxisGrid() {
        var out = [];
        var col = 12;
        var w = 1;
        var i, j, t, pts, wpt, c = clipNow();
        for (j = c.y0; j <= c.y1; j++) {
            for (t = c.z0; t <= c.z1; t++) {
                pts = [];
                for (i = c.x0; i <= c.x1; i++) {
                    wpt = worldOf(i, j, t);
                    pts.push([wpt.X, wpt.Y, wpt.Z]);
                }
                if (pts.length >= 2) out.push(polyline(pts, col, w));
            }
        }
        for (i = c.x0; i <= c.x1; i++) {
            for (t = c.z0; t <= c.z1; t++) {
                pts = [];
                for (j = c.y0; j <= c.y1; j++) {
                    wpt = worldOf(i, j, t);
                    pts.push([wpt.X, wpt.Y, wpt.Z]);
                }
                if (pts.length >= 2) out.push(polyline(pts, col, w));
            }
        }
        for (i = c.x0; i <= c.x1; i++) {
            for (j = c.y0; j <= c.y1; j++) {
                pts = [];
                for (t = c.z0; t <= c.z1; t++) {
                    wpt = worldOf(i, j, t);
                    pts.push([wpt.X, wpt.Y, wpt.Z]);
                }
                if (pts.length >= 2) out.push(polyline(pts, col, w));
            }
        }
        return out;
    }

    function polyMarker(fP, color, size) {
        var m = createObj("TPolyMarker3D", {});
        m.fN = fP.length / 3;
        m.fP = fP;
        m.fMarkerColor = color;
        m.fMarkerStyle = 20;
        m.fMarkerSize = size != null ? size : 0.35;
        return { kind: "mark", obj: m };
    }

    function pointsToFP(list) {
        var fP = [];
        var i, w;
        if (!list) return fP;
        for (i = 0; i < list.length; i++) {
            w = worldOf(list[i].x, list[i].y, list[i].z);
            fP.push(w.X, w.Y, w.Z);
        }
        return fP;
    }

    /** Gray empties, or three-color territory when ended+scoreResult.points. */
    function createEmptyMarkers(state) {
        var S = St();
        var pts = state && state.phase === "ended" && state.scoreResult &&
            state.scoreResult.territory && state.scoreResult.territory.points;
        var clip = clipNow();
        function keepEmptyPt(p) {
            if (!p) return false;
            if (clip.fade >= 1) return true;
            return inClip(p.x, p.y, p.z);
        }
        if (pts) {
            var out = [];
            var fb = pointsToFP((pts.black || []).filter(keepEmptyPt));
            var fw = pointsToFP((pts.white || []).filter(keepEmptyPt));
            var fd = pointsToFP((pts.dame || []).filter(keepEmptyPt));
            if (fb.length) out.push(polyMarker(fb, 1, 0.42));
            if (fw.length) out.push(polyMarker(fw, 10, 0.42));
            if (fd.length) out.push(polyMarker(fd, 5, 0.38));
            return out;
        }
        var fP = [];
        var z, y, x, w, v;
        if (state && S) {
            var dLoop = dimsNow();
            for (z = 0; z < dLoop.z; z++) {
                for (y = 0; y < dLoop.y; y++) {
                    for (x = 0; x < dLoop.x; x++) {
                        v = S.getStone(state, x, y, z);
                        if (v === S.BLACK || v === S.WHITE) continue;
                        if (clip.fade < 1 && !inClip(x, y, z)) continue;
                        w = worldOf(x, y, z);
                        fP.push(w.X, w.Y, w.Z);
                    }
                }
            }
        }
        return [polyMarker(fP, 17, 0.35)];
    }

    function buildStonesGeoExtract(state) {
        if (!state || !state.board) return null;
        var S = St();
        if (!S) return null;
        var list = ensureTList(createObj("TList", {}));
        list.Clear();
        var z, y, x, n = 0, v, w, rgba, inside, dead;
        var dLoop = dimsNow();
        var clip = clipNow();
        for (z = 0; z < dLoop.z; z++) {
            for (y = 0; y < dLoop.y; y++) {
                for (x = 0; x < dLoop.x; x++) {
                    v = S.getStone(state, x, y, z);
                    if (v !== S.BLACK && v !== S.WHITE) continue;
                    if (!stoneDrawn(state, x, y, z)) continue;
                    w = worldOf(x, y, z);
                    rgba = stoneRgbaForRole(v === S.WHITE);
                    inside = inClip(x, y, z);
                    dead = S.isDead && S.isDead(state, x, y, z);
                    if (dead) {
                        rgba[3] = 0.32;
                    } else if (!inside && clip.fade < 1) {
                        rgba[3] *= clip.fade;
                    }
                    list.Add(makeEveSphereNode(
                        (v === S.WHITE ? "w" : "b") + n,
                        STONE_R, w.X, w.Y, w.Z,
                        rgba
                    ));
                    n++;
                }
            }
        }
        if (!list.arr.length) return null;
        return createObj("TEveGeoShapeExtract", {
            fName: "goStones",
            fTitle: "goStones",
            fTrans: null,
            fShape: createGeoSphereShape(0.05),
            fRGBA: [0, 0, 0, 0],
            fElements: list,
            fRnrSelf: false
        });
    }

    function mount(host, opts) {
        opts = opts || {};
        var J = jr();
        var dom = host;
        var getState = opts.getState || function () {
            return (opts.state) || (GoGame.session && GoGame.session.state) || null;
        };
        var onPlay = opts.onPlayRequest || function () {};
        var onPlaceModeChange = opts.onPlaceModeChange || function () {};

        var painters = [];
        var destroyed = false;
        var pointerBound = false;
        var placeMode = false;
        var cachedGeoPainter = null;
        var lastCameraState = null;
        var restoreTimers = [];
        var reattachTimers = [];
        var lastOrbitReattachMs = 0;
        var DRAG_THRESH_PX = 8;

        /**
         * Geo mouse tooltip/highlight uses ClonedNodes.resolveStack on the dummy
         * TPolyLine3D geom. Extras spheres are not in that clone tree — after the
         * second stone, mousemove throws. Picking is our own ray→lattice.
         * Do NOT set select_in_view or _clones.setMaxVisNodes.
         */
        /** Methods JSROOT base3d.mjs calls without ?.. Never null / false / {}. */
        function noopTooltip() {
            return {
                hide: function () {},
                extract_pos: function () { return null; },
                show: function () {},
                check: function () { return false; }
            };
        }

        function installNoopTooltip(obj) {
            if (!obj) return;
            try {
                if (typeof obj.setTooltipAllowed === "function") {
                    obj.setTooltipAllowed(false);
                }
            } catch (e0) { /* */ }
            try { obj.tooltip = noopTooltip(); } catch (e1) { /* */ }
            try {
                if (obj.ctrl) obj.ctrl.tooltip = noopTooltip();
            } catch (e2) { /* */ }
        }

        function disableGeoTooltipHighlight(painter) {
            if (!painter) return;
            installNoopTooltip(painter);
            try {
                if (typeof painter.highlightMesh === "function") painter.highlightMesh(null);
            } catch (e2) { /* */ }
            try {
                painter.last_highlight = null;
                painter.highlight_mesh = null;
                painter.highlightedDom = null;
            } catch (e3) { /* */ }
        }

        function muteProcessMouseMove(painter) {
            if (!painter) return;
            disableGeoTooltipHighlight(painter);
            cancelPainterDelayedMouse(painter);
            if (typeof painter.processMouseMove === "function" && !painter._goProcMouseMuted) {
                painter._goOrigProcessMouseMove = painter.processMouseMove;
                painter._goProcMouseMuted = true;
                painter.processMouseMove = function () { return false; };
            }
            var lstnNames = ["lstn_mousemove", "_lstn_mousemove", "lstn_mouseover"];
            var els = [];
            try { els.push(getCanvas(painter)); } catch (eC) { /* */ }
            try {
                if (painter.renderer && painter.renderer.domElement) {
                    els.push(painter.renderer.domElement);
                }
            } catch (eR) { /* */ }
            els.push(document);
            var li, ei, lstn, el;
            for (li = 0; li < lstnNames.length; li++) {
                lstn = painter[lstnNames[li]];
                if (!lstn) continue;
                for (ei = 0; ei < els.length; ei++) {
                    el = els[ei];
                    if (!el || typeof el.removeEventListener !== "function") continue;
                    try { el.removeEventListener("mousemove", lstn); } catch (e1) { /* */ }
                    try { el.removeEventListener("pointermove", lstn); } catch (e2) { /* */ }
                    // Never remove wheel / mousewheel — orbit zoom is a separate listener.
                }
            }
        }

        function muteControlHover(ctrl) {
            if (!ctrl) return;
            installNoopTooltip(ctrl);
            var tkeys = ["_mouseTmOut", "tooltip_timeout", "tt_tmout", "_ttTmout",
                "tmout", "mouse_tmout", "delayTmout"];
            var ti, tk;
            for (ti = 0; ti < tkeys.length; ti++) {
                tk = tkeys[ti];
                try {
                    if (ctrl[tk]) {
                        clearTimeout(ctrl[tk]);
                        ctrl[tk] = null;
                    }
                } catch (eC) { /* */ }
            }
            try {
                if (typeof ctrl.clear_delayed === "function") ctrl.clear_delayed();
            } catch (eD) { /* */ }
            // Hover/tooltip only. Keep lstn_mousemove (orbit) and wheel (zoom).
            if (typeof ctrl.processMouseMove === "function" && !ctrl._goHoverMuted) {
                ctrl._goOrigProcessMouseMove = ctrl.processMouseMove;
                ctrl.processMouseMove = function () { return false; };
                ctrl._goHoverMuted = true;
            }
            if (typeof ctrl.delayedProcessMouseMove === "function" && !ctrl._goDelayMuted) {
                ctrl._goOrigDelayedPMM = ctrl.delayedProcessMouseMove;
                ctrl.delayedProcessMouseMove = function () { return false; };
                ctrl._goDelayMuted = true;
            }
            restoreOrbitWheel(ctrl, null);
        }

        function restoreOrbitWheel(ctrl, painter) {
            if (!ctrl) return;
            try {
                if ("enableZoom" in ctrl) ctrl.enableZoom = true;
            } catch (eZ) { /* */ }
            try {
                if ("zoomSpeed" in ctrl && !(ctrl.zoomSpeed > 0)) ctrl.zoomSpeed = 1.0;
            } catch (eS) { /* */ }
            var el = null;
            try {
                if (painter && painter.renderer && painter.renderer.domElement) {
                    el = painter.renderer.domElement;
                }
            } catch (eP) { /* */ }
            if (!el) {
                try { el = ctrl.domElement || null; } catch (eD) { el = null; }
            }
            var handlers = [
                ctrl.lstn_wheel, ctrl._lstn_wheel, ctrl._onMouseWheel,
                ctrl.onMouseWheel, ctrl.handleMouseWheel
            ];
            var hi, h;
            for (hi = 0; hi < handlers.length; hi++) {
                h = handlers[hi];
                if (!h || !el || typeof el.addEventListener !== "function") continue;
                try { el.removeEventListener("wheel", h); } catch (eR) { /* */ }
                try { el.removeEventListener("mousewheel", h); } catch (eR2) { /* */ }
                try {
                    el.addEventListener("wheel", h, { passive: false });
                } catch (eA) {
                    try { el.addEventListener("wheel", h); } catch (eA2) { /* */ }
                }
            }
        }

        function muteAllPaintersMouse() {
            var i, p, m, c;
            for (i = 0; i < painters.length; i++) {
                p = painters[i];
                muteProcessMouseMove(p);
                try {
                    if (p && typeof p.getMainPainter === "function") {
                        m = p.getMainPainter();
                        muteProcessMouseMove(m);
                        muteControlHover(getOrbitControls(m));
                    }
                } catch (eM) { /* */ }
                try {
                    muteControlHover(getOrbitControls(p));
                    muteControlHover(p && p.control);
                    muteControlHover(p && p.controls);
                    restoreOrbitWheel(getOrbitControls(p), p);
                    restoreOrbitWheel(p && p.control, p);
                    restoreOrbitWheel(p && p.controls, p);
                } catch (eC) { /* */ }
            }
        }

        function wipeNamedExtras(geop, name) {
            try {
                if (geop && typeof geop.getExtrasContainer === "function") {
                    geop.getExtrasContainer("delete", name);
                }
            } catch (e1) { /* */ }
            var scene = null;
            try { scene = getScene(geop); } catch (eS) { scene = null; }
            if (!scene || typeof scene.traverse !== "function") return;
            var doomed = [];
            scene.traverse(function (obj) {
                if (!obj) return;
                var n = obj.name != null ? String(obj.name) : "";
                var gn = obj.geo_name != null ? String(obj.geo_name) : "";
                // Exact extras name only — prefix match deleted the parent and
                // left meshes outside the container (hasContainer=false).
                if (n === name || gn === name) doomed.push(obj);
            });
            var i;
            for (i = 0; i < doomed.length; i++) {
                try {
                    if (doomed[i].parent) doomed[i].parent.remove(doomed[i]);
                } catch (e2) { /* */ }
            }
        }

        function ensureExtrasContainer(geop, name) {
            if (!geop || typeof geop.getExtrasContainer !== "function") return null;
            var cont = null;
            try { cont = geop.getExtrasContainer("get", name); } catch (eG) { cont = null; }
            if (cont) return cont;
            try { cont = geop.getExtrasContainer("create", name); } catch (eC) { cont = null; }
            if (cont) return cont;
            try { cont = geop.getExtrasContainer("update", name); } catch (eU) { cont = null; }
            return cont || null;
        }

        function wipeScenePoints(geop) {
            var scene = null;
            try { scene = getScene(geop); } catch (eS) { scene = null; }
            if (!scene || typeof scene.traverse !== "function") return;
            var doomed = [];
            scene.traverse(function (obj) {
                if (!obj) return;
                var typ = obj.type ? String(obj.type) : "";
                if (obj.isPoints || typ.indexOf("Points") >= 0) doomed.push(obj);
            });
            var i;
            for (i = 0; i < doomed.length; i++) {
                try {
                    if (doomed[i].parent) doomed[i].parent.remove(doomed[i]);
                } catch (e2) { /* */ }
            }
        }

        function refreshEmptyMarkers(state) {
            var geop = findGeoExtrasPainter() || find3DPainter();
            wipeScenePoints(geop);
            var marks = [];
            try { marks = createEmptyMarkers(state) || []; } catch (eM) {
                console.warn("[board3d] empty markers rebuild failed", eM);
                return Promise.resolve(false);
            }
            var chain = Promise.resolve(true);
            var mi;
            for (mi = 0; mi < marks.length; mi++) {
                (function (entry) {
                    if (!entry || !entry.obj) return;
                    chain = chain.then(function () {
                        return J.draw(dom, entry.obj, "same");
                    }).then(function (p) {
                        if (p) {
                            painters.push(p);
                            muteProcessMouseMove(p);
                            try {
                                if (typeof p.getMainPainter === "function") {
                                    muteProcessMouseMove(p.getMainPainter());
                                }
                            } catch (eP) { /* */ }
                        }
                    });
                })(marks[mi]);
            }
            return chain.then(function () {
                muteAllPaintersMouse();
                muteControlHover(getOrbitControls(geop));
                try {
                    if (geop && typeof geop.render3D === "function") geop.render3D(0);
                } catch (eR) { /* */ }
                return true;
            }).catch(function (err) {
                console.warn("[board3d] empty markers draw failed", err);
                muteAllPaintersMouse();
                muteControlHover(getOrbitControls(geop));
                return false;
            });
        }

        function cancelPainterDelayedMouse(painter) {
            if (!painter) return;
            var keys = ["_mouseTmOut", "tooltip_timeout", "tt_tmout", "_ttTmout"];
            var i, k;
            for (i = 0; i < keys.length; i++) {
                k = keys[i];
                try {
                    if (painter[k]) {
                        clearTimeout(painter[k]);
                        painter[k] = null;
                    }
                } catch (eC) { /* */ }
            }
        }

        function detachPainterMouse(painter) {
            if (!painter) return;
            disableGeoTooltipHighlight(painter);
            cancelPainterDelayedMouse(painter);
            var lstn = painter.lstn_mousemove || painter._lstn_mousemove;
            var cnv = null;
            try { cnv = getCanvas(painter); } catch (eG) { cnv = null; }
            function unbind(el) {
                if (!el || !lstn) return;
                try { el.removeEventListener("mousemove", lstn); } catch (e1) { /* */ }
                try { el.removeEventListener("pointermove", lstn); } catch (e2) { /* */ }
            }
            unbind(cnv);
            try { unbind(document); } catch (eD) { /* */ }
            try {
                var ctrl = getOrbitControls(painter);
                if (ctrl && lstn) {
                    if (ctrl.domElement) unbind(ctrl.domElement);
                    if (typeof ctrl.removeEventListener === "function") {
                        try { ctrl.removeEventListener("change", lstn); } catch (e3) { /* */ }
                    }
                }
            } catch (eO) { /* */ }
        }

        function silencePaintersMouse() {
            var i, p, m;
            for (i = 0; i < painters.length; i++) {
                p = painters[i];
                detachPainterMouse(p);
                try {
                    if (p && typeof p.getMainPainter === "function") {
                        m = p.getMainPainter();
                        detachPainterMouse(m);
                    }
                } catch (eM) { /* */ }
            }
        }

        function clearDom() {
            silencePaintersMouse();
            cachedGeoPainter = null;
            cancelScheduledRestores();
            while (dom && dom.firstChild) dom.removeChild(dom.firstChild);
            painters = [];
            pointerBound = false;
        }

        function drawSeq(entries) {
            var chain = Promise.resolve();
            var first = true;
            var i;
            for (i = 0; i < entries.length; i++) {
                (function (entry, isFirst) {
                    chain = chain.then(function () {
                        if (destroyed) return null;
                        var opt = isFirst ? "" : "same";
                        return J.draw(dom, entry.obj, opt);
                    }).then(function (p) {
                        if (p) {
                            painters.push(p);
                            muteProcessMouseMove(p);
                            try {
                                if (typeof p.getMainPainter === "function") {
                                    muteProcessMouseMove(p.getMainPainter());
                                }
                            } catch (eP) { /* */ }
                        }
                    }).catch(function (err) {
                        console.warn("[board3d] draw item failed", err);
                    });
                })(entries[i], first);
                first = false;
            }
            return chain;
        }

        function findGeoExtrasPainter() {
            var i, p, m;
            for (i = 0; i < painters.length; i++) {
                p = painters[i];
                if (p && typeof p.drawExtras === "function") return p;
            }
            for (i = 0; i < painters.length; i++) {
                p = painters[i];
                if (!p) continue;
                try {
                    if (typeof p.getMainPainter === "function") {
                        m = p.getMainPainter();
                        if (m && typeof m.drawExtras === "function") return m;
                    }
                } catch (eM) { /* */ }
            }
            return null;
        }

        function countEveStoneNodes(stonesGeo) {
            try {
                var el = stonesGeo && stonesGeo.fElements;
                if (el && el.arr && el.arr.length != null) return el.arr.length | 0;
            } catch (e0) { /* */ }
            return 0;
        }

        function countStateStones(state) {
            if (!state || !state.board) return 0;
            var S = St();
            if (!S) return 0;
            var n = 0, z, y, x;
            var dLoop = dimsNow();
            for (z = 0; z < dLoop.z; z++) {
                for (y = 0; y < dLoop.y; y++) {
                    for (x = 0; x < dLoop.x; x++) {
                        if (stoneDrawn(state, x, y, z)) n++;
                    }
                }
            }
            return n;
        }

        function resolveGeoBuildFn(geop) {
            try {
                if (geop && geop.constructor && typeof geop.constructor.build3d === "function") {
                    return function (obj, opt) { return geop.constructor.build3d(obj, opt); };
                }
            } catch (e1) { /* */ }
            if (J && typeof J.build === "function") return J.build;
            if (J && J.GEO && typeof J.GEO.build === "function") return J.GEO.build;
            return null;
        }

        function countExtrasMeshes(geop) {
            var meshLike = 0;
            var any = 0;
            var hasContainer = false;
            if (!geop || typeof geop.getExtrasContainer !== "function") {
                return { mesh: 0, any: 0, hasContainer: false };
            }
            try {
                var cont = geop.getExtrasContainer("get", STONES_EXTRAS_NAME);
                if (!cont) return { mesh: 0, any: 0, hasContainer: false };
                hasContainer = true;
                cont.traverse(function (obj) {
                    if (!obj) return;
                    any++;
                    var typ = obj.type ? String(obj.type) : "";
                    if (obj.isMesh || obj.isInstancedMesh || obj.isPoints ||
                        (obj.geometry && obj.material) ||
                        typ.indexOf("Mesh") >= 0 || typ.indexOf("Points") >= 0) {
                        meshLike++;
                    }
                });
            } catch (e2) { /* */ }
            return { mesh: meshLike, any: any, hasContainer: hasContainer };
        }

        function logStoneExtrasAudit(tag, geop, nState, nTree, meshInfo, faceBudget, nodeBudget) {
            try {
                var nMesh = meshInfo && meshInfo.mesh;
                var nAny = meshInfo && meshInfo.any;
                var hasC = meshInfo && meshInfo.hasContainer;
                var msg = "[board3d] stoneExtras " + tag +
                    " state=" + nState +
                    " tree=" + nTree +
                    " mesh=" + (nMesh != null ? nMesh : "n/a") +
                    " extrasNodes=" + (nAny != null ? nAny : "n/a") +
                    " hasContainer=" + hasC +
                    " facesBudget=" + faceBudget +
                    " nodesBudget=" + nodeBudget;
                if (nTree > 0 && hasC === false) {
                    console.warn(msg + " — extras container missing (not ok)");
                    return;
                } else if (nTree > 0 && nMesh === 0 && nAny > 0) {
                    console.log(msg + " — mesh flag alias (extras nodes present)");
                } else if (nTree > 0 && nMesh != null && nMesh > 0 && nMesh + 2 < nTree) {
                    console.warn(msg + " — mesh<<tree (possible collectVisibles truncate)");
                } else if (typeof console !== "undefined" && console.log) {
                    console.log(msg);
                }
            } catch (e3) { /* */ }
        }

        function attachStonesToGeoPainter(stonesGeo, stateForAudit) {
            if (!stonesGeo) return Promise.resolve(false);
            var geop = findGeoExtrasPainter();
            if (!geop || typeof geop.drawExtras !== "function") {
                console.warn("[board3d] no geo painter for stone extras — stones not attached");
                return Promise.resolve(false);
            }
            var nTree = countEveStoneNodes(stonesGeo);
            var nState = stateForAudit ? countStateStones(stateForAudit) : nTree;
            var faceBudget = Math.max(
                STONE_EXTRAS_NUMFACES,
                (nTree > 0 ? nTree : volNow()) * STONE_TRIS_PER_SPHERE_EST * 2
            );
            var nodeBudget = Math.max(STONE_EXTRAS_NUMNODES, nTree + volNow());

            muteProcessMouseMove(geop);
            muteControlHover(getOrbitControls(geop));
            wipeNamedExtras(geop, STONES_EXTRAS_NAME);
            ensureExtrasContainer(geop, STONES_EXTRAS_NAME);

            try {
                if (geop.ctrl) {
                    geop.ctrl.maxfaces = faceBudget;
                    geop.ctrl.maxnodes = nodeBudget;
                    if (geop.ctrl.vislevel == null || geop.ctrl.vislevel < 99) {
                        geop.ctrl.vislevel = 99;
                    }
                    geop.ctrl.more = Math.max(geop.ctrl.more || 1, 10);
                }
            } catch (eCtrl) { /* */ }

            var buildFn = resolveGeoBuildFn(geop);
            var origDrawExtraShape = null;
            if (buildFn && typeof geop.drawExtraShape === "function") {
                origDrawExtraShape = geop.drawExtraShape;
                geop.drawExtraShape = function (obj, itemname) {
                    var mesh = null;
                    try {
                        mesh = buildFn(obj, {
                            numfaces: faceBudget,
                            numnodes: nodeBudget,
                            vislevel: 99,
                            instancing: -1
                        });
                    } catch (eBuild) {
                        console.warn("[board3d] geo build with raised limits failed", eBuild);
                        mesh = null;
                    }
                    if (!mesh) {
                        try {
                            return origDrawExtraShape.call(geop, obj, itemname);
                        } catch (eOrig) {
                            return false;
                        }
                    }
                    mesh.geo_name = itemname;
                    mesh.geo_object = obj;
                    try {
                        var cont = ensureExtrasContainer(geop, STONES_EXTRAS_NAME);
                        if (cont && typeof cont.add === "function") {
                            cont.add(mesh);
                        } else {
                            geop.addToExtrasContainer(mesh);
                        }
                    } catch (eAdd) {
                        console.warn("[board3d] addToExtrasContainer failed", eAdd);
                        return false;
                    }
                    return true;
                };
            }

            return Promise.resolve(geop.drawExtras(stonesGeo, STONES_EXTRAS_NAME, true, true))
                .then(function () {
                    if (origDrawExtraShape) {
                        try { geop.drawExtraShape = origDrawExtraShape; } catch (eRest) { /* */ }
                    }
                    polishGeoStoneMaterials(geop);
                    muteProcessMouseMove(geop);
                    muteControlHover(getOrbitControls(geop));
                    muteAllPaintersMouse();
                    var meshInfo = countExtrasMeshes(geop);
                    var tag = (nTree > 0 && meshInfo && meshInfo.hasContainer === false)
                        ? "fail"
                        : "ok";
                    logStoneExtrasAudit(tag, geop, nState, nTree, meshInfo, faceBudget, nodeBudget);
                    return tag === "ok";
                })
                .catch(function (err) {
                    if (origDrawExtraShape) {
                        try { geop.drawExtraShape = origDrawExtraShape; } catch (eRest2) { /* */ }
                    }
                    console.warn("[board3d] drawExtras stones failed", err);
                    logStoneExtrasAudit("fail", geop, nState, nTree, null, faceBudget, nodeBudget);
                    return false;
                });
        }

        function polishGeoStoneMaterials(geop) {
            geop = geop || findGeoExtrasPainter();
            if (!geop) return;
            var THREE = getTHREE(geop);
            var DoubleSide = THREE && (THREE.DoubleSide != null) ? THREE.DoubleSide : 2;
            var roots = [];
            try {
                if (typeof geop.getExtrasContainer === "function") {
                    var cont = geop.getExtrasContainer("get", STONES_EXTRAS_NAME);
                    if (cont) roots.push(cont);
                }
            } catch (eC) { /* */ }
            function isSecondStoneObj(obj) {
                if (!obj) return false;
                var go = obj.geo_object || null;
                var nm = (go && go.fName) ? String(go.fName) : (obj.name ? String(obj.name) : "");
                return /^w\d/.test(nm);
            }
            function polishStoneMat(mat, rgba, isSecond) {
                if (!mat) return;
                // Custom RGB and default black: leave TGeo fRGBA as-is (no rim, no dim).
                if (!(isSecond && isDefaultWhiteRgba(rgba))) return;
                if (mat.side !== undefined) mat.side = DoubleSide;
                if (mat.color && typeof mat.color.setRGB === "function") mat.color.setRGB(1, 1, 1);
                if (mat.emissive && typeof mat.emissive.setRGB === "function") {
                    mat.emissive.setRGB(0.55, 0.55, 0.55);
                }
                if (typeof mat.emissiveIntensity === "number") {
                    mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 0.45);
                }
                mat.needsUpdate = true;
            }
            try {
                var ri;
                for (ri = 0; ri < roots.length; ri++) {
                    roots[ri].traverse(function (obj) {
                        if (!obj || !obj.material) return;
                        var second = isSecondStoneObj(obj);
                        var rgba = (obj.geo_object && obj.geo_object.fRGBA) || stoneRgbaForRole(second);
                        var mats = Object.prototype.toString.call(obj.material) === "[object Array]"
                            ? obj.material : [obj.material];
                        var mi;
                        for (mi = 0; mi < mats.length; mi++) polishStoneMat(mats[mi], rgba, second);
                    });
                }
            } catch (eP) {
                console.warn("[board3d] polishGeoStoneMaterials", eP);
            }
            try {
                if (typeof geop.render3D === "function") geop.render3D(0);
            } catch (eR) { /* */ }
        }

        function getTHREE(painter) {
            if (global.THREE) return global.THREE;
            if (J && J.THREE) return J.THREE;
            try {
                var ctrl = null;
                if (painter) {
                    if (typeof painter.getControls === "function") ctrl = painter.getControls();
                    if (!ctrl) ctrl = painter.control || painter.controls;
                }
                if (ctrl && ctrl.raycaster && ctrl.raycaster.constructor) {
                    var R = ctrl.raycaster;
                    return {
                        Raycaster: R.constructor,
                        Vector2: function (x, y) { return { x: x || 0, y: y || 0 }; },
                        Vector3: (R.ray && R.ray.origin && R.ray.origin.constructor) || function (x, y, z) {
                            return { x: x || 0, y: y || 0, z: z || 0 };
                        },
                        _fromControl: true
                    };
                }
            } catch (eT) { /* */ }
            return null;
        }

        function getCamera(painter) {
            if (!painter || typeof painter !== "object") return null;
            var cam = null;
            if (typeof painter.getCamera === "function") {
                try { cam = painter.getCamera(); } catch (e0) { /* */ }
            }
            if (!cam && painter.camera) cam = painter.camera;
            if (!cam) {
                var ctrl = null;
                try {
                    if (typeof painter.getControls === "function") ctrl = painter.getControls();
                } catch (e1) { /* */ }
                if (!ctrl) ctrl = painter.control || painter.controls;
                if (ctrl) {
                    if (ctrl.object) cam = ctrl.object;
                    else if (ctrl.camera) cam = ctrl.camera;
                }
            }
            return cam || null;
        }

        function getScene(painter) {
            if (!painter || typeof painter !== "object") return null;
            if (painter.scene) return painter.scene;
            if (typeof painter.getScene === "function") {
                try { return painter.getScene(); } catch (e1) { /* */ }
            }
            return null;
        }

        function getCanvas(painter) {
            if (painter) {
                try {
                    if (painter.pad_painter && painter.pad_painter.this_pad_name != null) {
                        /* keep looking */
                    }
                    var r = painter.renderer;
                    if (r && r.domElement) return r.domElement;
                } catch (eC) { /* */ }
            }
            var list = dom.querySelectorAll("canvas");
            if (list && list.length) return list[0];
            return null;
        }

        function painterHasCamera(p) {
            return !!(p && getCamera(p));
        }

        function find3DPainter() {
            var i, p;
            if (cachedGeoPainter && painterHasCamera(cachedGeoPainter)) return cachedGeoPainter;
            for (i = 0; i < painters.length; i++) {
                p = painters[i];
                if (painterHasCamera(p)) {
                    cachedGeoPainter = p;
                    return p;
                }
            }
            var geo = findGeoExtrasPainter();
            if (painterHasCamera(geo)) {
                cachedGeoPainter = geo;
                return geo;
            }
            return geo || painters[0] || null;
        }

        function getOrbitControls(painter) {
            if (!painter) return null;
            try {
                if (typeof painter.getControls === "function") {
                    var c = painter.getControls();
                    if (c) return c;
                }
            } catch (eG) { /* */ }
            return painter.control || painter.controls || null;
        }

        function setOrbitEnabled(on) {
            var p = find3DPainter();
            if (!p) return;
            try {
                if (p.control) p.control.enabled = !!on;
                if (p.controls) p.controls.enabled = !!on;
                if (typeof p.getControls === "function") {
                    var c = p.getControls();
                    if (c) {
                        if ("enabled" in c) c.enabled = !!on;
                        if ("enableRotate" in c) c.enableRotate = !!on;
                        if ("enableZoom" in c) c.enableZoom = !!on;
                        if (on) restoreOrbitWheel(c, p);
                    }
                }
            } catch (e2) { /* */ }
        }

        function applyMatrix4Vec4(x, y, z, w, m) {
            var e = m.elements || m;
            return {
                x: e[0] * x + e[4] * y + e[8] * z + e[12] * w,
                y: e[1] * x + e[5] * y + e[9] * z + e[13] * w,
                z: e[2] * x + e[6] * y + e[10] * z + e[14] * w,
                w: e[3] * x + e[7] * y + e[11] * z + e[15] * w
            };
        }

        function unprojectNdc(mx, my, mz, camera) {
            var v = applyMatrix4Vec4(mx, my, mz, 1, camera.projectionMatrixInverse);
            v = applyMatrix4Vec4(v.x, v.y, v.z, v.w, camera.matrixWorld);
            var invW = v.w !== 0 ? 1 / v.w : 1;
            return { x: v.x * invW, y: v.y * invW, z: v.z * invW };
        }

        function rayFromCameraNdc(mx, my, camera) {
            try {
                if (typeof camera.updateMatrixWorld === "function") camera.updateMatrixWorld(true);
                if (camera.projectionMatrix && camera.projectionMatrixInverse &&
                    typeof camera.projectionMatrixInverse.copy === "function" &&
                    typeof camera.projectionMatrixInverse.invert === "function") {
                    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
                }
            } catch (eM) { /* */ }
            var origin, target, dx, dy, dz, len;
            var isOrtho = !!(camera.isOrthographicCamera ||
                (camera.left !== undefined && camera.right !== undefined && !camera.isPerspectiveCamera));
            if (isOrtho) {
                origin = unprojectNdc(mx, my, -1, camera);
                target = unprojectNdc(mx, my, 1, camera);
            } else {
                var e = camera.matrixWorld && camera.matrixWorld.elements;
                if (e) origin = { x: e[12], y: e[13], z: e[14] };
                else if (camera.position) origin = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
                else return null;
                target = unprojectNdc(mx, my, 0.5, camera);
            }
            dx = target.x - origin.x;
            dy = target.y - origin.y;
            dz = target.z - origin.z;
            len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (!(len > 1e-12)) return null;
            return {
                origin: origin,
                direction: { x: dx / len, y: dy / len, z: dz / len }
            };
        }

        function cameraRayFromClient(clientX, clientY) {
            var painter = find3DPainter();
            var canvas = getCanvas(painter);
            var camera = getCamera(painter);
            if (!canvas || !camera) return null;
            var rect = canvas.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) return null;
            var mx = ((clientX - rect.left) / rect.width) * 2 - 1;
            var my = -((clientY - rect.top) / rect.height) * 2 + 1;
            var ray = null;
            var THREE = getTHREE(painter);
            if (THREE && THREE.Raycaster) {
                try {
                    var raycaster = new THREE.Raycaster();
                    if (typeof raycaster.setFromCamera === "function") {
                        if (typeof camera.updateMatrixWorld === "function") camera.updateMatrixWorld(true);
                        raycaster.setFromCamera(
                            THREE.Vector2 ? new THREE.Vector2(mx, my) : { x: mx, y: my },
                            camera
                        );
                        if (raycaster.ray && raycaster.ray.origin && raycaster.ray.direction) {
                            ray = {
                                origin: {
                                    x: raycaster.ray.origin.x,
                                    y: raycaster.ray.origin.y,
                                    z: raycaster.ray.origin.z
                                },
                                direction: {
                                    x: raycaster.ray.direction.x,
                                    y: raycaster.ray.direction.y,
                                    z: raycaster.ray.direction.z
                                }
                            };
                        }
                    }
                } catch (eRc) {
                    ray = null;
                }
            }
            if (!ray) ray = rayFromCameraNdc(mx, my, camera);
            return ray;
        }

        function snapRayToLattice(ray) {
            if (!ray || !ray.origin || !ray.direction) return null;
            var ox = ray.origin.x, oy = ray.origin.y, oz = ray.origin.z;
            var dx = ray.direction.x, dy = ray.direction.y, dz = ray.direction.z;
            var best = null;
            var z, y, x, w, vx, vy, vz, t, cx, cy, cz, dist;
            var dLoop = dimsNow();
            for (z = 0; z < dLoop.z; z++) {
                for (y = 0; y < dLoop.y; y++) {
                    for (x = 0; x < dLoop.x; x++) {
                        if (!inClip(x, y, z)) continue;
                        w = worldOf(x, y, z);
                        vx = w.X - ox;
                        vy = w.Y - oy;
                        vz = w.Z - oz;
                        t = vx * dx + vy * dy + vz * dz;
                        if (t < -1e-3) continue;
                        cx = ox + t * dx;
                        cy = oy + t * dy;
                        cz = oz + t * dz;
                        dist = Math.sqrt(
                            (w.X - cx) * (w.X - cx) +
                            (w.Y - cy) * (w.Y - cy) +
                            (w.Z - cz) * (w.Z - cz)
                        );
                        if (dist > PICK_DIST) continue;
                        if (!best || dist < best.dist - 1e-9 ||
                            (Math.abs(dist - best.dist) < 1e-9 && t < best.t)) {
                            best = { x: x, y: y, z: z, dist: dist, t: t };
                        }
                    }
                }
            }
            return best ? { x: best.x, y: best.y, z: best.z } : null;
        }

        function pickAtClient(clientX, clientY) {
            var ray = cameraRayFromClient(clientX, clientY);
            if (!ray) return null;
            return snapRayToLattice(ray);
        }

        function cancelScheduledRestores() {
            var i;
            for (i = 0; i < restoreTimers.length; i++) {
                try { clearTimeout(restoreTimers[i]); } catch (eC) { /* */ }
            }
            restoreTimers = [];
        }

        function cancelReattachTimers() {
            var i;
            for (i = 0; i < reattachTimers.length; i++) {
                try { clearTimeout(reattachTimers[i]); } catch (eC) { /* */ }
            }
            reattachTimers = [];
        }

        function copyVec3(v) {
            if (!v) return null;
            return { x: +v.x, y: +v.y, z: +v.z };
        }

        function setVec3(dst, src) {
            if (!dst || !src) return;
            if (typeof dst.set === "function") dst.set(src.x, src.y, src.z);
            else {
                dst.x = src.x;
                dst.y = src.y;
                dst.z = src.z;
            }
        }

        function captureCameraState() {
            var painter = find3DPainter();
            var cam = getCamera(painter);
            if (!cam || !cam.position) return lastCameraState;
            var ctrl = getOrbitControls(painter);
            var st = {
                pos: copyVec3(cam.position),
                up: cam.up ? copyVec3(cam.up) : null,
                target: (ctrl && ctrl.target) ? copyVec3(ctrl.target) : null,
                zoom: (typeof cam.zoom === "number") ? cam.zoom : null
            };
            if (!st.pos || !isFinite(st.pos.x)) return lastCameraState;
            lastCameraState = st;
            return st;
        }

        function restoreCameraState(st) {
            if (!st || !st.pos) return false;
            var painter = find3DPainter();
            var cam = getCamera(painter);
            if (!cam || !cam.position) return false;
            try {
                setVec3(cam.position, st.pos);
                if (st.up && cam.up) setVec3(cam.up, st.up);
                if (st.zoom != null && typeof cam.zoom === "number") cam.zoom = st.zoom;
                var ctrl = getOrbitControls(painter);
                if (ctrl && ctrl.target && st.target) {
                    setVec3(ctrl.target, st.target);
                    if (typeof ctrl.update === "function") {
                        try { ctrl.update(); } catch (eU) { /* */ }
                    }
                } else if (st.target && typeof cam.lookAt === "function") {
                    cam.lookAt(st.target.x, st.target.y, st.target.z);
                }
                if (typeof cam.updateProjectionMatrix === "function") cam.updateProjectionMatrix();
                if (painter && typeof painter.render3D === "function") {
                    try { painter.render3D(0); } catch (eR) { /* */ }
                }
                lastCameraState = st;
                return true;
            } catch (eRest) {
                console.warn("[board3d] restoreCameraState failed", eRest);
                return false;
            }
        }

        function scheduleCameraRestore(st) {
            if (!st || !st.pos) return;
            lastCameraState = st;
            cancelScheduledRestores();
            function once() {
                if (destroyed) return;
                restoreCameraState(st);
            }
            once();
            [0, 40, 100, 160, 250, 400].forEach(function (ms) {
                restoreTimers.push(setTimeout(once, ms));
            });
        }

        function reattachStonesFromState(reason) {
            if (destroyed) return Promise.resolve(false);
            var st = null;
            try { st = getState(); } catch (eS) { st = null; }
            if (!st) return Promise.resolve(false);
            var stonesGeo = null;
            try { stonesGeo = buildStonesGeoExtract(st); } catch (eB) {
                console.warn("[board3d] reattach buildStones failed", reason, eB);
                return Promise.resolve(false);
            }
            if (!stonesGeo) return Promise.resolve(true);
            return attachStonesToGeoPainter(stonesGeo, st);
        }

        function scheduleReattachStonesAfterCameraSettle() {
            cancelReattachTimers();
            function once() { reattachStonesFromState("cameraSettle"); }
            [500, 900, 1400].forEach(function (ms) {
                reattachTimers.push(setTimeout(once, ms));
            });
        }

        function scheduleReattachStonesAfterOrbit() {
            var now = Date.now();
            if (now - lastOrbitReattachMs < 750) return;
            lastOrbitReattachMs = now;
            cancelReattachTimers();
            reattachTimers.push(setTimeout(function () {
                reattachStonesFromState("orbitEnd");
            }, 250));
        }

        function resetView() {
            cancelScheduledRestores();
            cancelReattachTimers();
            lastCameraState = null;
            var painter = find3DPainter();
            if (!painter) {
                return drawAll(getState(), { preserveCamera: false }).then(function () {
                    return false;
                });
            }
            try {
                if (typeof painter.focusCamera === "function") {
                    painter.focusCamera();
                    setOrbitEnabled(!placeMode);
                    setTimeout(function () { captureCameraState(); }, 0);
                    scheduleReattachStonesAfterCameraSettle();
                    return Promise.resolve(true);
                }
                if (typeof painter.adjustCameraPosition === "function") {
                    painter.adjustCameraPosition(true);
                    if (typeof painter.render3D === "function") painter.render3D(0);
                    setOrbitEnabled(!placeMode);
                    setTimeout(function () { captureCameraState(); }, 0);
                    scheduleReattachStonesAfterCameraSettle();
                    return Promise.resolve(true);
                }
            } catch (eF) {
                console.warn("[board3d] focusCamera failed", eF);
            }
            return drawAll(getState(), { preserveCamera: false }).then(function () {
                setTimeout(function () { captureCameraState(); }, 80);
                return true;
            });
        }

        function attachPointerHandlers() {
            var canvas = getCanvas(find3DPainter());
            if (!canvas || pointerBound) return;
            pointerBound = true;
            var downX = 0, downY = 0, downT = 0, dragging = false;

            function onDown(ev) {
                downX = ev.clientX;
                downY = ev.clientY;
                downT = Date.now();
                dragging = false;
            }
            function onMove(ev) {
                if (!placeMode) return;
                var dx = ev.clientX - downX, dy = ev.clientY - downY;
                if (dx * dx + dy * dy > DRAG_THRESH_PX * DRAG_THRESH_PX) dragging = true;
            }
            function onUp(ev) {
                var dx = ev.clientX - downX, dy = ev.clientY - downY;
                var moved = dx * dx + dy * dy > DRAG_THRESH_PX * DRAG_THRESH_PX;
                if (!placeMode) {
                    var stMark = null;
                    try { stMark = getState(); } catch (eSt) { stMark = null; }
                    if (stMark && stMark.phase === "ended" && !moved && !dragging) {
                        var markPt = pickAtClient(ev.clientX, ev.clientY);
                        if (markPt) onPlay(markPt.x, markPt.y, markPt.z);
                        return;
                    }
                    if (moved || dragging) scheduleReattachStonesAfterOrbit();
                    return;
                }
                if (moved || dragging) {
                    scheduleReattachStonesAfterOrbit();
                    return;
                }
                var pt = pickAtClient(ev.clientX, ev.clientY);
                if (pt) onPlay(pt.x, pt.y, pt.z);
            }
            canvas.addEventListener("pointerdown", onDown);
            canvas.addEventListener("pointermove", onMove);
            canvas.addEventListener("pointerup", onUp);
            canvas._go3dPlayCleanup = function () {
                canvas.removeEventListener("pointerdown", onDown);
                canvas.removeEventListener("pointermove", onMove);
                canvas.removeEventListener("pointerup", onUp);
                canvas.style.cursor = "";
                delete canvas._go3dPlayCleanup;
            };
            setOrbitEnabled(!placeMode);
        }

        function setPlaceMode(on) {
            var next = !!on;
            var st = getState();
            if (next && (!st || st.phase !== "playing")) next = false;
            placeMode = next;
            setOrbitEnabled(!placeMode);
            var c = getCanvas(find3DPainter());
            if (c) c.style.cursor = placeMode ? "crosshair" : "";
            try { onPlaceModeChange(placeMode); } catch (eP) { /* */ }
            return placeMode;
        }

        function getPlaceMode() {
            return placeMode;
        }

        function drawAll(state, opts) {
            opts = opts || {};
            var preserveCamera = opts.preserveCamera !== false;
            if (destroyed) return Promise.resolve(null);
            var camState = null;
            if (preserveCamera) camState = captureCameraState() || lastCameraState;
            else cancelScheduledRestores();

            var oldCanvas = dom.querySelector("canvas");
            if (oldCanvas && oldCanvas._go3dPlayCleanup) {
                try { oldCanvas._go3dPlayCleanup(); } catch (e7) { /* */ }
            }
            clearDom();

            var stonesGeo = null;
            var useGeoStones = false;
            if (state && USE_TGEO_STONES) {
                try {
                    stonesGeo = buildStonesGeoExtract(state);
                    useGeoStones = !!stonesGeo;
                } catch (eGeoBuild) {
                    console.warn("[board3d] TGeo stones build failed", eGeoBuild);
                }
            }

            var all = [];
            var frame = createCubeFrame();
            var rays = createAxisRays();
            var labels = createAxisLabels();
            var grid = createAxisGrid();
            var i;
            for (i = 0; i < frame.length; i++) all.push(frame[i]);
            for (i = 0; i < rays.length; i++) all.push(rays[i]);
            for (i = 0; i < labels.length; i++) all.push(labels[i]);
            for (i = 0; i < grid.length; i++) all.push(grid[i]);
            try {
                var em = createEmptyMarkers(state) || [];
                var ei;
                for (ei = 0; ei < em.length; ei++) all.push(em[ei]);
            } catch (eM) {
                console.warn("[board3d] empty markers skipped", eM);
            }

            return drawSeq(all).then(function () {
                var gp = findGeoExtrasPainter() || find3DPainter();
                muteProcessMouseMove(gp);
                muteAllPaintersMouse();
                if (useGeoStones && stonesGeo) {
                    return attachStonesToGeoPainter(stonesGeo, state);
                }
                return true;
            }).then(function () {
                muteAllPaintersMouse();
                attachPointerHandlers();
                if (preserveCamera && (camState || lastCameraState)) {
                    scheduleCameraRestore(camState || lastCameraState);
                } else {
                    setTimeout(function () { captureCameraState(); }, 120);
                }
                setOrbitEnabled(!placeMode);
                return painters;
            }).catch(function (err) {
                console.error("[board3d] draw failed", err);
                clearDom();
                var div = document.createElement("div");
                div.style.padding = "8px";
                div.style.color = "#666";
                div.textContent = "3D lattice draw issue: " +
                    String(err && err.message ? err.message : err);
                dom.appendChild(div);
            });
        }

        var ready = drawAll(opts.state || getState(), { preserveCamera: false });

        return {
            kind: "3d",
            rootClass: "TPolyLine3D+TGeoSphere(extras)",
            clickToPlay: false,
            setPlaceMode: setPlaceMode,
            getPlaceMode: getPlaceMode,
            pickAtClient: pickAtClient,
            redrawLattice: function (state) {
                // Clip changed: rebuild frame+grid. First TPolyLine3D is the
                // main draw, so this remounts painters and restores the camera.
                return drawAll(state, { preserveCamera: true });
            },
            redraw: function (state) {
                // Lattice painter stays. Stones extras + empty markers follow state.board.
                var geop = findGeoExtrasPainter();
                if (!geop || typeof geop.drawExtras !== "function") {
                    return drawAll(state, { preserveCamera: true });
                }
                muteProcessMouseMove(geop);
                muteAllPaintersMouse();
                var stonesGeo = null;
                try {
                    stonesGeo = state ? buildStonesGeoExtract(state) : null;
                } catch (eB) {
                    console.warn("[board3d] incremental stones build failed", eB);
                    return drawAll(state, { preserveCamera: true });
                }
                var stonesP;
                if (!stonesGeo) {
                    wipeNamedExtras(geop, STONES_EXTRAS_NAME);
                    try {
                        if (typeof geop.render3D === "function") geop.render3D(0);
                    } catch (eR) { /* */ }
                    stonesP = Promise.resolve(true);
                } else {
                    stonesP = attachStonesToGeoPainter(stonesGeo, state);
                }
                return stonesP.then(function () {
                    return refreshEmptyMarkers(state);
                }).then(function () {
                    muteAllPaintersMouse();
                    muteControlHover(getOrbitControls(geop));
                    return true;
                });
            },
            resetView: resetView,
            destroy: function () {
                destroyed = true;
                placeMode = false;
                cancelScheduledRestores();
                cancelReattachTimers();
                var c = dom.querySelector("canvas");
                if (c && c._go3dPlayCleanup) {
                    try { c._go3dPlayCleanup(); } catch (e8) { /* */ }
                }
                clearDom();
            },
            whenReady: function () { return ready; }
        };
    }

    GoGame.Board3D = {
        mount: mount,
        worldOf: worldOf,
        SIZE: 4,
        CELL: CELL,
        STONE_R: STONE_R,
        PICK_DIST: PICK_DIST,
        buildStonesGeoExtract: buildStonesGeoExtract,
        createCubeFrame: createCubeFrame,
        createAxisGrid: createAxisGrid,
        createAxisLabels: createAxisLabels,
        clipNow: clipNow,
        inClip: inClip,
        clampClip: clampClip,
        fullClipOf: fullClipOf,
        resetClipToFull: resetClipToFull,
        USE_TGEO_STONES: true,
        GEO_RGBA_BLACK: GEO_RGBA_BLACK,
        GEO_RGBA_WHITE: GEO_RGBA_WHITE,
        STONE_EXTRAS_NUMFACES: STONE_EXTRAS_NUMFACES,
        STONE_EXTRAS_NUMNODES: STONE_EXTRAS_NUMNODES
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_board3d] ready (spatial 4×4×4 lattice)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
