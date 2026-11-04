/**
 * GoGame.Coords — per-axis display: user = 2*index - (n-1), step 2.
 * n may differ per axis (sizeX/Y/Z). Internal flood still ±1.
 */
(function (global) {
    "use strict";

    var GoGame = global.GoGame = global.GoGame || {};

    function dimsOf(n) {
        var k;
        if (n && typeof n === "object") {
            if (n.sizeX != null) {
                return {
                    x: n.sizeX | 0,
                    y: (n.sizeY != null ? n.sizeY : n.sizeX) | 0,
                    z: (n.sizeZ != null ? n.sizeZ : n.sizeX) | 0
                };
            }
            if (Array.isArray(n) && n.length === 3) {
                return { x: n[0] | 0, y: n[1] | 0, z: n[2] | 0 };
            }
            if (n.size != null && isFinite(n.size)) {
                k = n.size | 0;
                return { x: k, y: k, z: k };
            }
        }
        if (n != null && isFinite(n)) {
            k = n | 0;
            return { x: k, y: k, z: k };
        }
        var st = GoGame.session && GoGame.session.state;
        if (st && st.sizeX != null) {
            return { x: st.sizeX | 0, y: st.sizeY | 0, z: st.sizeZ | 0 };
        }
        if (st && st.size != null) {
            k = st.size | 0;
            return { x: k, y: k, z: k };
        }
        var St = GoGame.State;
        k = (St && (St.DEFAULT_SIZE || St.SIZE)) || 4;
        return { x: k, y: k, z: k };
    }

    function sizeN(n) {
        return dimsOf(n).x;
    }

    function axisToUser(index, n) {
        n = (n != null && isFinite(n)) ? (n | 0) : sizeN(n);
        return 2 * index - (n - 1);
    }

    function axisFromUser(user, n) {
        n = (n != null && isFinite(n)) ? (n | 0) : sizeN(n);
        if (typeof user !== "number" || !isFinite(user)) return null;
        if (Math.floor(user) !== user) return null;
        var num = user + (n - 1);
        if (num % 2 !== 0) return null;
        var i = num / 2;
        if (i < 0 || i >= n || i !== (i | 0)) return null;
        return i;
    }

    function toUser(ix, iy, iz, n) {
        if (ix && typeof ix === "object" && ix.x != null) {
            n = iy != null ? iy : ix;
            return toUser(ix.x, ix.y, ix.z, n);
        }
        var d = dimsOf(n);
        if (ix == null || iy == null || iz == null) return null;
        if (ix < 0 || iy < 0 || iz < 0 || ix >= d.x || iy >= d.y || iz >= d.z) return null;
        return {
            x: axisToUser(ix, d.x),
            y: axisToUser(iy, d.y),
            z: axisToUser(iz, d.z)
        };
    }

    function fromUser(x, y, z, n) {
        if (x && typeof x === "object" && x.x != null) {
            n = y != null ? y : x;
            return fromUser(x.x, x.y, x.z, n);
        }
        var d = dimsOf(n);
        var ix = axisFromUser(x, d.x);
        var iy = axisFromUser(y, d.y);
        var iz = axisFromUser(z, d.z);
        if (ix == null || iy == null || iz == null) return null;
        return { ix: ix, iy: iy, iz: iz };
    }

    function formatUser(ix, iy, iz, n) {
        var u = toUser(ix, iy, iz, n);
        if (!u) return "?";
        return "(" + u.x + "," + u.y + "," + u.z + ")";
    }

    GoGame.Coords = {
        toUser: toUser,
        fromUser: fromUser,
        formatUser: formatUser,
        axisToUser: axisToUser,
        axisFromUser: axisFromUser,
        sizeN: sizeN,
        dimsOf: dimsOf
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_coords] ready (per-axis step 2)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
