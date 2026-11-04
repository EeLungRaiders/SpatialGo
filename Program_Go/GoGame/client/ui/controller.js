/**
 * GoGame.UI — spatial hotseat chrome. Board body is Board3D (ROOT).
 * No 2D mode. No SGF (record is Go3D JSON).
 * Size, komi, moves per turn, Pass, Resign, score, clip.
 */
(function (global) {
    "use strict";
    var GoGame = global.GoGame = global.GoGame || {};
    var _ui = null;

    var DEFAULT_FIRST = [0.06, 0.06, 0.06, 1];
    var DEFAULT_SECOND = [1.0, 1.0, 1.0, 1];
    var COLOR_MIN_DIST = 0.28;

    function rgbaToHex(rgba) {
        function h(n) {
            var v = Math.round(Math.max(0, Math.min(1, n)) * 255);
            var s = v.toString(16);
            return s.length === 1 ? "0" + s : s;
        }
        return "#" + h(rgba[0]) + h(rgba[1]) + h(rgba[2]);
    }
    function hexToRgba(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
        if (!m) return null;
        var n = parseInt(m[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    function colorDist(a, b) {
        var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }
    function defaultStoneColors() {
        return { first: DEFAULT_FIRST.slice(), second: DEFAULT_SECOND.slice() };
    }

    function ensureSession() {
        if (!GoGame.session) {
            GoGame.session = { state: GoGame.State.newGame(), stoneColors: defaultStoneColors() };
        }
        if (!GoGame.session.stoneColors) {
            GoGame.session.stoneColors = defaultStoneColors();
        }
        if (!GoGame.session.clip) {
            if (GoGame.Board3D && typeof GoGame.Board3D.resetClipToFull === "function") {
                GoGame.Board3D.resetClipToFull(GoGame.session.state);
            } else {
                var st0 = GoGame.session.state;
                var nx = ((st0 && (st0.sizeX != null ? st0.sizeX : st0.size)) || 4) - 1;
                var ny = ((st0 && (st0.sizeY != null ? st0.sizeY : st0.size)) || 4) - 1;
                var nz = ((st0 && (st0.sizeZ != null ? st0.sizeZ : st0.size)) || 4) - 1;
                GoGame.session.clip = {
                    x0: 0, x1: nx, y0: 0, y1: ny, z0: 0, z1: nz, fade: 0
                };
            }
        }
        return GoGame.session;
    }

    function colorName(c) {
        if (c === GoGame.State.BLACK) return "Black";
        if (c === GoGame.State.WHITE) return "White";
        return "?";
    }

    function isDedicatedGoPage() {
        try {
            return !!(document.getElementById("go-app"));
        } catch (e) {
            return false;
        }
    }

    function btnStyle() {
        return "position:relative;z-index:10001;pointer-events:auto;cursor:pointer;" +
            "padding:4px 10px;font-size:13px;border:1px solid #888;border-radius:4px;" +
            "background:#fff;color:#111;";
    }

    function formatMemGBFromMB(mb) {
        if (mb == null || mb < 0 || !isFinite(mb)) return "n/a";
        return (mb / 1024).toFixed(2) + " GB";
    }

    function formatRssKB(kb) {
        if (kb == null || kb < 0 || !isFinite(kb)) return "n/a";
        return (kb / 1024 / 1024).toFixed(2) + " GB";
    }

    function fmtPoint(p) {
        var C = GoGame.Coords;
        if (C && typeof C.formatUser === "function") {
            var sess = GoGame.session;
            return C.formatUser(p, sess && sess.state);
        }
        if (!p || p.x == null) return "?";
        return "(" + p.x + "," + p.y + "," + p.z + ")";
    }

    function sizeBanner(st) {
        if (!st) return "4×4×4";
        var sx = st.sizeX != null ? st.sizeX : st.size;
        var sy = st.sizeY != null ? st.sizeY : st.size;
        var sz = st.sizeZ != null ? st.sizeZ : st.size;
        return sx + "×" + sy + "×" + sz;
    }

    function mount(outerDom) {
        var session = ensureSession();
        var boardCtrl = null;
        var placeMode = false;
        var handDragging = false;
        var lastHandPick = null;
        var messageText = "Message: 3D lattice — rotate/zoom. Place or drag Hand to play.";
        var SYSMON_AUTO_EVERY_MOVES = 25;
        var lastSysMonFetchAtMoves = -1;
        var lastSysSnap = null;

        if (outerDom && outerDom.style) {
            outerDom.style.overflow = "hidden";
            if (isDedicatedGoPage()) {
                outerDom.style.height = "calc(100vh - 36px)";
                outerDom.style.flex = "1 1 auto";
                outerDom.style.display = "flex";
                outerDom.style.flexDirection = "column";
            } else {
                outerDom.style.height = "100%";
            }
        }

        while (outerDom.firstChild) outerDom.removeChild(outerDom.firstChild);

        var wrap = document.createElement("div");
        wrap.setAttribute("data-go-ui-root", "1");
        wrap.style.cssText =
            "display:flex;flex-direction:column;height:100%;min-height:0;width:100%;" +
            "font-family:sans-serif;position:relative;overflow:hidden;box-sizing:border-box;";

        function makeBtn(label) {
            var b = document.createElement("button");
            b.type = "button";
            b.textContent = label;
            b.style.cssText = btnStyle();
            return b;
        }

        var topBar = document.createElement("div");
        topBar.setAttribute("data-go-ui-chrome", "1");
        topBar.style.cssText =
            "flex:0 0 auto;position:relative;z-index:10000;isolation:isolate;" +
            "pointer-events:auto;padding:6px 8px;background:#f0f0f0;" +
            "border-bottom:1px solid #ccc;display:flex;flex-direction:column;gap:4px;";

        var playerBanner = document.createElement("div");
        playerBanner.setAttribute("data-go-to-play", "1");
        playerBanner.style.cssText = "font-size:16px;font-weight:700;color:#111;";

        var meta = document.createElement("div");
        meta.style.cssText = "font-size:12px;color:#333;";

        var playerRow = document.createElement("div");
        playerRow.style.cssText = "display:flex;flex-wrap:wrap;gap:10px 14px;align-items:baseline;";
        playerRow.appendChild(playerBanner);
        playerRow.appendChild(meta);

        var controls = document.createElement("div");
        controls.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;align-items:center;";

        var btnPlace = makeBtn("Place");
        btnPlace.title = "Click-to-place on the 3D lattice (orbit paused)";
        var btnResetView = makeBtn("Reset view");
        var btnUndo = makeBtn("Undo");
        var btnNew = makeBtn("New Game");
        btnNew.title = "New game with X/Y/Z from the three size menus";
        function makeAxisSelect(letter, axisKey) {
            var lab = document.createElement("label");
            lab.style.cssText = "display:flex;align-items:center;gap:3px;font-size:12px;";
            lab.appendChild(document.createTextNode(letter));
            var sel = document.createElement("select");
            sel.title = letter + " edge 1..9 (default 4)";
            sel.setAttribute("data-go-size-" + axisKey, "1");
            var si;
            for (si = 1; si <= 9; si++) {
                var opt = document.createElement("option");
                opt.value = String(si);
                opt.textContent = String(si);
                if (si === 4) opt.selected = true;
                sel.appendChild(opt);
            }
            lab.appendChild(sel);
            return { lab: lab, sel: sel };
        }
        var axX = makeAxisSelect("X", "x");
        var axY = makeAxisSelect("Y", "y");
        var axZ = makeAxisSelect("Z", "z");
        var selX = axX.sel, selY = axY.sel, selZ = axZ.sel;
        var sizeWrap = document.createElement("span");
        sizeWrap.style.cssText = "display:flex;align-items:center;gap:6px;";
        sizeWrap.appendChild(axX.lab);
        sizeWrap.appendChild(axY.lab);
        sizeWrap.appendChild(axZ.lab);
        var btnCube = makeBtn("Cube");
        btnCube.title = "Set X=Y=Z=4; New Game to apply";
        sizeWrap.appendChild(btnCube);
        function makeKomiSelect() {
            var lab = document.createElement("label");
            lab.style.cssText = "display:flex;align-items:center;gap:3px;font-size:12px;";
            lab.appendChild(document.createTextNode("Komi"));
            var sel = document.createElement("select");
            sel.title = "Komi for White (New Game to apply)";
            sel.setAttribute("data-go-komi", "1");
            var ki, kv, kopt;
            for (ki = 0; ki <= 19; ki++) {
                kv = ki + 0.5;
                kopt = document.createElement("option");
                kopt.value = String(kv);
                kopt.textContent = String(kv);
                if (kv === 6.5) kopt.selected = true;
                sel.appendChild(kopt);
            }
            lab.appendChild(sel);
            return { lab: lab, sel: sel };
        }
        function makeMovesSelect() {
            var lab = document.createElement("label");
            lab.style.cssText = "display:flex;align-items:center;gap:3px;font-size:12px;";
            lab.appendChild(document.createTextNode("Moves"));
            var sel = document.createElement("select");
            sel.title = "Stones per turn, both colors (New Game to apply)";
            sel.setAttribute("data-go-moves-per-turn", "1");
            var mi, mopt;
            for (mi = 1; mi <= 6; mi++) {
                mopt = document.createElement("option");
                mopt.value = String(mi);
                mopt.textContent = String(mi);
                if (mi === 1) mopt.selected = true;
                sel.appendChild(mopt);
            }
            lab.appendChild(sel);
            return { lab: lab, sel: sel };
        }
        var komiBox = makeKomiSelect();
        var movesBox = makeMovesSelect();
        var selKomi = komiBox.sel, selMoves = movesBox.sel;
        sizeWrap.appendChild(komiBox.lab);
        sizeWrap.appendChild(movesBox.lab);
        function syncSizeSelectsFromState(st) {
            if (!st) return;
            var sx = st.sizeX != null ? st.sizeX : st.size;
            var sy = st.sizeY != null ? st.sizeY : st.size;
            var sz = st.sizeZ != null ? st.sizeZ : st.size;
            selX.value = String(sx != null ? sx : 4);
            selY.value = String(sy != null ? sy : 4);
            selZ.value = String(sz != null ? sz : 4);
        }
        function syncKomiMovesSelectsFromState(st) {
            if (!st) return;
            if (st.komi != null) selKomi.value = String(st.komi);
            if (st.movesPerTurn != null) selMoves.value = String(st.movesPerTurn);
        }
        var btnPass = makeBtn("Pass");
        var btnResign = makeBtn("Resign");
        var btnScore = makeBtn("Score");
        btnPass.title = "Pass (two passes → mark dead then score)";
        btnResign.title = "Resign — opponent wins, no territory score";
        btnScore.title = "Compute territory score after marking dead";

        var firstLab = document.createElement("label");
        firstLab.style.cssText = "display:flex;align-items:center;gap:4px;font-size:12px;";
        firstLab.appendChild(document.createTextNode("First"));
        var firstColor = document.createElement("input");
        firstColor.type = "color";
        firstColor.title = "First-player appearance (Black)";
        firstLab.appendChild(firstColor);
        var secondLab = document.createElement("label");
        secondLab.style.cssText = "display:flex;align-items:center;gap:4px;font-size:12px;";
        secondLab.appendChild(document.createTextNode("Second"));
        var secondColor = document.createElement("input");
        secondColor.type = "color";
        secondColor.title = "Second-player appearance (White)";
        secondLab.appendChild(secondColor);
        var btnDefaults = makeBtn("Defaults");
        btnDefaults.title = "Black / white with current white rim";

        function syncColorInputsFromSession() {
            var sc = session.stoneColors || defaultStoneColors();
            firstColor.value = rgbaToHex(sc.first);
            secondColor.value = rgbaToHex(sc.second);
        }
        syncColorInputsFromSession();

        [btnPlace, btnResetView, btnUndo, btnNew, sizeWrap, btnPass, btnResign, btnScore,
            firstLab, secondLab, btnDefaults].forEach(function (b) {
            controls.appendChild(b);
        });
        topBar.appendChild(playerRow);
        topBar.appendChild(controls);

        function axisLenOf(st, axis) {
            if (!st) return 4;
            if (axis === "x" && st.sizeX != null) return st.sizeX | 0;
            if (axis === "y" && st.sizeY != null) return st.sizeY | 0;
            if (axis === "z" && st.sizeZ != null) return st.sizeZ | 0;
            if (st.size != null) return st.size | 0;
            return 4;
        }
        function userOfAxis(axis, index) {
            var C = GoGame.Coords;
            var n = axisLenOf(session.state, axis);
            if (C && typeof C.axisToUser === "function") return C.axisToUser(index, n);
            return index;
        }
        function persistClipFade() {
            if (GoGame.Board3D && typeof GoGame.Board3D.resetClipToFull === "function") {
                return GoGame.Board3D.resetClipToFull(session.state);
            }
            var fade = session.clip && isFinite(session.clip.fade) ? +session.clip.fade : 0;
            session.clip = {
                x0: 0, x1: axisLenOf(session.state, "x") - 1,
                y0: 0, y1: axisLenOf(session.state, "y") - 1,
                z0: 0, z1: axisLenOf(session.state, "z") - 1,
                fade: fade
            };
            return session.clip;
        }

        var clipBar = document.createElement("div");
        clipBar.setAttribute("data-go-clip", "1");
        clipBar.style.cssText =
            "display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;" +
            "font-size:11px;color:#222;";
        function makeClipSlider(axis, bound, title) {
            var lab = document.createElement("label");
            lab.style.cssText = "display:flex;align-items:center;gap:4px;";
            var cap = document.createElement("span");
            cap.setAttribute("data-go-clip-cap-" + axis + bound, "1");
            var inp = document.createElement("input");
            inp.type = "range";
            inp.min = "0";
            inp.step = "1";
            inp.title = title;
            inp.setAttribute("data-go-clip-" + axis + bound, "1");
            inp.style.cssText = "width:72px;";
            lab.appendChild(cap);
            lab.appendChild(inp);
            return { lab: lab, cap: cap, inp: inp };
        }
        var clipX0 = makeClipSlider("x", "0", "X min");
        var clipX1 = makeClipSlider("x", "1", "X max");
        var clipY0 = makeClipSlider("y", "0", "Y min");
        var clipY1 = makeClipSlider("y", "1", "Y max");
        var clipZ0 = makeClipSlider("z", "0", "Z min");
        var clipZ1 = makeClipSlider("z", "1", "Z max");
        var fadeLab = document.createElement("label");
        fadeLab.style.cssText = "display:flex;align-items:center;gap:4px;";
        var fadeCap = document.createElement("span");
        fadeCap.setAttribute("data-go-clip-fade-cap", "1");
        var fadeInp = document.createElement("input");
        fadeInp.type = "range";
        fadeInp.min = "0";
        fadeInp.max = "1";
        fadeInp.step = "0.05";
        fadeInp.value = "0";
        fadeInp.title = "Outside fade (0=hide, 1=solid)";
        fadeInp.setAttribute("data-go-clip-fade", "1");
        fadeInp.style.cssText = "width:72px;";
        fadeLab.appendChild(fadeCap);
        fadeLab.appendChild(fadeInp);
        var btnShowAll = makeBtn("Show all");
        btnShowAll.title = "Full intervals; fade unchanged";
        [clipX0.lab, clipX1.lab, clipY0.lab, clipY1.lab, clipZ0.lab, clipZ1.lab,
            fadeLab, btnShowAll].forEach(function (el) {
            clipBar.appendChild(el);
        });
        topBar.appendChild(clipBar);

        function syncClipCaps() {
            var c = session.clip || persistClipFade();
            clipX0.cap.textContent = "X " + userOfAxis("x", c.x0);
            clipX1.cap.textContent = "… " + userOfAxis("x", c.x1);
            clipY0.cap.textContent = "Y " + userOfAxis("y", c.y0);
            clipY1.cap.textContent = "… " + userOfAxis("y", c.y1);
            clipZ0.cap.textContent = "Z " + userOfAxis("z", c.z0);
            clipZ1.cap.textContent = "… " + userOfAxis("z", c.z1);
            fadeCap.textContent = "fade " + (Math.round((c.fade || 0) * 100) / 100);
        }
        function syncClipSlidersFromSession() {
            var nx = Math.max(0, axisLenOf(session.state, "x") - 1);
            var ny = Math.max(0, axisLenOf(session.state, "y") - 1);
            var nz = Math.max(0, axisLenOf(session.state, "z") - 1);
            clipX0.inp.max = clipX1.inp.max = String(nx);
            clipY0.inp.max = clipY1.inp.max = String(ny);
            clipZ0.inp.max = clipZ1.inp.max = String(nz);
            var c = session.clip || persistClipFade();
            clipX0.inp.value = String(c.x0);
            clipX1.inp.value = String(c.x1);
            clipY0.inp.value = String(c.y0);
            clipY1.inp.value = String(c.y1);
            clipZ0.inp.value = String(c.z0);
            clipZ1.inp.value = String(c.z1);
            fadeInp.value = String(c.fade != null ? c.fade : 0);
            syncClipCaps();
        }
        function readClipFromSliders(commitRender) {
            function pair(aEl, bEl, hi) {
                var a = parseInt(aEl.value, 10);
                var b = parseInt(bEl.value, 10);
                if (!isFinite(a)) a = 0;
                if (!isFinite(b)) b = hi;
                if (a > b) {
                    var t = a;
                    a = b;
                    b = t;
                }
                if (a < 0) a = 0;
                if (b > hi) b = hi;
                return [a, b];
            }
            var x = pair(clipX0.inp, clipX1.inp, axisLenOf(session.state, "x") - 1);
            var y = pair(clipY0.inp, clipY1.inp, axisLenOf(session.state, "y") - 1);
            var z = pair(clipZ0.inp, clipZ1.inp, axisLenOf(session.state, "z") - 1);
            var fade = parseFloat(fadeInp.value);
            if (!isFinite(fade)) fade = 0;
            if (fade < 0) fade = 0;
            if (fade > 1) fade = 1;
            session.clip = {
                x0: x[0], x1: x[1], y0: y[0], y1: y[1], z0: z[0], z1: z[1], fade: fade
            };
            clipX0.inp.value = String(x[0]);
            clipX1.inp.value = String(x[1]);
            clipY0.inp.value = String(y[0]);
            clipY1.inp.value = String(y[1]);
            clipZ0.inp.value = String(z[0]);
            clipZ1.inp.value = String(z[1]);
            syncClipCaps();
            if (commitRender && boardCtrl) {
                if (typeof boardCtrl.renderLattice === "function") {
                    boardCtrl.renderLattice(session.state);
                } else if (typeof boardCtrl.render === "function") {
                    boardCtrl.render(session.state);
                }
            }
        }
        function bindClipSlider(el) {
            el.addEventListener("input", function () { readClipFromSliders(false); });
            el.addEventListener("change", function () { readClipFromSliders(true); });
            el.addEventListener("pointerup", function () { readClipFromSliders(true); });
        }
        [clipX0.inp, clipX1.inp, clipY0.inp, clipY1.inp, clipZ0.inp, clipZ1.inp, fadeInp]
            .forEach(bindClipSlider);
        persistClipFade();
        syncClipSlidersFromSession();

        var mainRow = document.createElement("div");
        mainRow.style.cssText =
            "flex:1 1 0%;min-height:0;display:flex;flex-direction:row;overflow:hidden;";

        var boardCol = document.createElement("div");
        boardCol.style.cssText =
            "flex:1 1 0%;min-width:0;min-height:0;display:flex;flex-direction:column;";

        var boardHost = document.createElement("div");
        boardHost.setAttribute("data-go-board-host", "1");
        boardHost.style.cssText =
            "flex:1 1 0%;min-height:0;position:relative;z-index:0;overflow:hidden;" +
            "isolation:isolate;background:#1c1c1c;";

        var messageEl = document.createElement("div");
        messageEl.setAttribute("data-go-message", "1");
        messageEl.style.cssText =
            "flex:0 0 auto;font-size:12px;color:#222;min-height:2.2em;max-height:4.8em;" +
            "overflow:auto;padding:4px 8px;background:#f5f5f5;border-top:1px solid #bbb;";
        messageEl.textContent = messageText;

        boardCol.appendChild(boardHost);
        boardCol.appendChild(messageEl);

        var sideBar = document.createElement("div");
        sideBar.style.cssText =
            "flex:0 0 260px;width:260px;min-width:180px;min-height:0;display:flex;" +
            "flex-direction:column;gap:6px;padding:8px;background:#f7f7f7;" +
            "border-left:1px solid #ccc;overflow:auto;z-index:10000;";

        var logSection = document.createElement("div");
        logSection.style.cssText =
            "flex:1 1 40%;min-height:0;display:flex;flex-direction:column;overflow:hidden;" +
            "border:1px solid #ddd;border-radius:4px;background:#fff;";
        var logLabel = document.createElement("div");
        logLabel.textContent = "Move log";
        logLabel.style.cssText = "font-size:12px;font-weight:600;padding:4px 6px;border-bottom:1px solid #eee;";
        var logEl = document.createElement("pre");
        logEl.style.cssText =
            "margin:0;flex:1 1 auto;min-height:0;overflow:auto;padding:6px;font-size:11px;" +
            "white-space:pre-wrap;";
        logSection.appendChild(logLabel);
        logSection.appendChild(logEl);

        var handBox = document.createElement("div");
        handBox.style.cssText =
            "flex:0 0 auto;padding:8px;background:#fff;border:1px solid #ddd;border-radius:6px;" +
            "text-align:center;";
        var handTitle = document.createElement("div");
        handTitle.textContent = "Hand";
        handTitle.style.cssText = "font-size:12px;font-weight:600;margin-bottom:6px;";
        var handStone = document.createElement("div");
        handStone.setAttribute("data-go-hand-stone", "1");
        handStone.style.cssText =
            "width:36px;height:36px;border-radius:50%;margin:0 auto;cursor:grab;" +
            "border:2px solid #111;box-sizing:border-box;";
        handStone.title = "Drag onto the lattice and release to place";
        var handHint = document.createElement("div");
        handHint.style.cssText = "font-size:11px;color:#666;margin-top:4px;";
        handHint.textContent = "toPlay stone";
        handBox.appendChild(handTitle);
        handBox.appendChild(handStone);
        handBox.appendChild(handHint);

        var sysMonWrap = null;
        var sysMonHostEl = null;
        var btnMem = null;
        if (isDedicatedGoPage()) {
            sysMonWrap = document.createElement("div");
            sysMonWrap.style.cssText =
                "flex:0 0 auto;padding:8px;background:#fff;border:1px solid #ddd;" +
                "border-radius:6px;font-size:11px;line-height:1.35;color:#333;";
            var sysMonTitleRow = document.createElement("div");
            sysMonTitleRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
            var sysMonTitle = document.createElement("div");
            sysMonTitle.textContent = "Mem. Stat.";
            sysMonTitle.style.cssText = "font-size:13px;font-weight:700;";
            btnMem = makeBtn("Mem");
            btnMem.style.fontSize = "11px";
            btnMem.style.padding = "2px 8px";
            btnMem.title = "Refresh Mem. Stat. now (auto: every 25 moves)";
            sysMonTitleRow.appendChild(sysMonTitle);
            sysMonTitleRow.appendChild(btnMem);
            sysMonHostEl = document.createElement("div");
            sysMonHostEl.style.cssText = "white-space:pre-wrap;margin-top:4px;";
            sysMonHostEl.textContent = "Host n/a\nroot RSS n/a\nGPU n/a";
            var sysNote = document.createElement("div");
            sysNote.style.cssText = "font-size:10px;color:#666;margin-top:4px;";
            sysNote.textContent = "Server GPU ≠ tab WebGL. Auto every 25 moves.";
            sysMonWrap.appendChild(sysMonTitleRow);
            sysMonWrap.appendChild(sysMonHostEl);
            sysMonWrap.appendChild(sysNote);
        }

        var recBox = document.createElement("div");
        recBox.style.cssText =
            "flex:0 0 auto;padding:8px;background:#fff;border:1px solid #ddd;" +
            "border-radius:6px;font-size:11px;";
        var recTitle = document.createElement("div");
        recTitle.textContent = "Record (.go3d.json)";
        recTitle.style.cssText = "font-weight:700;margin-bottom:4px;";
        var recArea = document.createElement("textarea");
        recArea.setAttribute("data-go-record", "1");
        recArea.style.cssText =
            "width:100%;height:90px;box-sizing:border-box;font:11px/1.3 monospace;" +
            "resize:vertical;";
        recArea.placeholder = "Export writes JSON here. Paste, then Load.";
        var recBtns = document.createElement("div");
        recBtns.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:center;";
        var btnExport = makeBtn("Export");
        var btnLoad = makeBtn("Load");
        var recFile = document.createElement("input");
        recFile.type = "file";
        recFile.accept = ".json,.go3d.json,application/json";
        recFile.style.cssText = "font-size:10px;max-width:100%;";
        recFile.title = "Optional: fill textarea from a file, then Load";
        recBtns.appendChild(btnExport);
        recBtns.appendChild(btnLoad);
        recBtns.appendChild(recFile);
        recBox.appendChild(recTitle);
        recBox.appendChild(recArea);
        recBox.appendChild(recBtns);

        sideBar.appendChild(logSection);
        sideBar.appendChild(recBox);
        sideBar.appendChild(handBox);
        if (sysMonWrap) sideBar.appendChild(sysMonWrap);

        mainRow.appendChild(boardCol);
        mainRow.appendChild(sideBar);
        wrap.appendChild(topBar);
        wrap.appendChild(mainRow);
        outerDom.appendChild(wrap);

        function setMessage(t) {
            messageText = t ? String(t) : "";
            messageEl.textContent = messageText.indexOf("Message:") === 0
                ? messageText
                : ("Message: " + messageText);
        }

        function formatLog(st) {
            var h = (st && st.moveHistory) || [];
            if (!h.length) return "(empty)";
            var lines = [];
            var i, rec, who;
            for (i = 0; i < h.length; i++) {
                rec = h[i];
                who = colorName(rec.color)[0];
                if (rec.type === "play") {
                    lines.push((i + 1) + ". " + who + " " + fmtPoint(rec));
                } else if (rec.type === "pass") {
                    lines.push((i + 1) + ". " + who + " pass");
                } else {
                    lines.push((i + 1) + ". " + (rec.type || "?"));
                }
            }
            return lines.join("\n");
        }

        function parseSysMonPayload(data) {
            if (data == null) return null;
            var o = data;
            if (typeof data === "string") {
                try { o = JSON.parse(data); } catch (e1) { return null; }
            }
            if (o && typeof o.fTitle === "string" && o.fTitle.charAt(0) === "{") {
                try { return JSON.parse(o.fTitle); } catch (e2) { return null; }
            }
            if (o && o.host) return o;
            return null;
        }

        function fetchSysMonSnapshot() {
            var bust = "nocache=" + Date.now();
            var sampleUrl = "/GoSysMemSample/cmd.json?" + bust;
            var fileUrl = "/jsrootsys/go_sysmem.json?" + bust;
            var namedUrl = "/GoSysMem/root.json?" + bust;
            function getJson(url) {
                return fetch(url, { credentials: "same-origin", cache: "no-store" })
                    .then(function (res) {
                        if (!res.ok) throw new Error("HTTP " + res.status);
                        return res.json();
                    });
            }
            return fetch(sampleUrl, { credentials: "same-origin", cache: "no-store" })
                .catch(function () { return null; })
                .then(function () { return getJson(fileUrl); })
                .then(function (j) {
                    var snap = parseSysMonPayload(j);
                    if (snap) return snap;
                    throw new Error("empty file snapshot");
                })
                .catch(function () {
                    return getJson(namedUrl).then(function (j2) {
                        return parseSysMonPayload(j2);
                    });
                })
                .catch(function () { return null; });
        }

        function renderSysMonHost(snap) {
            if (!sysMonHostEl) return;
            if (!snap) {
                sysMonHostEl.textContent = "Host n/a\nroot RSS n/a\nGPU n/a";
                return;
            }
            var host = snap.host || {};
            var proc = snap.proc || {};
            var gpu = snap.gpu || {};
            var gpuBit = "GPU n/a";
            if (gpu.ok) {
                gpuBit = "GPU " + formatMemGBFromMB(gpu.memoryUsedMiB) +
                    " / " + formatMemGBFromMB(gpu.memoryTotalMiB);
            } else if (gpu.reason) {
                gpuBit = "GPU n/a (" + String(gpu.reason).slice(0, 48) + ")";
            }
            sysMonHostEl.textContent =
                "Host " + formatMemGBFromMB(host.memAvailMB) +
                " avail / " + formatMemGBFromMB(host.memTotalMB) + " total\n" +
                "root RSS " + formatRssKB(proc.rssKB) + "\n" + gpuBit;
        }

        function currentMoveCount() {
            var st = session.state;
            return (st && st.moveHistory && st.moveHistory.length) || 0;
        }

        function refreshSysMon() {
            if (!sysMonHostEl) return Promise.resolve(null);
            return fetchSysMonSnapshot().then(function (snap) {
                lastSysSnap = snap;
                lastSysMonFetchAtMoves = currentMoveCount();
                renderSysMonHost(snap);
                return snap;
            });
        }

        function maybeAutoRefreshSysMon() {
            if (!sysMonHostEl) return;
            var n = currentMoveCount();
            if (n > 0 && (n % SYSMON_AUTO_EVERY_MOVES) === 0 && n > lastSysMonFetchAtMoves) {
                lastSysMonFetchAtMoves = n;
                refreshSysMon();
            }
        }

        function refreshHandStone() {
            var st = session.state;
            var second = !!(st && st.toPlay === GoGame.State.WHITE);
            var sc = session.stoneColors || defaultStoneColors();
            var rgba = second ? sc.second : sc.first;
            handStone.style.background = rgbaToHex(rgba);
            handStone.style.borderColor = "#111";
        }

        function refresh() {
            var st = session.state;
            var turn = colorName(st.toPlay);
            var playing = st.phase === "playing";
            if (st.phase === "ended") {
                playerBanner.textContent = st.scoreResult
                    ? ("Score  B " + st.scoreResult.black + "  W " + st.scoreResult.white)
                    : "Both passed — mark dead stones, then Score.";
            } else if (st.phase === "finished") {
                playerBanner.textContent = "Game over — Winner: " + colorName(st.winner);
            } else {
                var mpt = st.movesPerTurn != null ? st.movesPerTurn : 1;
                var nextStone = (st.playsThisTurn || 0) + 1;
                playerBanner.textContent = "To play: " + turn + "  ·  " +
                    sizeBanner(st) + "  ·  komi " + st.komi + "  ·  " +
                    nextStone + "/" + mpt;
            }
            meta.textContent = "moves " + currentMoveCount() +
                (placeMode ? "  |  PLACE" : "  |  view") +
                "  |  cap B+" + (st.capturedWhite || 0) + "/W+" + (st.capturedBlack || 0);
            logEl.textContent = formatLog(st);
            refreshHandStone();
            btnPlace.style.fontWeight = placeMode ? "700" : "400";
            btnPlace.disabled = !playing;
            btnPass.disabled = !playing;
            btnResign.disabled = !playing;
            btnScore.disabled = st.phase !== "ended";
            maybeAutoRefreshSysMon();
        }

        function afterStateChange(msg) {
            if (msg) setMessage(msg);
            if (boardCtrl && boardCtrl.render) boardCtrl.render(session.state);
            refresh();
        }

        function exitPlaceMode() {
            placeMode = false;
            if (boardCtrl && boardCtrl.setPlaceMode) boardCtrl.setPlaceMode(false);
            refresh();
        }

        function togglePlaceMode() {
            if (!session.state || session.state.phase !== "playing") {
                setMessage("game is not in playing phase");
                refresh();
                return;
            }
            placeMode = !placeMode;
            if (boardCtrl && boardCtrl.setPlaceMode) boardCtrl.setPlaceMode(placeMode);
            setMessage(placeMode
                ? "Place mode — click a lattice point"
                : "View mode — rotate/zoom");
            refresh();
        }

        function formatScoreMsg(r) {
            if (!r) return "";
            var win = r.winner === "black" ? "Black wins"
                : r.winner === "white" ? "White wins"
                : "Draw";
            var capB = (r.captures && r.captures.black) || 0;
            var capW = (r.captures && r.captures.white) || 0;
            var dB = (r.dead && r.dead.black) || 0;
            var dW = (r.dead && r.dead.white) || 0;
            return "Territory B " + r.black + " W " + r.white +
                " (terr " + r.territory.black + "(B):" + r.territory.white + "(W)" +
                " cap " + capB + "(B):" + capW + "(W)" +
                " dead " + dB + "(B):" + dW + "(W)" +
                ") komi " + r.komi + " → " + win;
        }

        function applyScore() {
            var st = session.state;
            if (!st || st.phase !== "ended" || !GoGame.Scoring) return null;
            var r = GoGame.Scoring.score(st, { includePoints: true });
            st.scoreResult = r;
            return r;
        }

        function toggleDeadAt(x, y, z) {
            var St = GoGame.State;
            var st = session.state;
            if (!st || st.phase !== "ended") return;
            var color = St.getStone(st, x, y, z);
            if (color !== St.BLACK && color !== St.WHITE) {
                setMessage("No stone to mark dead");
                refresh();
                return;
            }
            var group = GoGame.Rules.getGroup(st, x, y, z);
            var i, p, allDead = true;
            for (i = 0; i < group.length; i++) {
                p = group[i];
                if (!St.isDead(st, p.x, p.y, p.z)) { allDead = false; break; }
            }
            var next = [];
            var keep = {};
            var gset = {};
            for (i = 0; i < group.length; i++) {
                gset[St.deadKey(group[i].x, group[i].y, group[i].z)] = true;
            }
            var d = st.deadStones || [];
            for (i = 0; i < d.length; i++) {
                keep[St.deadKey(d[i].x, d[i].y, d[i].z)] = true;
            }
            if (allDead) {
                for (i = 0; i < group.length; i++) {
                    delete keep[St.deadKey(group[i].x, group[i].y, group[i].z)];
                }
            } else {
                for (i = 0; i < group.length; i++) {
                    keep[St.deadKey(group[i].x, group[i].y, group[i].z)] = true;
                }
            }
            var k, parts;
            for (k in keep) {
                if (!keep[k]) continue;
                parts = k.split(",");
                next.push({ x: +parts[0], y: +parts[1], z: +parts[2] });
            }
            st.deadStones = next;
            var r = applyScore();
            afterStateChange(r ? formatScoreMsg(r) : "Dead marks updated");
        }

        function onPlayRequest(x, y, z) {
            if (session.state && session.state.phase === "ended") {
                toggleDeadAt(x, y, z);
                return;
            }
            if (!session.state || session.state.phase !== "playing") {
                setMessage("game is not in playing phase");
                refresh();
                return;
            }
            var r = GoGame.Rules.play(session.state, x, y, z);
            if (r.ok) {
                session.state = r.state;
                if (placeMode) exitPlaceMode();
                var msg = "Played " + fmtPoint({ x: x, y: y, z: z });
                if (r.message === "capture" || (r.captured && r.captured.length)) {
                    var n = (r.captured && r.captured.length) ? r.captured.length : 0;
                    msg = "Capture! (took " + n + ") at " + fmtPoint({ x: x, y: y, z: z });
                }
                afterStateChange(msg);
            } else {
                var ill = r.message || "illegal";
                if (ill.indexOf("Illegal") !== 0 && ill.indexOf("illegal") !== 0) {
                    ill = "Illegal: " + ill;
                }
                setMessage(ill);
                refresh();
            }
        }

        function doUndo() {
            if (!session.state.moveHistory || !session.state.moveHistory.length) {
                setMessage("nothing to undo");
                refresh();
                return;
            }
            session.state = GoGame.State.undo(session.state);
            afterStateChange("undo");
        }

        function doPass() {
            if (!session.state || session.state.phase !== "playing") {
                setMessage("game is not in playing phase");
                refresh();
                return;
            }
            var r = GoGame.Rules.pass(session.state);
            session.state = r.state;
            exitPlaceMode();
            var passer = colorName(session.state.lastAction && session.state.lastAction.color)[0];
            var passMsg = passer + " pass";
            if (session.state.phase === "ended") {
                session.state.scoreResult = null;
                afterStateChange(passMsg + ". Mark dead stones, then Score.");
            } else {
                afterStateChange(passMsg);
            }
        }

        function doResign() {
            if (!session.state || session.state.phase !== "playing") {
                setMessage("game is not in playing phase");
                refresh();
                return;
            }
            var r = GoGame.Rules.resign(session.state);
            session.state = r.state;
            exitPlaceMode();
            afterStateChange("resign — winner " + colorName(r.winner));
        }

        function commitStoneColorsFromInputs() {
            var a = hexToRgba(firstColor.value);
            var b = hexToRgba(secondColor.value);
            if (!a || !b) {
                setMessage("Invalid stone color");
                syncColorInputsFromSession();
                return false;
            }
            if (colorDist(a, b) < COLOR_MIN_DIST) {
                setMessage("Stone colors too similar — kept previous colors");
                syncColorInputsFromSession();
                return false;
            }
            session.stoneColors = { first: a, second: b };
            return true;
        }

        function doNewGame() {
            commitStoneColorsFromInputs();
            var sx = parseInt(selX.value, 10);
            var sy = parseInt(selY.value, 10);
            var sz = parseInt(selZ.value, 10);
            var komi = parseFloat(selKomi.value);
            var mpt = parseInt(selMoves.value, 10);
            session.state = GoGame.State.newGame({
                sizeX: sx, sizeY: sy, sizeZ: sz, komi: komi, movesPerTurn: mpt
            });
            persistClipFade();
            syncSizeSelectsFromState(session.state);
            syncKomiMovesSelectsFromState(session.state);
            syncClipSlidersFromSession();
            exitPlaceMode();
            if (boardCtrl && boardCtrl.remount) boardCtrl.remount();
            afterStateChange("New game " + sizeBanner(session.state) +
                " · komi " + session.state.komi +
                " · moves " + session.state.movesPerTurn);
            if (sysMonWrap) refreshSysMon();
        }

        var downX = 0, downY = 0;
        function onHandPointerDown(ev) {
            if (!session.state || session.state.phase !== "playing") {
                setMessage("game is not in playing phase");
                refresh();
                return;
            }
            handDragging = true;
            lastHandPick = null;
            downX = ev.clientX;
            downY = ev.clientY;
            try { handStone.setPointerCapture(ev.pointerId); } catch (e1) { /* */ }
            placeMode = true;
            if (boardCtrl && boardCtrl.setPlaceMode) boardCtrl.setPlaceMode(true);
            handStone.style.cursor = "grabbing";
        }
        function onHandPointerMove(ev) {
            if (!handDragging) return;
            if (boardCtrl && typeof boardCtrl.pickAtClient === "function") {
                lastHandPick = boardCtrl.pickAtClient(ev.clientX, ev.clientY);
                if (lastHandPick) {
                    setMessage("Hover " + fmtPoint(lastHandPick));
                }
            }
        }
        function onHandPointerUp(ev) {
            if (!handDragging) return;
            handDragging = false;
            handStone.style.cursor = "grab";
            try { handStone.releasePointerCapture(ev.pointerId); } catch (e2) { /* */ }
            var pt = lastHandPick;
            if (!pt && boardCtrl && boardCtrl.pickAtClient) {
                pt = boardCtrl.pickAtClient(ev.clientX, ev.clientY);
            }
            lastHandPick = null;
            if (pt) {
                onPlayRequest(pt.x, pt.y, pt.z);
            } else {
                exitPlaceMode();
                setMessage("Released off lattice — place cancelled");
                refresh();
            }
        }
        function onHandPointerCancel() {
            handDragging = false;
            lastHandPick = null;
            exitPlaceMode();
            setMessage("Place cancelled");
            refresh();
        }
        handStone.addEventListener("pointerdown", onHandPointerDown);
        handStone.addEventListener("pointermove", onHandPointerMove);
        handStone.addEventListener("pointerup", onHandPointerUp);
        handStone.addEventListener("pointercancel", onHandPointerCancel);

        btnPlace.onclick = function (ev) {
            if (ev) ev.preventDefault();
            togglePlaceMode();
        };
        btnResetView.onclick = function (ev) {
            if (ev) ev.preventDefault();
            if (boardCtrl && typeof boardCtrl.resetView === "function") {
                var pr = boardCtrl.resetView();
                if (pr && typeof pr.then === "function") {
                    pr.then(function () {
                        setMessage("3D view reset to default");
                        refresh();
                    }).catch(function (e) {
                        setMessage("Reset view failed: " + (e && e.message ? e.message : e));
                        refresh();
                    });
                } else {
                    setMessage("3D view reset to default");
                    refresh();
                }
            }
        };
        function doExport() {
            if (!GoGame.Record) {
                setMessage("Record module missing");
                refresh();
                return;
            }
            var ex = GoGame.Record.exportRecord(session.state);
            if (!ex.ok) {
                setMessage(ex.message || "Export failed");
                refresh();
                return;
            }
            recArea.value = ex.text;
            try {
                var blob = new Blob([ex.text], { type: "application/json" });
                var a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "game.go3d.json";
                a.click();
            } catch (eDl) { /* download optional */ }
            setMessage("Exported Go3D JSON");
            refresh();
        }

        function doLoadFromText(text) {
            if (!GoGame.Record) {
                setMessage("Record module missing");
                refresh();
                return;
            }
            var prev = session.state;
            var ld = GoGame.Record.loadRecord(text, prev);
            if (!ld.ok) {
                setMessage(ld.message || "Load failed");
                refresh();
                return;
            }
            session.state = ld.state;
            persistClipFade();
            syncSizeSelectsFromState(session.state);
            syncKomiMovesSelectsFromState(session.state);
            syncClipSlidersFromSession();
            exitPlaceMode();
            if (boardCtrl && boardCtrl.remount) boardCtrl.remount();
            else if (boardCtrl && boardCtrl.render) boardCtrl.render(session.state);
            afterStateChange((ld.message || "Loaded Go3D record") +
                " · komi " + session.state.komi +
                " · movesPerTurn " + session.state.movesPerTurn);
        }

        btnExport.onclick = function (ev) {
            if (ev) ev.preventDefault();
            doExport();
        };
        btnLoad.onclick = function (ev) {
            if (ev) ev.preventDefault();
            doLoadFromText(recArea.value);
        };
        recFile.onchange = function () {
            var f = recFile.files && recFile.files[0];
            if (!f) return;
            var reader = new FileReader();
            reader.onload = function () {
                recArea.value = String(reader.result || "");
                recFile.value = "";
            };
            reader.readAsText(f);
        };

        btnPass.onclick = function (ev) {
            if (ev) ev.preventDefault();
            doPass();
        };
        btnScore.onclick = function (ev) {
            if (ev) ev.preventDefault();
            if (!session.state || session.state.phase !== "ended") {
                setMessage("Score only after both passed");
                refresh();
                return;
            }
            var r = applyScore();
            afterStateChange(r ? formatScoreMsg(r) : "Score failed");
        };
        btnResign.onclick = function (ev) {
            if (ev) ev.preventDefault();
            doResign();
        };
        btnUndo.onclick = function (ev) {
            if (ev) ev.preventDefault();
            doUndo();
        };
        btnNew.onclick = function (ev) {
            if (ev) ev.preventDefault();
            doNewGame();
        };
        btnShowAll.onclick = function (ev) {
            if (ev) ev.preventDefault();
            persistClipFade();
            syncClipSlidersFromSession();
            if (boardCtrl && typeof boardCtrl.renderLattice === "function") {
                boardCtrl.renderLattice(session.state);
            } else if (boardCtrl && typeof boardCtrl.render === "function") {
                boardCtrl.render(session.state);
            }
            setMessage("Show all — full board, fade unchanged");
            refresh();
        };
        btnCube.onclick = function (ev) {
            if (ev) ev.preventDefault();
            selX.value = "4";
            selY.value = "4";
            selZ.value = "4";
            setMessage("Cube 4×4×4 selected — New Game to apply");
            refresh();
        };
        btnDefaults.onclick = function (ev) {
            if (ev) ev.preventDefault();
            firstColor.value = rgbaToHex(DEFAULT_FIRST);
            secondColor.value = rgbaToHex(DEFAULT_SECOND);
            setMessage("Defaults selected — New Game to apply");
            refresh();
        };
        if (btnMem) {
            btnMem.onclick = function (ev) {
                if (ev) ev.preventDefault();
                btnMem.disabled = true;
                refreshSysMon().then(function (snap) {
                    setMessage(snap ? "SysMon refreshed" : "SysMon snapshot unavailable");
                    refresh();
                }).catch(function () {
                    setMessage("SysMon fetch failed");
                    refresh();
                }).then(function () {
                    btnMem.disabled = false;
                });
            };
        }

        function onKeyDown(ev) {
            if (ev.key === "Escape" || ev.keyCode === 27) {
                handDragging = false;
                exitPlaceMode();
                setMessage("Place cancelled — view mode");
                refresh();
            }
        }
        document.addEventListener("keydown", onKeyDown);

        if (!GoGame.Render || typeof GoGame.Render.mountBoard !== "function") {
            setMessage("Render.mountBoard missing — check AutoLoad");
            var early = {
                refresh: refresh,
                getState: function () { return session.state; },
                dispatch: function () { return { ok: false, message: "Render.mountBoard missing" }; },
                destroy: function () {}
            };
            _ui = early;
            GoGame.UI._api = early;
            GoGame._ui = early;
            return early;
        }

        GoGame.Render.setMode("3d");
        boardCtrl = GoGame.Render.mountBoard(boardHost, {
            session: session,
            onPlayRequest: onPlayRequest,
            onPlaceModeChange: function (on) {
                placeMode = !!on;
                refresh();
            },
            onStatus: function (msg) {
                if (msg) setMessage(msg);
                refresh();
            },
            toolbar: topBar
        });

        refresh();
        if (sysMonWrap) refreshSysMon();

        function dispatch(action, payload) {
            payload = payload || {};
            var act = String(action || "");
            if (act === "play") {
                if (typeof payload.x !== "number" || typeof payload.y !== "number" ||
                    typeof payload.z !== "number") {
                    return { ok: false, message: "play requires {x,y,z}" };
                }
                onPlayRequest(payload.x | 0, payload.y | 0, payload.z | 0);
                return { ok: true, state: session.state };
            }
            if (act === "undo") {
                doUndo();
                return { ok: true, state: session.state };
            }
            if (act === "pass") {
                doPass();
                return { ok: true, state: session.state };
            }
            if (act === "score") {
                if (!session.state || session.state.phase !== "ended") {
                    return { ok: false, message: "not ended" };
                }
                var sc = applyScore();
                afterStateChange(sc ? formatScoreMsg(sc) : "Score failed");
                return { ok: !!sc, state: session.state, score: sc };
            }
            if (act === "resign") {
                doResign();
                return { ok: true, state: session.state };
            }
            if (act === "newGame" || act === "new") {
                if (payload.size != null) {
                    selX.value = selY.value = selZ.value = String(payload.size);
                }
                if (payload.sizeX != null) selX.value = String(payload.sizeX);
                if (payload.sizeY != null) selY.value = String(payload.sizeY);
                if (payload.sizeZ != null) selZ.value = String(payload.sizeZ);
                if (payload.komi != null) selKomi.value = String(payload.komi);
                if (payload.movesPerTurn != null) selMoves.value = String(payload.movesPerTurn);
                doNewGame();
                return { ok: true, state: session.state };
            }
            if (act === "export") {
                doExport();
                return { ok: true, text: recArea.value };
            }
            if (act === "load") {
                doLoadFromText(payload.text != null ? payload.text : recArea.value);
                return { ok: true, state: session.state };
            }
            return { ok: false, message: "unknown action " + act };
        }

        var api = {
            refresh: refresh,
            getState: function () { return session.state; },
            setState: function (s) {
                session.state = s;
                if (boardCtrl && boardCtrl.render) boardCtrl.render(s);
                refresh();
            },
            dispatch: dispatch,
            destroy: function () {
                document.removeEventListener("keydown", onKeyDown);
                if (boardCtrl && boardCtrl.destroy) boardCtrl.destroy();
                while (outerDom.firstChild) outerDom.removeChild(outerDom.firstChild);
            }
        };
        _ui = api;
        GoGame.UI._api = api;
        GoGame._ui = api;
        GoGame.UI._controller = api;
        return api;
    }

    GoGame.UI = GoGame.UI || {};
    GoGame.UI.mount = mount;
    GoGame.UI.dispatch = function (action, payload) {
        if (_ui && _ui.dispatch) return _ui.dispatch(action, payload);
        return { ok: false, message: "UI not mounted" };
    };
    GoGame.UI.getState = function () {
        return _ui && _ui.getState ? _ui.getState() : (GoGame.session && GoGame.session.state);
    };

    if (typeof console !== "undefined" && console.log) {
        console.log("[go_ui] ready (spatial P1)");
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
