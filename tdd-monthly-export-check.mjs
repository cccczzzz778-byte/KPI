import fs from "node:fs";
const file="app/api/reports/monitoring-scores/route.ts";
const s=fs.existsSync(file)?fs.readFileSync(file,"utf8"):"";
const checks=[
  ["month parameter",/searchParams\.get\(["']month["']\)/],
  ["October cycle start",/2026-10-05/],
  ["selected month in filename",/selectedMonth|monthKey/],
];
let failed=0;
for(const [name,re] of checks){
  if(re.test(s)) console.log("PASS",name); else {console.error("FAIL",name);failed++;}
}
if(failed) process.exit(1);
