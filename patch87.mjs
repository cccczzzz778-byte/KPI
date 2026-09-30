import fs from "node:fs";
const file="components/kpi-app.tsx";
const s=fs.readFileSync(file,"utf8");
for(const needle of ["Muassasalar reytingi","Baholanmagan","JAMI KPI","Jami KPI"]){
  const i=s.indexOf(needle);
  if(i>=0){
    const a=Math.max(0,i-3500),b=Math.min(s.length,i+7000);
    console.log("\nPATCH87-DIAG "+needle+" START\n"+s.slice(a,b)+"\nPATCH87-DIAG "+needle+" END\n");
  }
}
console.log("PATCH87 diagnostic only; no source changes.");