import fs from "node:fs";

function read(file){if(!fs.existsSync(file))throw new Error("PATCH73 missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){const i=file.lastIndexOf("/");if(i>=0)fs.mkdirSync(file.slice(0,i),{recursive:true});fs.writeFileSync(file,source,"utf8");console.log("PATCH73: "+file)}

// PATCH72 builds the advanced monitoring API/component/Excel, but it also injects the
// component into the existing KPI screen. PATCH73 removes that injection and exposes
// the same features on a separate page so the original dashboard/panels stay clean.
{
  const file="components/kpi-app.tsx";
  let s=read(file);
  s=s.replace('import MonitoringCenter from "@/components/monitoring-center";\n',"");
  s=s.replaceAll("<><KpiPeriodReports /><MonitoringCenter /></>","<KpiPeriodReports />");

  const marker='<div className="mc-entry"><a href="/monitoring-center">Monitoring markazi</a></div>';
  if(!s.includes(marker)){
    const occurrences=(s.match(/<KpiPeriodReports \/>/g)||[]).length;
    if(occurrences<1) throw new Error("PATCH73 KpiPeriodReports anchor missing");
    s=s.replaceAll("<KpiPeriodReports />",marker+"<KpiPeriodReports />");
  }
  write(file,s);
}

const page = `import MonitoringCenter from "@/components/monitoring-center";

export const dynamic = "force-dynamic";

export default function MonitoringCenterPage(){
  return (
    <main className="mc-page">
      <div className="mc-page-top">
        <div>
          <span className="mc-page-kicker">Buxoro SSB KPI</span>
          <h1>Monitoring markazi</h1>
          <p>Asosiy dashboarddan alohida boshqaruv va tahlil sahifasi.</p>
        </div>
        <div className="mc-page-links">
          <a href="/admin">Admin panel</a>
          <a href="/monitor">Monitoring panel</a>
        </div>
      </div>
      <div className="mc-safe-note">
        Bu sahifa faqat mavjud ma'lumotlarni o'qiydi va hisobotlaydi. Yuklangan fayllar, baholar va tarixiy yozuvlarni o'chirmaydi.
      </div>
      <MonitoringCenter />
    </main>
  );
}
`;
write("app/monitoring-center/page.tsx",page);

{
  const file="app/globals.css";
  let s=read(file);
  if(!s.includes("PATCH73_MONITORING_PAGE")){
    s += `
/* PATCH73_MONITORING_PAGE */
.mc-entry{display:flex;justify-content:flex-end;margin:0 0 10px}
.mc-entry a{display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:10px;background:#0f766e;color:#fff;text-decoration:none;font-weight:800;font-size:12px;box-shadow:0 5px 15px rgba(15,118,110,.15)}
.mc-entry a:hover{background:#115e59}
.mc-page{min-height:100vh;background:#f5f9f9;padding:22px}
.mc-page-top{max-width:1500px;margin:0 auto 14px;display:flex;justify-content:space-between;gap:18px;align-items:center}
.mc-page-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#0f766e}
.mc-page-top h1{margin:4px 0 4px;color:#123c3a;font-size:28px}
.mc-page-top p{margin:0;color:#64748b;font-size:13px}
.mc-page-links{display:flex;gap:8px;flex-wrap:wrap}
.mc-page-links a{padding:8px 11px;border:1px solid #c9dfdd;border-radius:9px;background:#fff;color:#155c57;text-decoration:none;font-weight:800;font-size:12px}
.mc-safe-note{max-width:1500px;margin:0 auto 12px;padding:10px 12px;border:1px solid #cfe8dc;background:#f0fdf4;color:#166534;border-radius:10px;font-size:12px;font-weight:700}
.mc-page>.mc-shell{max-width:1500px;margin-left:auto;margin-right:auto}
@media(max-width:800px){.mc-page{padding:12px}.mc-page-top{align-items:flex-start;flex-direction:column}}
`;
  }
  write(file,s);
}

console.log("PATCH73: advanced monitoring moved to /monitoring-center, outside the existing dashboard.");
console.log("PATCH73: existing KPI panels keep their prior layout; only a Monitoring markazi link is added.");
console.log("PATCH73: no DELETE/UPDATE against attachments/evaluations/daily_evaluations; existing files and scores are preserved.");
