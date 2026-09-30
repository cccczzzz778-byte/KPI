import fs from "node:fs";

const file="components/kpi-app.tsx";
if(!fs.existsSync(file)) throw new Error("PATCH84 missing "+file);
let s=fs.readFileSync(file,"utf8");

const monitorIndex=s.search(/session\.role\s*===\s*["']monitor["']/);
if(monitorIndex<0) throw new Error("PATCH84 monitor branch not found");

const windowEnd=Math.min(s.length,monitorIndex+5000);
const block=s.slice(monitorIndex,windowEnd);
const widget="<KpiPeriodReports />";
const rel=block.indexOf(widget);

if(rel>=0){
  const at=monitorIndex+rel;
  s=s.slice(0,at)+s.slice(at+widget.length);
}else{
  console.log("PATCH84: monitoring report widget already absent.");
}

fs.writeFileSync(file,s,"utf8");
console.log("PATCH84: removed KPI period report table from Monitoring page only.");