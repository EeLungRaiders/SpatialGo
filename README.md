# SpatialGo

SpatialGo is a two-player hotseat game of spatial Go (weiqi) on a three-dimensional lattice. ROOT THttpServer serves the page, and JSROOT draws the board.

SpatialGo 是雙人熱座的立體圍棋，棋盤是三維格子。頁面由 ROOT THttpServer 提供，棋盤由 JSROOT 繪製。

## Build the image

Build from `BuildImage/`. `build.sh` runs `docker build` with your user name and numeric ids, and tags the image `jsroot_forgo3d_<user>`. The Dockerfile starts from Ubuntu 26.04, installs ROOT 6.40.02, downloads JSROOT 7.11.0, creates a local TLS certificate for `localhost`, and adds a container user that matches the host uid and gid. GPU monitoring in the image expects NVIDIA driver series 595 on the host.

在 `BuildImage/` 建置。`build.sh` 會用你的使用者名稱與數字 id 執行 `docker build`，映像標籤是 `jsroot_forgo3d_<user>`。Dockerfile 以 Ubuntu 26.04 為底，安裝 ROOT 6.40.02、下載 JSROOT 7.11.0、為 `localhost` 建立本機 TLS 憑證，並加入與宿主 uid、gid 對應的容器使用者。映像內的 GPU 監測對應宿主上 595 系列的 NVIDIA 驅動。

```bash
cd BuildImage
./build.sh
```

## Start a game

From the repository root, `./run_container.sh` starts that image with host networking, mounts `Launcher/` and `Program_Go/`, and opens a shell at `/sv_dir`. The script requests the NVIDIA container runtime and all GPUs. Inside the container, run `Launcher/StartServer.sh`. It copies the client files and starts the ROOT server.

在專案根目錄執行 `./run_container.sh`。它會啟動上述映像、使用宿主網路、掛載 `Launcher/` 與 `Program_Go/`，並在 `/sv_dir` 開啟 shell。這個腳本會要求 NVIDIA 容器 runtime 與全部 GPU。進到容器後執行 `Launcher/StartServer.sh`。它會複製客戶端檔案並啟動 ROOT 伺服器。

```bash
./run_container.sh
# inside the container
Launcher/StartServer.sh
```

Open `https://<host>:13931/gogame/gogame.htm`. The certificate names localhost, so the browser shows a warning. The index entry GoBoard only opens this dedicated page.

開啟 `https://<host>:13931/gogame/gogame.htm`。憑證的名稱是 localhost，瀏覽器會顯示警告。索引裡的 GoBoard 只會打開這個專用頁面。

## The game

Two players share one seat. The default board is a 4×4×4 cube. Each axis can be set from 1 to 9, so the board can be a cuboid. A stone's liberties are its six orthogonal neighbours.

兩人坐在一起下。預設棋盤是 4×4×4 立方體。每一軸可設為 1 到 9，因此棋盤可以是長方體。一子的氣是正交方向上的六個鄰居。

A group with no liberties is captured. Suicide is forbidden, and simple ko forbids an immediate recapture. Two passes end the game. Mark the dead stones, then score by territory. Komi defaults to 6.5 and can be chosen from 0.5 to 19.5. Each turn plays one move by default, and that count can be set from 1 to 6.

沒有氣的一塊棋會被提掉。不准自殺，簡單劫禁止立刻回提。連續兩次停著就結束對局。標出死子後以地域計分。貼目預設 6.5，可在 0.5 到 19.5 之間選擇。每一手預設下一子，也可設成 1 到 6 子。

Export and load use a Go3D JSON record. An observation window fades intersections outside the clip. The window is only for looking, and it is not written into the record.

匯出與載入使用 Go3D JSON 棋譜。觀察窗會把裁切範圍外的交叉點淡出。這個視窗只供觀看，不會寫進棋譜。




*SpatialGo was produced with GrokBuild.*
