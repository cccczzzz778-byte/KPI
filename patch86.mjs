import fs from "node:fs";

function edit(file){
  if(!fs.existsSync(file)) throw new Error("PATCH86 missing "+file);
  let s=fs.readFileSync(file,"utf8");
  s=s.replace(/\n?import KpiPeriodReports from "@\/components\/kpi-period-reports";\n?/g,"\n");
  s=s.replace(/<KpiPeriodReports \/>\s*/g,"");
  fs.writeFileSync(file,s,"utf8");
  console.log("PATCH86: "+file);
}

edit("components/kpi-app.tsx");
edit("components/evaluator-reference-panel.tsx");

console.log("PATCH86: removed top KPI period report blocks from Admin and Evaluator views.");