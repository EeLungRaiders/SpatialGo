#ifndef GoGame_cpp
#define GoGame_cpp

// Pure implementation. Includes come from GoGame.h via SetSV.C.
// Do not add #include here (ACLiC single-entry contract).
// Do not include ProgramGo_SV.h or other business headers here.

GoGame::GoGame(ProgramGo_SV *sv)
 : fSV(sv)
{
}

GoGame *GoGame::Add_GoGame(ProgramGo_SV *sv)
{
 if (!sv || !sv->serv)
 {
  std::cout << "[GoGame::Add_GoGame]: invalid ProgramGo_SV / THttpServer."
            << std::endl;
  return nullptr;
 }

 GoGame *g = new GoGame(sv);
 g->RegisterBoardHolder();
 g->EnsureAutoLoad();
 g->EnsureGoPageLocation();
 std::cout << "[GoGame::Add_GoGame]: GoBoard registered, AutoLoad set, gogame/ location."
           << std::endl;
 return g;
}

void GoGame::RegisterBoardHolder()
{
 if (!fSV || !fSV->serv)
  return;

 // Avoid double-register of the same logical holder on Refresh.
 if (fBoardRegistered && fBoardHolder)
  return;

 fBoardHolder = new TNamed("GoBoard", "Go — open /gogame/gogame.htm");
 fSV->serv->Register("/", fBoardHolder);
 fBoardRegistered = true;
}

void GoGame::EnsureAutoLoad()
{
 if (!fSV || !fSV->serv || !fSV->serv->GetSniffer())
  return;

 // Single SetAutoLoad string so serverlog.js is not overwritten away.
 // Order is the string below. Paths match insert_files under $JSROOTSYS/scripts/.
 // Does not load board2d or SGF. Scoring and the Go3D record are included.
 // insert_files may still copy board2d / sgf; the dedicated page has its own list.
 const char *scripts =
  "/jsrootsys/scripts/serverlog.js;"
  "/jsrootsys/scripts/go_state.js;"
  "/jsrootsys/scripts/go_coords.js;"
  "/jsrootsys/scripts/go_rules.js;"
  "/jsrootsys/scripts/go_scoring.js;"
  "/jsrootsys/scripts/go_record.js;"
  "/jsrootsys/scripts/go_view_mode.js;"
  "/jsrootsys/scripts/go_board3d.js;"
  "/jsrootsys/scripts/go_budget.js;"
  "/jsrootsys/scripts/go_render_ctrl.js;"
  "/jsrootsys/scripts/go_ui.js;"
  "/jsrootsys/scripts/go_rules_cases.js;"
  "/jsrootsys/scripts/go_coords_cases.js;"
  "/jsrootsys/scripts/go_scoring_cases.js;"
  "/jsrootsys/scripts/go_record_cases.js;"
  "/jsrootsys/scripts/go_loader.js";
 fSV->serv->GetSniffer()->SetAutoLoad(scripts);
}


void GoGame::EnsureGoPageLocation()
{
 if (!fSV || !fSV->serv || fGoPageLocationAdded)
  return;

 // Short URL (24_2 scheme B): /gogame/gogame.htm → $WORKDIR/GoGame/html/gogame.htm
 // Scripts stay on /jsrootsys/scripts/go_*.js (absolute paths in the HTML; no second copy).
 const char *workdir = gSystem->Getenv("WORKDIR");
 if (!workdir || !workdir[0])
 {
  std::cout << "[GoGame::EnsureGoPageLocation]: WORKDIR unset; skip AddLocation(\"gogame/\")."
            << std::endl;
  return;
 }

 TString dir = TString::Format("%s/GoGame/html", workdir);
 // AccessPathName returns true when the path is NOT accessible.
 if (gSystem->AccessPathName(dir.Data()))
 {
  std::cout << "[GoGame::EnsureGoPageLocation]: missing dir " << dir
            << " — skip AddLocation." << std::endl;
  return;
 }

 TString loc = dir;
 if (!loc.EndsWith("/"))
  loc += "/";
 fSV->serv->AddLocation("gogame/", loc.Data());
 fGoPageLocationAdded = true;
 std::cout << "[GoGame::EnsureGoPageLocation]: mapped /gogame/ → " << loc
           << "  open https://…/gogame/gogame.htm" << std::endl;
}

void GoGame::AddItems()
{
 // Phase 0: holder already registered in Add_GoGame; nothing extra.
}

void GoGame::Refresh()
{
 RegisterBoardHolder();
 EnsureAutoLoad();
 EnsureGoPageLocation();
}

void GoGame::AppendLayoutItems(std::vector<TString> &items,
                               std::vector<TString> &options)
{
 // Go tab first, then server log (Plan Phase 0 default layout).
 items.push_back("GoBoard");
 options.push_back("");
 items.push_back("SV_log");
 options.push_back("");
}

#endif
