import fs from "node:fs";

const file="app/api/kpi/route.ts";
if(!fs.existsSync(file)) throw new Error("PATCH97 missing "+file);
let s=fs.readFileSync(file,"utf8");

const anchor = [
'        const todayEvaluationMap = new Map(',
'          (todayEvaluationResult.rows as Array<Record<string, unknown>>).map((row) => [String(row.criterionId), row]),',
'        );',
].join("\n");

const insert = anchor + '\n' + [
'        const patch97Today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());',
'        const patch97CycleStart = patch97Today >= "2026-10-05" && patch97Today <= "2026-10-31"',
'          ? "2026-10-05"',
'          : `${patch97Today.slice(0, 7)}-01`;',
'        const patch97CycleResult = await client.query(',
'          "SELECT DISTINCT criterion_id AS \\"criterionId\\" FROM daily_evaluations WHERE institution_id = $1 AND evaluation_date BETWEEN $2::date AND (NOW() AT TIME ZONE \'Asia/Tashkent\')::date",',
'          [institutionId, patch97CycleStart],',
'        );',
'        const patch97CycleCriterionIds = new Set(',
'          (patch97CycleResult.rows as Array<Record<string, unknown>>).map((row) => String(row.criterionId)),',
'        );',
].join("\n");

if(!s.includes("patch97CycleCriterionIds")){
  if(!s.includes(anchor)) throw new Error("PATCH97 todayEvaluationMap anchor missing");
  s=s.replace(anchor,insert);
}

const oldFilter = [
'        const changedEntries = entries.filter(([criterionId, score]) => {',
'          const previous = existingMap.get(criterionId);',
'          const note = (noteMap[criterionId] ?? "").trim();',
'          if (isPatch64DailyEvaluation(criterionId) && !todayEvaluationMap.has(criterionId)) return true;',
'          if (!previous) return true;',
'          return Number(previous.score) !== Number(score) || String(previous.note ?? "").trim() !== note;',
'        });',
].join("\n");

const newFilter = [
'        const changedEntries = entries.filter(([criterionId, score]) => {',
'          const previous = existingMap.get(criterionId);',
'          const note = (noteMap[criterionId] ?? "").trim();',
'          // New KPI month: every criterion must create at least one row in the current cycle,',
'          // even when its score is identical to the previous month.',
'          if (!patch97CycleCriterionIds.has(criterionId)) return true;',
'          if (isPatch64DailyEvaluation(criterionId) && !todayEvaluationMap.has(criterionId)) return true;',
'          if (!previous) return true;',
'          return Number(previous.score) !== Number(score) || String(previous.note ?? "").trim() !== note;',
'        });',
].join("\n");

if(s.includes(oldFilter)) s=s.replace(oldFilter,newFilter);
else if(!s.includes("if (!patch97CycleCriterionIds.has(criterionId)) return true;")) throw new Error("PATCH97 changedEntries anchor missing");

fs.writeFileSync(file,s,"utf8");
console.log("PATCH97: first score for every criterion in the new KPI month is saved even when equal to previous month; Oct cycle starts 2026-10-05.");
