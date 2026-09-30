import fs from "node:fs";
function read(file){if(!fs.existsSync(file))throw new Error("PATCH81 missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.writeFileSync(file,source,"utf8");console.log("PATCH81: "+file)}
{
 const file="app/api/dashboard/route.ts";let s=read(file);
 if(!s.includes("ensureApplicabilityTable")){const a='import { getKpiDatabase } from "@/lib/netlify-db";';if(!s.includes(a))throw new Error("PATCH81 dashboard import anchor");s=s.replace(a,a+'\nimport { ensureApplicabilityTable } from "@/lib/institution-applicability";')}
 const db='    const db = getKpiDatabase();';if(!s.includes("await ensureApplicabilityTable();")){if(!s.includes(db))throw new Error("PATCH81 db anchor");s=s.replace(db,db+'\n    await ensureApplicabilityTable();')}
 const p='    const [institutionResult, evaluationResult] = await Promise.all([institutionPromise, evaluationPromise]);';
 if(s.includes(p))s=s.replace(p,'    const exclusionPromise = db.pool.query("SELECT institution_id AS \\"institutionId\\", commission FROM institution_commission_exclusions");\n    const [institutionResult, evaluationResult, exclusionResult] = await Promise.all([institutionPromise, evaluationPromise, exclusionPromise]);');
 else if(!s.includes("exclusionResult"))throw new Error("PATCH81 promise anchor");
 const r='{ institutions, evaluations, period, currentDate, accumulation: period === "monthly" ? "all-time-average-on-100-point-scale" : "today" }';
 if(s.includes(r))s=s.replace(r,'{ institutions, evaluations, exclusions: exclusionResult.rows.map((row) => ({ institutionId: String(row.institutionId), commission: String(row.commission) })), period, currentDate, accumulation: period === "monthly" ? "all-time-average-on-100-point-scale" : "today" }');
 else if(!s.includes("exclusions: exclusionResult.rows.map"))throw new Error("PATCH81 response anchor");
 write(file,s);
}
{
 const file="components/public-dashboard.tsx";let s=read(file);
 const typeFrom='type DashboardPayload = { institutions: Institution[]; evaluations: Evaluation[]; error?: string };';
 const typeTo='type DashboardPayload = { institutions: Institution[]; evaluations: Evaluation[]; exclusions?: Array<{ institutionId:string; commission:CommissionKey }>; error?: string };';
 if(!s.includes("exclusions?: Array<{ institutionId:string; commission:CommissionKey }>")){if(!s.includes(typeFrom))throw new Error("PATCH81 payload type anchor");s=s.replace(typeFrom,typeTo)}
 const oldBlock='const ranking = useMemo(() => data.institutions.map((institution) => {\n    const parts = Object.fromEntries(\n      commissions.map((commission) => [commission.id, commissionScore(commission.id, institution.id, selectedRound, evaluationMap)]),\n    ) as Record<CommissionKey, number>;\n    const total = Number(commissions.reduce((sum, commission) => sum + parts[commission.id], 0).toFixed(1));\n    const evaluated = data.evaluations.some((item) => item.institutionId === institution.id && item.roundDay === selectedRound);\n    return { institution, parts, total, evaluated };\n  }).sort((a, b) => b.total - a.total || a.institution.name.localeCompare(b.institution.name, "uz")), [data, evaluationMap, selectedRound]);';
 const newBlock='const ranking = useMemo(() => data.institutions.map((institution) => {\n    const excludedDirections = new Set<CommissionKey>((data.exclusions ?? []).filter((item) => item.institutionId === institution.id).map((item) => item.commission));\n    const parts = Object.fromEntries(\n      commissions.map((commission) => [commission.id, excludedDirections.has(commission.id) ? 0 : commissionScore(commission.id, institution.id, selectedRound, evaluationMap)]),\n    ) as Record<CommissionKey, number>;\n    const applicable = commissions.filter((commission) => !excludedDirections.has(commission.id));\n    const rawTotal = applicable.reduce((sum, commission) => sum + parts[commission.id], 0);\n    const applicableMaximum = applicable.reduce((sum, commission) => sum + getCommissionMaxScore(commission.id), 0);\n    const total = applicableMaximum > 0 ? Number(((rawTotal / applicableMaximum) * 100).toFixed(1)) : 0;\n    const evaluated = data.evaluations.some((item) => item.institutionId === institution.id && item.roundDay === selectedRound);\n    return { institution, parts, total, evaluated, excludedDirections: Array.from(excludedDirections) };\n  }).sort((a, b) => b.total - a.total || a.institution.name.localeCompare(b.institution.name, "uz")), [data, evaluationMap, selectedRound]);';
 if(!s.includes("applicableMaximum > 0")){if(!s.includes(oldBlock))throw new Error("PATCH81 ranking anchor");s=s.replace(oldBlock,newBlock)}
 const renderOld='{commissions.map((commission) => <TableCell key={commission.id} className="score-col"><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></TableCell>)}';
 const renderNew='{commissions.map((commission) => <TableCell key={commission.id} className="score-col">{row.excludedDirections.includes(commission.id) ? <><strong>N/A</strong><span>tatbiq etilmaydi</span></> : <><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></>}</TableCell>)}';
 if(!s.includes("row.excludedDirections.includes(commission.id)")){if(!s.includes(renderOld))throw new Error("PATCH81 render anchor");s=s.replace(renderOld,renderNew)}
 write(file,s);
}

console.log("PATCH81: excluded directions are N/A and remaining directions normalize to 100 on public dashboard");