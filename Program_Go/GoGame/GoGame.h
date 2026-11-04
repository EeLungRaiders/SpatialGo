#ifndef __GoGame_H__
#define __GoGame_H__

// Include set for this module under ACLiC + SetSV.C single-entry model:
// SetSV.C includes this .h before GoGame.cpp, so everything the .cpp needs
// (interface + implementation std/ROOT types) must be prepared here.
// Do not rely on other business headers (e.g. ProgramGo_SV.h) for these includes.
// ProgramGo_SV complete type comes from SetSV.C include order (SV .h before GoGame .cpp).
#include <iostream>
#include <vector>
#include "TNamed.h"
#include "TString.h"
#include "THttpServer.h"
#include "TRootSniffer.h"
#include "TSystem.h"

class ProgramGo_SV;

// GoGame: THttpServer shell for spatial Go.
// Rules, scoring, and board geometry are client JS. SGF (sgf.js) is unused.
class GoGame
{
 public:
  // Factory: register GoBoard holder, set AutoLoad, return owned instance.
  static GoGame *Add_GoGame(ProgramGo_SV *sv);

  void AddItems();
  void Refresh();
  void AppendLayoutItems(std::vector<TString> &items,
                         std::vector<TString> &options);

 private:
  explicit GoGame(ProgramGo_SV *sv);

  ProgramGo_SV *fSV = nullptr;
  TNamed *fBoardHolder = nullptr; // registered with THttpServer; not deleted here
  bool fBoardRegistered = false;

  void RegisterBoardHolder();
  void EnsureAutoLoad();
  void EnsureGoPageLocation(); // AddLocation("gogame/") → short URL

  bool fGoPageLocationAdded = false;
};

#endif
