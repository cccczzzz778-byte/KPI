import fs from "node:fs";
for(const file of ["components/public-dashboard.tsx","app/api/dashboard/route.ts","components/kpi-app.tsx"]){
  const s=fs.readFileSync(file,"utf8");
  const needles=file.includes("public-dashboard")?["reportPeriod","fetch(\"/api/dashboard","Hisobot ko‘rinishi"]:file.includes("dashboard/route")?["searchParams","evaluationPromise","currentDate"]:["function MonitoringPanel","const historicalEvaluationMap","<MonitoringPanel"];
  for(const needle of needles){
    const i=s.indexOf(needle);
    if(i>=0) console.log("\nPATCH95-DIAG "+file+" "+needle+" START\n"+s.slice(Math.max(0,i-2500),Math.min(s.length,i+6500))+"\nPATCH95-DIAG END\n");
  }
}
console.log("PATCH95 diagnostic only.");