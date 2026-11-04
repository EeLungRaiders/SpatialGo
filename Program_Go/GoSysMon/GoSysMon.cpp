#ifndef GoSysMon_cpp
#define GoSysMon_cpp

// Pure implementation. Includes come from GoSysMon.h via SetSV.C.
// Do not add #include here (ACLiC single-entry contract).
// Do not include ProgramGo_SV.h or other business headers here.

GoSysMon::GoSysMon(ProgramGo_SV *sv)
 : fSV(sv)
{
}

GoSysMon *GoSysMon::Add_GoSysMon(ProgramGo_SV *sv)
{
 if (!sv || !sv->serv)
 {
  std::cout << "[GoSysMon::Add_GoSysMon]: invalid ProgramGo_SV / THttpServer."
            << std::endl;
  return nullptr;
 }

 GoSysMon *m = new GoSysMon(sv);
 m->EnsureRegistered();
 m->RegisterSampleCommand();
 m->Sample();
 std::cout << "[GoSysMon::Add_GoSysMon]: GoSysMem registered "
              "(host/proc/gpu snapshot; 3D is browser WebGL)."
           << std::endl;
 return m;
}

void GoSysMon::AddItems()
{
 RegisterSampleCommand();
}

void GoSysMon::Sample()
{
 Publish(BuildJson());
}

void GoSysMon::EnsureRegistered()
{
 if (!fSV || !fSV->serv)
  return;
 if (fRegistered && fNamed)
  return;
 fNamed = new TNamed("GoSysMem", "{}");
 fSV->serv->Register("/", fNamed);
 fRegistered = true;
}

void GoSysMon::RegisterSampleCommand()
{
 if (!fSV || !fSV->serv || fCmdRegistered)
  return;
 // cmd.json still works for dedicated-page Mem fetch. Do NOT use "button;…"
 // icon — that registers a JSROOT toolbar _fastcmd and duplicated the green
 // refresh next to PROGRAMGO_SV->Refresh() (26_5). Hide from browser tree.
 const char *path = "/GoSysMemSample";
 fSV->serv->CreateItem(path, "sample GoSysMem JSON");
 TString method = fSV->Get_SVptr() + "->go_sysmon->Sample()";
 fSV->serv->RegisterCommand(path, method.Data()); // no toolbar button
 fSV->serv->Hide(path);
 fSV->serv->SetItemField(path, "_hidden", "true");
 fCmdRegistered = true;
}

TString GoSysMon::JsonEscape(const char *s)
{
 if (!s)
  return "";
 TString out;
 for (const char *p = s; *p; ++p)
 {
  char c = *p;
  if (c == '\\' || c == '"')
  {
   out += '\\';
   out += c;
  }
  else if (c == '\n')
   out += "\\n";
  else if (c == '\r')
   out += "\\r";
  else if (c == '\t')
   out += "\\t";
  else
   out += c;
 }
 return out;
}

bool GoSysMon::ReadMemAvailableMB(Int_t &availMB)
{
 availMB = -1;
 FILE *f = fopen("/proc/meminfo", "r");
 if (!f)
  return false;
 char line[256];
 long availKB = -1;
 while (fgets(line, sizeof(line), f))
 {
  if (strncmp(line, "MemAvailable:", 13) == 0)
  {
   if (sscanf(line + 13, "%ld", &availKB) == 1)
    break;
  }
 }
 fclose(f);
 if (availKB < 0)
  return false;
 availMB = (Int_t)(availKB / 1024);
 return true;
}

bool GoSysMon::QueryNvidiaSmi(Long64_t &usedMiB, Long64_t &totalMiB, TString &reason)
{
 usedMiB = -1;
 totalMiB = -1;
 reason = "";
 // First GPU only. Userspace CLI; needs --gpus / nvidia runtime (see Reports/26_1).
 FILE *p = popen(
  "nvidia-smi --query-gpu=memory.used,memory.total "
  "--format=csv,noheader,nounits 2>/dev/null",
  "r");
 if (!p)
 {
  reason = "popen nvidia-smi failed";
  return false;
 }
 char buf[512];
 if (!fgets(buf, sizeof(buf), p))
 {
  pclose(p);
  reason = "nvidia-smi produced no output";
  return false;
 }
 int st = pclose(p);
 if (st != 0)
 {
  reason = TString::Format("nvidia-smi exit status %d", st);
  // still try parse if numbers present
 }
 long long u = -1, t = -1;
 // Formats: "123, 456" or "123,456"
 if (sscanf(buf, "%lld , %lld", &u, &t) != 2 &&
     sscanf(buf, "%lld,%lld", &u, &t) != 2)
 {
  if (reason.Length() == 0)
   reason = "failed to parse nvidia-smi csv";
  return false;
 }
 usedMiB = u;
 totalMiB = t;
 if (st != 0 && reason.Length() == 0)
  reason = TString::Format("nvidia-smi exit status %d (parsed anyway)", st);
 return true;
}

TString GoSysMon::BuildJson() const
{
 // Default-construct (ROOT dynamic classes — do not memset; destroys vtable).
 MemInfo_t mem;
 ProcInfo_t proc;
 Int_t memOk = (gSystem->GetMemInfo(&mem) == 0) ? 1 : 0;
 Int_t procOk = (gSystem->GetProcInfo(&proc) == 0) ? 1 : 0;

 Int_t availMB = -1;
 bool availOk = ReadMemAvailableMB(availMB);
 // Prefer /proc MemAvailable; else approximate with GetMemInfo free.
 if (!availOk && memOk)
  availMB = mem.fMemFree;

 Long64_t gpuUsed = -1, gpuTotal = -1;
 TString gpuReason;
 bool gpuOk = QueryNvidiaSmi(gpuUsed, gpuTotal, gpuReason);

 TTimeStamp now;
 // Compact JSON for TNamed title + file. note clarifies GPU ≠ browser WebGL.
 TString json = "{";
 json += TString::Format("\"ts\":%ld,", (long)now.GetSec());
 json += "\"note\":\"3D Go is browser JSROOT/WebGL; server gpu is whole-device if ok\",";

 json += "\"host\":{";
 json += TString::Format("\"ok\":%s,", memOk ? "true" : "false");
 json += TString::Format("\"memTotalMB\":%d,", memOk ? mem.fMemTotal : -1);
 json += TString::Format("\"memUsedMB\":%d,", memOk ? mem.fMemUsed : -1);
 json += TString::Format("\"memFreeMB\":%d,", memOk ? mem.fMemFree : -1);
 json += TString::Format("\"memAvailMB\":%d", availMB);
 json += "},";

 json += "\"proc\":{";
 json += TString::Format("\"ok\":%s,", procOk ? "true" : "false");
 json += TString::Format("\"rssKB\":%ld,", procOk ? (long)proc.fMemResident : -1L);
 json += TString::Format("\"virtKB\":%ld,", procOk ? (long)proc.fMemVirtual : -1L);
 json += TString::Format("\"cpuUser\":%.3f,", procOk ? (double)proc.fCpuUser : -1.0);
 json += TString::Format("\"cpuSys\":%.3f", procOk ? (double)proc.fCpuSys : -1.0);
 json += "},";

 json += "\"gpu\":{";
 if (gpuOk)
 {
  json += "\"ok\":true,";
  json += TString::Format("\"memoryUsedMiB\":%lld,", (long long)gpuUsed);
  json += TString::Format("\"memoryTotalMiB\":%lld,", (long long)gpuTotal);
  json += "\"source\":\"nvidia-smi\",";
  json += "\"scope\":\"container_or_host_visible_device\"";
 }
 else
 {
  json += "\"ok\":false,";
  json += "\"memoryUsedMiB\":-1,";
  json += "\"memoryTotalMiB\":-1,";
  json += "\"reason\":\"" + JsonEscape(gpuReason.Data()) + "\"";
 }
 json += "}";
 json += "}";
 return json;
}

void GoSysMon::Publish(const TString &json)
{
 EnsureRegistered();
 if (fNamed)
  fNamed->SetTitle(json.Data());

 const char *jsroot = gSystem->Getenv("JSROOTSYS");
 if (jsroot && jsroot[0])
 {
  TString path = TString::Format("%s/go_sysmem.json", jsroot);
  FILE *out = fopen(path.Data(), "w");
  if (out)
  {
   fputs(json.Data(), out);
   fputc('\n', out);
   fclose(out);
  }
  else
  {
   std::cout << "[GoSysMon]: cannot write " << path << std::endl;
  }
 }
}

#endif
