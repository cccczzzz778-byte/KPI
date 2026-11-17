import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const w=(rel,txt)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,txt,"utf8");console.log("PATCH109: wrote "+rel);};
w("lib/kpi-month-overrides.ts",fs.readFileSync("patch109.kpi-month-overrides.ts.txt","utf8"));
function edit(rel,pairs){const p=path.join(root,rel);let s=fs.readFileSync(p,"utf8");for(const [a,b,label] of pairs){if(!s.includes(a))throw new Error("PATCH109 anchor missing: "+rel+" :: "+label);s=s.replace(a,b);}fs.writeFileSync(p,s,"utf8");console.log("PATCH109: patched "+rel);}
const IMP='import { getMonthOverride } from "@/lib/kpi-month-overrides";\n';

// 1) Davriy taqqoslash (oldingi/joriy oy)
edit("app/api/period-comparison/route.ts",[
 ['import { criteria, type CommissionKey } from "@/lib/kpi-data";\n','import { criteria, type CommissionKey } from "@/lib/kpi-data";\nimport { getMonthOverride, KPI_MONTH_OVERRIDES } from "@/lib/kpi-month-overrides";\n',"import"],
 ['function buildPeriodScores(rows: any[], exclusions: Map<string, Set<CommissionKey>>) {','function buildPeriodScores(rows: any[], exclusions: Map<string, Set<CommissionKey>>, monthKey = "") {',"signature"],
 ['  return totals;\n}','  return applyOverrides(totals, monthKey);\n}\n\nfunction applyOverrides(totals: Map<string, { total: number; hasEvaluation: boolean }>, monthKey: string) {\n  if (!monthKey) return totals;\n  const ids = new Set<string>([...totals.keys()]);\n  for (const id of Object.keys(KPI_MONTH_OVERRIDES[monthKey] || {})) ids.add(id);\n  for (const id of ids) {\n    const override = getMonthOverride(monthKey, id);\n    if (!override) continue;\n    const applicable = KEYS.filter((key) => override[key] !== null);\n    const rawTotal = applicable.reduce((sum, key) => sum + Number(override[key] || 0), 0);\n    const maxTotal = applicable.reduce((sum, key) => sum + MAX[key], 0);\n    totals.set(id, { total: maxTotal > 0 ? Number(((rawTotal / maxTotal) * 100).toFixed(1)) : 0, hasEvaluation: true });\n  }\n  return totals;\n}',"return"],
 ['const current = buildPeriodScores(currentResult.rows, exclusions);','const current = buildPeriodScores(currentResult.rows, exclusions, currentKey);',"current"],
 ['const previous = buildPeriodScores(previousResult.rows, exclusions);','const previous = buildPeriodScores(previousResult.rows, exclusions, previousKey);',"previous"],
]);

// 2) Monitoring Excel hisobot (oy tanlanganda)
edit("app/api/reports/monitoring-scores/route.ts",[
 ['import { getKpiDatabase } from "@/lib/netlify-db";\n','import { getKpiDatabase } from "@/lib/netlify-db";\n'+IMP,"import"],
 ['      const excluded=excludedMap.get(id)??new Set<CommissionKey>();\n      const parts=Object.fromEntries(KEYS.map((key)=>[key,0])) as Record<CommissionKey,number>;\n','      const override=getMonthOverride(selectedMonth,id);\n      const excluded=override?new Set<CommissionKey>(KEYS.filter((key)=>override[key]===null)):(excludedMap.get(id)??new Set<CommissionKey>());\n      const parts=Object.fromEntries(KEYS.map((key)=>[key,0])) as Record<CommissionKey,number>;\n',"excluded"],
 ['        parts[key]=score(raw,key);\n      }\n','        parts[key]=score(raw,key);\n        if(override)parts[key]=Number(override[key]||0);\n      }\n',"parts"],
]);

// 3) Ommaviy dashboard (oylik reyting)
edit("components/public-dashboard.tsx",[
 ['import { commissions, criteria, rounds, type CommissionKey } from "@/lib/kpi-data";\n','import { commissions, criteria, rounds, type CommissionKey } from "@/lib/kpi-data";\n'+IMP,"import"],
 ['  const ranking = useMemo(() => data.institutions.map((institution) => {\n    const excludedDirections = new Set<CommissionKey>((data.exclusions ?? []).filter((item) => item.institutionId === institution.id).map((item) => item.commission));\n    const parts = Object.fromEntries(\n      commissions.map((commission) => [commission.id, excludedDirections.has(commission.id) ? 0 : commissionScore(commission.id, institution.id, selectedRound, evaluationMap)]),\n    ) as Record<CommissionKey, number>;',
  '  const ranking = useMemo(() => data.institutions.map((institution) => {\n    const override = getMonthOverride(data.selectedMonth || selectedMonth, institution.id);\n    const excludedDirections = override ? new Set<CommissionKey>(commissions.filter((commission) => override[commission.id] === null).map((commission) => commission.id)) : new Set<CommissionKey>((data.exclusions ?? []).filter((item) => item.institutionId === institution.id).map((item) => item.commission));\n    const parts = Object.fromEntries(\n      commissions.map((commission) => [commission.id, excludedDirections.has(commission.id) ? 0 : override ? Number(override[commission.id] || 0) : commissionScore(commission.id, institution.id, selectedRound, evaluationMap)]),\n    ) as Record<CommissionKey, number>;',"ranking"],
 ['    const evaluated = data.evaluations.some((item) => item.institutionId === institution.id && item.roundDay === selectedRound);','    const evaluated = Boolean(override) || data.evaluations.some((item) => item.institutionId === institution.id && item.roundDay === selectedRound);',"evaluated"],
 ['}).sort((a, b) => b.total - a.total || a.institution.name.localeCompare(b.institution.name, "uz")), [data, evaluationMap, selectedRound]);','}).sort((a, b) => b.total - a.total || a.institution.name.localeCompare(b.institution.name, "uz")), [data, evaluationMap, selectedRound, selectedMonth]);',"deps"],
]);

// 4) Admin/baholovchi paneli reytingi
edit("components/kpi-app.tsx",[
 ['import { AdminMonthEditor } from "@/components/admin-month-editor";\n','import { AdminMonthEditor } from "@/components/admin-month-editor";\n'+IMP,"import"],
 ['  const ranking = useMemo(() => data.institutions.filter((item) => item.active !== 0).map((institution) => {\n    const excludedDirections = new Set<CommissionKey>(\n      commissionExclusions.filter((item) => item.institutionId === institution.id).map((item) => item.commission),\n    );',
  '  const ranking = useMemo(() => data.institutions.filter((item) => item.active !== 0).map((institution) => {\n    const override = getMonthOverride(selectedKpiMonth, institution.id);\n    const excludedDirections = override ? new Set<CommissionKey>(commissions.filter((commission) => override[commission.id] === null).map((commission) => commission.id)) : new Set<CommissionKey>(\n      commissionExclusions.filter((item) => item.institutionId === institution.id).map((item) => item.commission),\n    );',"excl"],
 ['      return [commission.id, getCommissionDraftScore(commission.id, scoreSource)];','      return [commission.id, override ? Number(override[commission.id] || 0) : getCommissionDraftScore(commission.id, scoreSource)];',"parts"],
 ['    const hasEvaluation = data.dailyEvaluations.some((evaluation) => {','    const hasEvaluation = Boolean(override) || data.dailyEvaluations.some((evaluation) => {',"has"],
]);
console.log("PATCH109: Sentabr/Oktabr Excel ballari joriy qilindi.");
