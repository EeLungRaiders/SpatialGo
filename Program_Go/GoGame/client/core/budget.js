/**
 * GoGame.Budget — static full-board 3D cost estimate (26_3 / Plans/26_0 §4).
 *
 * Pure JS for 26_4 UI / console. Does NOT measure live browser RSS or WebGL VRAM.
 * Single-frame static model only — cannot explain per-move rebuild leak slopes (23_0).
 * Server nvidia-smi (26_2) is whole-device GPU, not this estimate.
 *
 * Constants aligned with board3d.js (fNseg=16, fNz=12; white = single TGeo sphere).
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};

    /** ~2 * fNseg * fNz triangles per independent TGeoSphere (coarse). */
    var TRIS_PER_SPHERE_EST = 2 * 16 * 12; // 384
    var F_NSEG = 16;
    var F_NZ = 12;
    /**
     * Rough bytes/tri for static full-board WebGL+JSROOT overhead (26_7).
     * Amortizes verts/idx + per-mesh Eve/THREE cost. Order-of-magnitude only —
     * NOT calibrated to tab RSS / Firefox RES / live VRAM (see Plans/26_0 §4).
     */
    var BYTES_PER_TRI_ROUGH = 2048;
    var BYTES_PER_GIB = 1024 * 1024 * 1024;
    /** Marker path: black + white body + white outline TPolyMarker3D objects. */
    var MARKER_STONE_OBJECTS = 3;
    /** Slab hatch line count order-of-magnitude (board3d createSlabObjects). */
    var SLAB_LINES_EST = 60;
    /** Rough stroke polylines per edge label glyph (coords are stroke text). */
    var COORD_STROKES_PER_GLYPH_EST = 4;

    function dimBounds() {
        var St = GoGame.State;
        return {
            min: (St && St.MIN_SIZE != null) ? St.MIN_SIZE : 1,
            max: (St && St.MAX_SIZE != null) ? St.MAX_SIZE : 50
        };
    }

    function normalizeDim(n, label) {
        var b = dimBounds();
        if (typeof n !== "number" || !isFinite(n) || Math.floor(n) !== n) {
            return { ok: false, message: "GoGame.Budget: " + label + " must be an integer" };
        }
        if (n < b.min || n > b.max) {
            return {
                ok: false,
                message: "GoGame.Budget: " + label + " must be in [" + b.min + ", " + b.max + "] (got " + n + ")"
            };
        }
        return { ok: true, value: n };
    }

    function hoshiCount(width, height) {
        if (GoGame.Board2D && typeof GoGame.Board2D.hoshiPoints === "function") {
            try {
                var pts = GoGame.Board2D.hoshiPoints(width, height);
                return pts && pts.length ? pts.length : 0;
            } catch (e) { /* fall through */ }
        }
        // Conservative upper bound if Board2D not loaded (densify ≤ ~9×9).
        return Math.min(width * height, 81);
    }

    /**
     * estimate3dBudget(width, height, mode?)
     * @param {number} width
     * @param {number} height
     * @param {string} [mode] "sphere" (default, product path) | "marker"
     * @returns {{ ok:boolean, message?:string, width?:number, height?:number, N?:number,
     *   mode?:string, sphere?:object, marker?:object, framework?:object, caveats?:string[] }}
     */
    function estimate3dBudget(width, height, mode) {
        var ww = normalizeDim(width, "width");
        if (!ww.ok) return ww;
        var hh = normalizeDim(height, "height");
        if (!hh.ok) return hh;
        width = ww.value;
        height = hh.value;

        mode = (mode == null || mode === "") ? "sphere" : String(mode).toLowerCase();
        if (mode !== "sphere" && mode !== "marker") {
            return { ok: false, message: "GoGame.Budget: mode must be \"sphere\" or \"marker\"" };
        }

        var N = width * height;
        var gridLines = width + height;
        var hoshi = hoshiCount(width, height);
        // Both board edges labeled (top/bottom cols, left/right rows) — order-of-magnitude.
        var edgeGlyphSlots = 2 * width + 2 * height;
        var coordStrokeEst = edgeGlyphSlots * COORD_STROKES_PER_GLYPH_EST;

        var framework = {
            gridLines: gridLines,
            hoshiPts: hoshi,
            hoshiMarkerObjects: 1,
            coordGlyphSlotsEst: edgeGlyphSlots,
            coordStrokePolylinesEst: coordStrokeEst,
            coordCostNote: "O((W+H) * strokes_per_glyph); stroke TPolyLine3D labels, heavier on large boards",
            slabLinesEst: SLAB_LINES_EST
        };

        // Sphere (current product: USE_TGEO_STONES / per-stone TGeoSphere, white single ball)
        var trisEst = N * TRIS_PER_SPHERE_EST;
        var gbEstRough = trisEst * BYTES_PER_TRI_ROUGH / BYTES_PER_GIB;
        var sphere = {
            stones: N,
            eveNodes: N,
            fNseg: F_NSEG,
            fNz: F_NZ,
            trisPerSphereEst: TRIS_PER_SPHERE_EST,
            trisEst: trisEst,
            /** Static rough GB from tris×BYTES_PER_TRI_ROUGH; ≠ tab RSS. */
            gbEstRough: gbEstRough,
            bytesPerTriRough: BYTES_PER_TRI_ROUGH,
            whiteOutlineExtraSpheres: 0,
            note: "Independent TGeoSphere per stone (no shared geometry); coarse tris = N*384; gbEstRough = tris*2048/GiB (粗估)"
        };

        // Marker contrast (withdrawn alternative; kept for comparison)
        var nWhiteApprox = Math.floor(N / 2);
        var marker = {
            stoneMarkerObjects: MARKER_STONE_OBJECTS,
            bodyPointsEst: N,
            whiteOutlinePointsEst: nWhiteApprox,
            pointsTotalEst: N + nWhiteApprox,
            note: "Three TPolyMarker3D (black, white, whiteOutline); much lighter than per-stone spheres"
        };

        return {
            ok: true,
            width: width,
            height: height,
            N: N,
            mode: mode,
            primary: mode === "sphere" ? sphere : marker,
            sphere: sphere,
            marker: marker,
            framework: framework,
            caveats: [
                "Static single-frame estimate only — not live tab RSS or WebGL VRAM",
                "Does not model per-move clearDom/rebuild leak slopes",
                "Browser JSROOT/WebGL is the 3D battlefield; Server nvidia-smi is whole-device",
                "trisEst is coarse (2*fNseg*fNz); JSROOT/THREE may differ",
                "gbEstRough uses BYTES_PER_TRI_ROUGH=2048; coarse order-of-magnitude, not live tab RSS"
            ]
        };
    }

    GoGame.Budget = {
        estimate3dBudget: estimate3dBudget,
        TRIS_PER_SPHERE_EST: TRIS_PER_SPHERE_EST,
        BYTES_PER_TRI_ROUGH: BYTES_PER_TRI_ROUGH,
        F_NSEG: F_NSEG,
        F_NZ: F_NZ
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_budget] ready — GoGame.Budget.estimate3dBudget(W,H)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
