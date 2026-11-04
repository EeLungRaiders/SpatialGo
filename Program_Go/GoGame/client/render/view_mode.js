/**
 * GoGame.Render view mode — P1 spatial Go is 3D only.
 * setMode('2d') is ignored (not a playable board).
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};
    var mode = "3d";
    var listeners = [];

    function getMode() {
        return mode;
    }

    function setMode(m) {
        if (m !== "3d") {
            mode = "3d";
            return mode;
        }
        if (mode === m) return mode;
        mode = "3d";
        var i;
        for (i = 0; i < listeners.length; i++) {
            try { listeners[i](mode); } catch (e) { console.error(e); }
        }
        return mode;
    }

    function onModeChange(fn) {
        if (typeof fn === "function") listeners.push(fn);
    }

    GoGame.Render = GoGame.Render || {};
    GoGame.Render.getMode = getMode;
    GoGame.Render.setMode = setMode;
    GoGame.Render.onModeChange = onModeChange;

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_view_mode] ready (3d only)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
