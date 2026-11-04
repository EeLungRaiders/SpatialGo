(function () {
    if (typeof JSROOT != "object") {
        throw new Error("svlog.js requires JSROOT to be loaded");
    }

    console.log("[svlog.js] 自訂腳本已載入");

    // IMPORTANT (JSROOT 7.x): getDrawHandle() uses the FIRST addDrawFunc for a class.
    // Only one TNamed handler is effective. This function must handle every TNamed we draw
    // (SV_log, GoBoard, ...) or return a non-null painter. Returning undefined causes:
    //   "Fail to draw object type TNamed"
    JSROOT.addDrawFunc({
        name: "TNamed",
        icon: "img_text",
        func: function (dom, obj, opt) {
            if (!obj) {
                return false;
            }

            // --- Server log viewer ---
            if (obj.fName === "SV_log") {
                const div = document.createElement("div");
                div.style.padding = "10px";
                div.innerHTML = `
                <b style="font-size:16px;">Server Log</b>
                <button id="refreshBtn" style="margin-left:15px;">重新整理</button>
                <hr>
                <pre id="logContent" style="background:#f8f8f8; padding:10px; 
                     white-space:pre-wrap; font-family:monospace; max-height:70vh; overflow:auto;">
                    載入中...
                </pre>
            `;
                dom.appendChild(div);

                const logContent = div.querySelector("#logContent");
                const refreshBtn = div.querySelector("#refreshBtn");

                async function loadLog() {
                    try {
                        const response = await fetch("/jsrootsys/proc_SV.log?nocache=" + Date.now());
                        if (!response.ok) {
                            logContent.textContent = "無法讀取 log 檔案";
                            return;
                        }
                        const text = await response.text();
                        logContent.textContent = text;
                    } catch (err) {
                        logContent.textContent = "讀取失敗：" + err;
                    }
                }

                loadLog();
                refreshBtn.onclick = loadLog;

                return { DrawingReady: function () { return true; } };
            }

            // --- GoBoard landing (go_loader.js): open dedicated page, no shell mount ---
            if (obj.fName === "GoBoard") {
                if (window.GoGame && typeof window.GoGame.drawBoardPlaceholder === "function") {
                    return window.GoGame.drawBoardPlaceholder(dom, obj, opt);
                }
                // go_loader not yet available: short link-only fallback
                const div = document.createElement("div");
                div.style.padding = "16px";
                div.style.fontFamily = "sans-serif";
                div.innerHTML =
                    "<b>Go Game</b><br>" +
                    "<a href=\"/gogame/gogame.htm\" target=\"gogame_dedicated\" " +
                    "rel=\"noopener noreferrer\">Open dedicated page</a>";
                dom.appendChild(div);
                try { window.open("/gogame/gogame.htm", "gogame_dedicated"); } catch (e) { /* pop-up */ }
                return { DrawingReady: function () { return true; } };
            }

            // Unknown TNamed: do not throw; skip custom draw
            return false;
        }
    });

})();
