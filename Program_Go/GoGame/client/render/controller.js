/**
 * GoGame.Render controller — P1 spatial: Board3D only.
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};

    function ensureSession() {
        if (!GoGame.session) {
            GoGame.session = {
                state: GoGame.State.newGame(),
                stoneColors: {
                    first: [0.06, 0.06, 0.06, 1],
                    second: [1.0, 1.0, 1.0, 1]
                }
            };
        }
        return GoGame.session;
    }

    function mountBoardImpl(ctx) {
        try {
            if (ctx.boardView && ctx.boardView.destroy) ctx.boardView.destroy();
        } catch (e) {
            console.warn("[controller] boardView.destroy", e);
        }
        ctx.boardView = null;
        while (ctx.boardHost.firstChild) ctx.boardHost.removeChild(ctx.boardHost.firstChild);
        if (ctx.toolbar && ctx.toolbar.style) ctx.toolbar.style.zIndex = "10000";
        ctx.boardHost.style.zIndex = "0";

        GoGame.Render.setMode("3d");
        ctx.boardView = GoGame.Board3D.mount(ctx.boardHost, {
            state: ctx.session.state,
            onPlayRequest: ctx.onPlayRequest,
            getState: function () { return ctx.session.state; },
            onPlaceModeChange: ctx.onPlaceModeChange
        });
        if (ctx.boardView.whenReady) {
            ctx.boardView.whenReady().then(function () {
                var p = Promise.resolve(null);
                if (ctx.boardView && ctx.boardView.redraw) {
                    p = Promise.resolve(ctx.boardView.redraw(ctx.session.state));
                }
                return p;
            }).then(function () {
                if (ctx.resetViewOnEnter3d && ctx.boardView &&
                    typeof ctx.boardView.resetView === "function") {
                    return ctx.boardView.resetView();
                }
            }).catch(function (e) {
                ctx.statusMsg = "3D draw error: " + (e && e.message ? e.message : e);
                ctx.updateStatus();
            });
        }
        ctx.updateStatus();
    }

    function mountBoard(boardHost, opts) {
        opts = opts || {};
        var session = opts.session || ensureSession();
        var statusMsg = "";
        var boardView = null;
        var playHandler = typeof opts.onPlayRequest === "function" ? opts.onPlayRequest : null;
        var lastBoardMode = null;

        function updateStatus() {
            if (typeof opts.onStatus === "function") {
                opts.onStatus(statusMsg, session.state);
            }
        }

        function onPlayRequest(x, y, z) {
            if (playHandler) {
                playHandler(x, y, z);
                return;
            }
            var r = GoGame.Rules.play(session.state, x, y, z);
            if (r.ok) {
                session.state = r.state;
                statusMsg = "ok";
                redraw();
            } else {
                statusMsg = r.message || "illegal";
                updateStatus();
            }
        }

        function remount() {
            GoGame.Render.setMode("3d");
            var entering3d = lastBoardMode !== "3d";
            var ctx = {
                boardView: boardView,
                boardHost: boardHost,
                toolbar: opts.toolbar || null,
                session: session,
                onPlayRequest: onPlayRequest,
                onPlaceModeChange: opts.onPlaceModeChange,
                statusMsg: statusMsg,
                updateStatus: updateStatus,
                resetViewOnEnter3d: entering3d
            };
            mountBoardImpl(ctx);
            boardView = ctx.boardView;
            statusMsg = ctx.statusMsg;
            lastBoardMode = "3d";
        }

        function redraw() {
            if (boardView && boardView.redraw) {
                var p = boardView.redraw(session.state);
                if (p && typeof p.then === "function") {
                    p.catch(function (e) { console.error(e); });
                }
            }
            updateStatus();
        }

        GoGame.Render.setMode("3d");
        remount();

        return {
            render: function (state) {
                if (state) session.state = state;
                redraw();
            },
            renderLattice: function (state) {
                if (state) session.state = state;
                if (boardView && typeof boardView.redrawLattice === "function") {
                    var p = boardView.redrawLattice(session.state);
                    if (p && typeof p.then === "function") {
                        p.catch(function (e) { console.error(e); });
                    }
                    updateStatus();
                    return p;
                }
                remount();
            },
            remount: remount,
            setPlaceMode: function (on) {
                if (boardView && typeof boardView.setPlaceMode === "function") {
                    return boardView.setPlaceMode(on);
                }
                return false;
            },
            getPlaceMode: function () {
                if (boardView && typeof boardView.getPlaceMode === "function") {
                    return boardView.getPlaceMode();
                }
                return false;
            },
            pickAtClient: function (clientX, clientY, opts) {
                if (boardView && typeof boardView.pickAtClient === "function") {
                    return boardView.pickAtClient(clientX, clientY, opts);
                }
                return null;
            },
            resetView: function () {
                if (boardView && typeof boardView.resetView === "function") {
                    return boardView.resetView();
                }
                return Promise.resolve(false);
            },
            onPlayRequest: function (fn) {
                playHandler = fn;
            },
            setMode: function () {
                GoGame.Render.setMode("3d");
                remount();
            },
            getMode: function () {
                return "3d";
            },
            getState: function () {
                return session.state;
            },
            setState: function (s) {
                session.state = s;
                redraw();
            },
            destroy: function () {
                if (boardView && boardView.destroy) boardView.destroy();
                boardView = null;
                while (boardHost.firstChild) boardHost.removeChild(boardHost.firstChild);
            }
        };
    }

    GoGame.Render = GoGame.Render || {};
    GoGame.Render.mountBoard = mountBoard;
    GoGame.Render.mountBoardImpl = mountBoardImpl;

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_render_ctrl] ready (3d spatial)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
