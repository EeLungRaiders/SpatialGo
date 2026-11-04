#ifndef __GoSysMon_H__
#define __GoSysMon_H__

// Include set for this module under ACLiC + SetSV.C single-entry model:
// SetSV.C includes this .h before GoSysMon.cpp. Do not include other business
// headers here. ProgramGo_SV complete type comes from SetSV.C include order.
#include <iostream>
#include <cstdio>
#include <cstring>
#include "TNamed.h"
#include "TString.h"
#include "THttpServer.h"
#include "TSystem.h"
#include "TTimeStamp.h"

class ProgramGo_SV;

// GoSysMon: host / root-process / optional GPU snapshot for THttpServer (26_2).
// Does not draw Go boards. 3D cost remains in the browser (JSROOT WebGL).
class GoSysMon
{
 public:
  static GoSysMon *Add_GoSysMon(ProgramGo_SV *sv);

  void AddItems();
  void Sample(); // refresh JSON + optional $JSROOTSYS/go_sysmem.json

 private:
  explicit GoSysMon(ProgramGo_SV *sv);

  ProgramGo_SV *fSV = nullptr;
  TNamed *fNamed = nullptr; // registered "GoSysMem"; title holds JSON
  bool fRegistered = false;
  bool fCmdRegistered = false;

  TString BuildJson() const;
  void Publish(const TString &json);
  void EnsureRegistered();
  void RegisterSampleCommand();

  static bool ReadMemAvailableMB(Int_t &availMB);
  static bool QueryNvidiaSmi(Long64_t &usedMiB, Long64_t &totalMiB, TString &reason);
  static TString JsonEscape(const char *s);
};

#endif
