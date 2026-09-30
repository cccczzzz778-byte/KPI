import fs from "node:fs";

const file="components/public-dashboard.tsx";
if(!fs.existsSync(file)) throw new Error("PATCH89 missing "+file);
let s=fs.readFileSync(file,"utf8");

const before=s;
s=s.replace(
  /const \[reportPeriod,\s*setReportPeriod\]\s*=\s*useState(?:<[^;]+?>)?\(["']daily["']\);/,
  (m)=>m.replace(/["']daily["']\);$/, '"monthly");')
);

if(s===before){
  const fallback='const [reportPeriod, setReportPeriod] = useState<"daily" | "monthly">("daily");';
  if(s.includes(fallback)) s=s.replace(fallback,'const [reportPeriod, setReportPeriod] = useState<"daily" | "monthly">("monthly");');
}

if(s===before && !/reportPeriod[\s\S]{0,200}["']monthly["']/.test(s)){
  throw new Error("PATCH89 reportPeriod default anchor missing");
}

fs.writeFileSync(file,s,"utf8");
console.log("PATCH89: Monitoring/Public ranking now opens on Jami by default so historical accumulated KPI scores are shown immediately.");