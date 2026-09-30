import fs from "node:fs";
function read(file){if(!fs.existsSync(file))throw new Error("PATCH82 missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.writeFileSync(file,source,"utf8");console.log("PATCH82: "+file)}
{
  const file="components/kpi-app.tsx";
  let s=read(file);
  const from='<AdminInstitutionManager onChanged={onRefresh} />\n<AdminInstitutionApplicability />';
  const to='<AdminInstitutionApplicability />\n<AdminInstitutionManager onChanged={onRefresh} />';
  if(s.includes(from)) s=s.replace(from,to);
  else if(!s.includes(to)) throw new Error("PATCH82 applicability order anchor missing");
  write(file,s);
}
console.log("PATCH82: applicability controls moved to the top of the Muassasalar section.");