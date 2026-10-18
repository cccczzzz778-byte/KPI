import fs from "node:fs";

const file = "app/api/reports/kpi-period/route.ts";
if (!fs.existsSync(file)) throw new Error("PATCH101: kpi-period route missing");
let source = fs.readFileSync(file, "utf8");

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error("PATCH101 anchor missing: " + label);
  source = source.replace(from, to);
}

// Keep the reporting month aligned with the KPI cycle used by the dashboard.
replaceOnce(
  'function range(p:P,e:string){return{start:p==="weekly"?shift(e,-6):p==="monthly"?e.slice(0,7)+"-01":e,end:e}}',
  'function kpiMonthStart(e:string){return e.slice(0,7)==="2026-10"&&e>="2026-10-05"?"2026-10-05":e.slice(0,7)+"-01"}\nfunction range(p:P,e:string){return{start:p==="weekly"?shift(e,-6):p==="monthly"?kpiMonthStart(e):e,end:e}}',
  "monthly KPI cycle start",
);

// Jami is a 100-point average, not a cumulative SUM of daily rows.
replaceOnce(
  'SUM(LEAST(2,GREATEST(0,score)))::float8 AS score',
  'AVG(LEAST(2,GREATEST(0,score)))::float8 AS score',
  "monthly AVG",
);

replaceOnce(
  'function scoreMonthly(raw:number,k:CommissionKey){\n  return +((raw/(IDS[k].length*2))*M[k]).toFixed(1);\n}\n',
  '',
  "remove uncapped monthly scorer",
);

replaceOnce(
  'parts[k]=p==="monthly"?scoreMonthly(raw,k):score(raw,k);',
  'parts[k]=score(raw,k);',
  "single capped score formula",
);

fs.writeFileSync(file, source, "utf8");
console.log("PATCH101: Jami calculation unified: monthly uses clamped AVG, the same capped direction weights, N/A normalization, and the KPI month boundary.");
