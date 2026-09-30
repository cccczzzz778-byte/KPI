import fs from "node:fs";

const file="components/kpi-app.tsx";
if(!fs.existsSync(file)) throw new Error("PATCH85 missing "+file);
let s=fs.readFileSync(file,"utf8");

const broken='{session.role !== "evaluator" && }';
if(s.includes(broken)){
  s=s.replace(broken,"");
}else{
  const brokenSingle="{session.role !== 'evaluator' && }";
  if(s.includes(brokenSingle)) s=s.replace(brokenSingle,"");
  else if(!s.includes("KpiPeriodReports")) console.log("PATCH85: no dangling monitoring report expression found.");
}

fs.writeFileSync(file,s,"utf8");
console.log("PATCH85: cleaned dangling monitoring report expression; Monitoring top extra KPI block stays removed.");