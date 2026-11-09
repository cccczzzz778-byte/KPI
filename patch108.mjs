import fs from "node:fs";
import path from "node:path";
function copy(from,to){
  const dst=path.join(process.cwd(),to);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(from,dst);
  console.log("PATCH108: installed "+to);
}
copy("patch108.admin-month-editor-route.ts.txt","app/api/admin/monthly-scores/route.ts");
copy("patch108.admin-month-editor.tsx.txt","components/admin-month-editor.tsx");
const file="components/kpi-app.tsx";
let s=fs.readFileSync(file,"utf8");
if(!s.includes('import { AdminMonthEditor } from "@/components/admin-month-editor";')){
  const anchor='import { AdminInstitutionManager } from "@/components/admin-institution-manager";';
  if(!s.includes(anchor))throw new Error("PATCH108: admin component import anchor missing");
  s=s.replace(anchor,anchor+'\nimport { AdminMonthEditor } from "@/components/admin-month-editor";');
}
if(!s.includes('<AdminMonthEditor onChanged={onRefresh} />')){
  const anchor='<AdminInstitutionManager onChanged={onRefresh} />';
  if(!s.includes(anchor))throw new Error("PATCH108: admin panel anchor missing");
  s=s.replace(anchor,anchor+'\n<AdminMonthEditor onChanged={onRefresh} />');
}
fs.writeFileSync(file,s,"utf8");
console.log("PATCH108: admin historical month editor enabled for September and October.");
