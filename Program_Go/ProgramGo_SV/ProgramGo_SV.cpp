#ifndef ProgramGo_SV_cpp
#define ProgramGo_SV_cpp

// Pure implementation. Includes come from ProgramGo_SV.h via SetSV.C.
// Do not add #include here (ACLiC single-entry contract).

ProgramGo_SV *PROGRAMGO_SV = nullptr;

ProgramGo_SV::ProgramGo_SV(std::string ptr, std::string logfile)
{
 TString engine_args = TString::Format(
  "https:%d?%s&%s&%s",
  13931,
  "nocache",
  "ssl_cert=/etc/ssl/server.pem",
  "rw=1"
 );
 // "dirlisting=yes",
 this->serv = new THttpServer(engine_args);
 if (!this->serv->IsAnyEngine())
  std::cout << "[ProgramGo_SV::ProgramGo_SV]: Initialization Failed." << std::endl;

 this->logfile = logfile;
 this->sv = ptr;
 this->init_debuginfo();
}

ProgramGo_SV::~ProgramGo_SV()
{
 //if (some_internal_objectptr)
 // delete some_internal_objectptr;
}

std::string ProgramGo_SV::Get_SVptr() const
{
 return this->sv;
}

void ProgramGo_SV::init_debuginfo()
{
 TNamed* svLog = new TNamed("SV_log", "Server Log Viewer");
 this->serv->Register("/", svLog);

 // When GoGame is mounted, it owns the combined AutoLoad list (serverlog + go_loader).
 // Before that, keep serverlog-only so a bare SV still works.
 if (!this->go_game)
 {
  this->serv->GetSniffer()->SetAutoLoad("/jsrootsys/scripts/serverlog.js");
 }
}

void ProgramGo_SV::AddItems()
{
 this->additem_refresh();
 if (this->go_game)
  this->go_game->AddItems();
 if (this->go_sysmon)
  this->go_sysmon->AddItems();
}

void ProgramGo_SV::additem_refresh()
{
 char path[] = "/Refresh";
 this->serv->CreateItem(path, "refresh");
 TString refresh_cmd = this->sv + "->Refresh()";
 this->serv->RegisterCommand(path, refresh_cmd.Data(), "button;rootsys/icons/refresh.png");
 this->serv->Hide(path);
}

void ProgramGo_SV::Refresh()
{
 this->init_debuginfo();
 if (this->go_game)
  this->go_game->Refresh();
 if (this->go_sysmon)
  this->go_sysmon->Sample();
}

static TString JoinFields(const std::vector<TString> &fields, const TString &sep = ",")
{
 if (fields.empty())
  return "";
 TString out = fields[0];
 for (size_t n = 1; n < fields.size(); ++n)
  out += sep + fields[n];
 return out;
}

void ProgramGo_SV::Append_IndexPage()
{
 this->serv->SetItemField("/", "_layout", "tabs");
 this->serv->SetItemField("/", "_optimize", "2");

 std::vector<TString> items, options;
 if (this->go_game)
 {
  this->go_game->AppendLayoutItems(items, options);
 }

 this->serv->SetItemField("/","_drawitem", "[" + JoinFields(items) + "]");
 this->serv->SetItemField("/","_drawopt", "[" + JoinFields(options) + "]");
}

#endif
