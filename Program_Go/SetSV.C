// ACLiC single-entry model (this file only):
//   1) include all business .h first (complete types)
//   2) include all business .cpp next (same translation unit)
// Do not let business .cpp include other business headers.
// New modules: add their .h in the header block and .cpp in the source block.

#include <iostream>

#include "TStyle.h"
#include "TROOT.h"

// --- business headers ---
#include "ProgramGo_SV/ProgramGo_SV.h"
#include "GoGame/GoGame.h"
#include "GoSysMon/GoSysMon.h"

// --- business sources ---
#include "ProgramGo_SV/ProgramGo_SV.cpp"
#include "GoGame/GoGame.cpp"
#include "GoSysMon/GoSysMon.cpp"

void SetSV(std::string logfile)
{
 gStyle->SetOptStat(0);
 gROOT->ForceStyle();
 PROGRAMGO_SV = new ProgramGo_SV("PROGRAMGO_SV", logfile);

 // Mount Go feature class before AddItems / layout so delegation works.
 PROGRAMGO_SV->go_game = GoGame::Add_GoGame(PROGRAMGO_SV);
 // Host/proc/gpu snapshot (26_2). Not related to browser WebGL board memory.
 PROGRAMGO_SV->go_sysmon = GoSysMon::Add_GoSysMon(PROGRAMGO_SV);

 PROGRAMGO_SV->AddItems();
 PROGRAMGO_SV->Append_IndexPage();
}
