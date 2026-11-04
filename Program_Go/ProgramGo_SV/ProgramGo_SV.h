#ifndef __ProgramGo_SV_H__
#define __ProgramGo_SV_H__

// Include set for this module under ACLiC + SetSV.C single-entry model:
// SetSV.C includes this .h before ProgramGo_SV.cpp, so everything the .cpp
// needs (interface + implementation std/ROOT types) must be prepared here.
// Do not rely on other business headers (e.g. GoGame.h) for these includes.
#include <iostream>
#include <string>
#include <vector>
#include "TNamed.h"
#include "TString.h"
#include "TRootSniffer.h"
#include "THttpServer.h"

class GoGame;
class GoSysMon;

class ProgramGo_SV
{
 public:
  THttpServer *serv = nullptr;

  ProgramGo_SV(std::string ptr, std::string logfile);
  ~ProgramGo_SV();
  std::string Get_SVptr() const;
  void AddItems();
  void Refresh();
  GoGame *go_game = nullptr;
  GoSysMon *go_sysmon = nullptr; // 26_2 host/proc/gpu snapshot
  void Append_IndexPage();

 private:
  std::string sv;
  std::string logfile;
  void init_debuginfo();
  void additem_refresh();
};
#endif
