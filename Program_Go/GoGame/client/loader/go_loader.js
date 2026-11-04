(function () {
    if (typeof JSROOT !== "object") {
        console.error("[go_loader] requires JSROOT");
        return;
    }

    window.GoGame = window.GoGame || {};
    window.GoGame.version = "1.0.0-spatial-p1";
    window.GoGame.phase = "P1";

    var GO_PAGE_SHORT = "/gogame/gogame.htm";
    var GO_PAGE_FILES = "/jsrootsys/files/gogame.htm";

    function dedicatedPageUrl() {
        return GO_PAGE_SHORT;
    }

    function openDedicatedPage() {
        var url = dedicatedPageUrl();
        try {
            window.open(url, "gogame_dedicated");
        } catch (e) {
            console.warn("[go_loader] window.open blocked; use the link in the panel", e);
        }
        return url;
    }

    if (!window.GoGame.State) {
        console.error("[go_loader] GoGame.State missing — check AutoLoad order / insert_files");
    }
    if (!window.GoGame.Rules) {
        console.error("[go_loader] GoGame.Rules missing — check AutoLoad order / insert_files");
    }
    if (!window.GoGame.Render || typeof window.GoGame.Render.mountBoard !== "function") {
        console.error("[go_loader] GoGame.Render.mountBoard missing — check render scripts AutoLoad");
    }
    if (!window.GoGame.UI || typeof window.GoGame.UI.mount !== "function") {
        console.error("[go_loader] GoGame.UI.mount missing — check go_ui.js AutoLoad");
    }

    window.GoGame.drawBoardPlaceholder = function (dom, obj, opt) {
        while (dom && dom.firstChild) {
            dom.removeChild(dom.firstChild);
        }

        openDedicatedPage();

        var panel = document.createElement("div");
        panel.setAttribute("data-go-shell-landing", "1");
        panel.style.cssText =
            "padding:16px 20px;font:14px/1.4 sans-serif;color:#222;" +
            "box-sizing:border-box;";

        var title = document.createElement("div");
        title.style.cssText = "font-size:18px;font-weight:700;margin-bottom:10px;";
        title.textContent = "立體空間圍棋 4×4×4";

        var link = document.createElement("a");
        link.href = GO_PAGE_SHORT;
        link.target = "gogame_dedicated";
        link.rel = "noopener noreferrer";
        link.textContent = "Open dedicated page";
        link.style.cssText =
            "color:#06c;font-weight:700;text-decoration:underline;cursor:pointer;";
        link.title = GO_PAGE_SHORT;
        link.addEventListener("click", function (ev) {
            ev.preventDefault();
            openDedicatedPage();
        });

        var note = document.createElement("div");
        note.style.cssText = "margin-top:10px;font-size:13px;color:#555;";
        note.textContent = "Play on the dedicated page (3D lattice only). This tab does not mount WebGL.";

        panel.appendChild(title);
        panel.appendChild(link);
        panel.appendChild(note);
        if (dom) dom.appendChild(panel);

        window.GoGame.openDedicatedPage = openDedicatedPage;
        window.GoGame.dedicatedPageUrl = dedicatedPageUrl;

        return {
            DrawingReady: function () { return true; },
            cleanup: function () { /* no shell board controller */ }
        };
    };

    console.log("[go_loader] loaded", {
        version: window.GoGame.version,
        phase: window.GoGame.phase,
        shellMount: false,
        dedicatedUrl: GO_PAGE_SHORT,
        hasState: !!window.GoGame.State,
        hasRules: !!window.GoGame.Rules,
        hasRender: !!(window.GoGame.Render && window.GoGame.Render.mountBoard),
        hasUI: !!(window.GoGame.UI && window.GoGame.UI.mount),
        hasBoard3D: !!window.GoGame.Board3D,
        size: window.GoGame.State && window.GoGame.State.SIZE
    });
})();
