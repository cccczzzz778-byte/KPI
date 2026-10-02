import fs from "node:fs";
const file="components/kpi-excel-export.tsx";
if(!fs.existsSync(file)) throw new Error("PATCH93 missing "+file);
let s=fs.readFileSync(file,"utf8");

const anchor='<div className="kpi-export-actions">';
const button='<a href="/api/reports/monitoring-scores" className="kpi-export-button"><Download size={16} />Monitoring Excel (6 list)</a>';
if(!s.includes(button)){
  if(!s.includes(anchor)) throw new Error("PATCH93 export actions anchor missing");
  s=s.replace(anchor,anchor+button);
}
s=s.replace('Jadval ko‘rsatilmaydi — faqat Excel yuklab olish.','Namunadagi kabi 6 listli Monitoring Excel va davriy Excel hisobotlar.');
fs.writeFileSync(file,s,"utf8");
console.log("PATCH93: added one-click six-sheet Monitoring Excel download button.");