import fs from "node:fs";
function read(file){if(!fs.existsSync(file))throw new Error("PATCH80C missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.writeFileSync(file,source,"utf8");console.log("PATCH80C: "+file)}
function ensureHook(source,hook){const re=/import\s*\{([^}]*)\}\s*from\s*["\']react["\'];/;const m=source.match(re);if(!m)throw new Error("PATCH80C react import missing");const names=m[1].split(",").map(x=>x.trim()).filter(Boolean);if(!names.includes(hook))names.push(hook);return source.replace(re,'import { '+names.join(", ")+' } from "react";')}
{
 const file="components/evaluator-reference-panel.tsx";let s=read(file);s=ensureHook(ensureHook(s,"useEffect"),"useState");
 const a='const session = data.session ?? {};';
 if(!s.includes("PATCH80C_EVALUATOR")){if(!s.includes(a))throw new Error("PATCH80C evaluator session anchor");s=s.replace(a,a+'\n  /* PATCH80C_EVALUATOR */\n  const [excludedInstitutionIds,setExcludedInstitutionIds]=useState<string[]>([]);\n  useEffect(()=>{let alive=true;fetch("/api/applicability",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"x");if(alive)setExcludedInstitutionIds(Array.isArray(j.excludedInstitutionIds)?j.excludedInstitutionIds.map(String):[])}).catch(()=>{if(alive)setExcludedInstitutionIds([])});return()=>{alive=false}},[session.commission]);')}
 const f='.filter((item: AnyRecord) => item.active !== false && item.active !== 0)';
 if(!s.includes("!excludedInstitutionIds.includes(String(item.id))")){if(!s.includes(f))throw new Error("PATCH80C evaluator filter anchor");s=s.replace(f,f+'\n    .filter((item: AnyRecord) => !excludedInstitutionIds.includes(String(item.id)))')}
 s=s.replace('[data.institutions]\n);','[data.institutions, excludedInstitutionIds]\n);');
 write(file,s);
}
{
 const file="components/institution-portal.tsx";let s=read(file);s=ensureHook(ensureHook(s,"useEffect"),"useState");
 const a='const [activeCommission, setActiveCommission] = useState<CommissionKey>("ijro");';
 if(!s.includes("PATCH80C_INSTITUTION")){if(!s.includes(a))throw new Error("PATCH80C institution state anchor");s=s.replace(a,a+'\n  /* PATCH80C_INSTITUTION */\n  const [excludedCommissions,setExcludedCommissions]=useState<CommissionKey[]>([]);\n  useEffect(()=>{let alive=true;fetch("/api/applicability",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"x");if(alive)setExcludedCommissions(Array.isArray(j.excludedCommissions)?j.excludedCommissions:[])}).catch(()=>{if(alive)setExcludedCommissions([])});return()=>{alive=false}},[]);\n  useEffect(()=>{if(!excludedCommissions.includes(activeCommission))return;const next=commissions.find(x=>!excludedCommissions.includes(x.id));if(next)setActiveCommission(next.id)},[excludedCommissions,activeCommission]);')}
 const d='const directionCriteria = criteria.filter((criterion) => criterion.commission === activeCommission);';
 if(s.includes(d))s=s.replace(d,'const directionCriteria = excludedCommissions.includes(activeCommission) ? [] : criteria.filter((criterion) => criterion.commission === activeCommission);');
 else if(!s.includes("excludedCommissions.includes(activeCommission) ? []"))throw new Error("PATCH80C direction anchor");
 const t='{commissions.map((commission) => <button type="button" key={commission.id}';
 if(s.includes(t))s=s.replace(t,'{commissions.filter((commission) => !excludedCommissions.includes(commission.id)).map((commission) => <button type="button" key={commission.id}');
 else if(!s.includes("commissions.filter((commission) => !excludedCommissions.includes(commission.id)).map"))throw new Error("PATCH80C commission tabs anchor");
 write(file,s);
}
{
 const file="app/api/kpi/route.ts";let s=read(file);
 if(!s.includes("isInstitutionCommissionExcluded")){const a='import { getKpiDatabase } from "@/lib/netlify-db";';if(!s.includes(a))throw new Error("PATCH80C kpi import anchor");s=s.replace(a,a+'\nimport { isInstitutionCommissionExcluded } from "@/lib/institution-applicability";')}
 if(!s.includes("PATCH80C_EVALUATOR_GUARD")){
  const anchor='      const entries = Object.entries(scoreMap);';
  if(!s.includes(anchor))throw new Error("PATCH80C entries anchor");
  const guard=['      /* PATCH80C_EVALUATOR_GUARD */',
    '      if (session.role === "evaluator" && allowedCommission && await isInstitutionCommissionExcluded(institutionId, allowedCommission)) {',
    '        throw new AccessError("Bu bo‘lim ushbu muassasaga tatbiq etilmaydi.", 403);',
    '      }'].join("\n");
  s=s.replace(anchor,guard+"\n"+anchor);
 }
 write(file,s);
}
console.log("PATCH80C: evaluator/institution visibility and server guard added");