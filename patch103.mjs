import fs from "node:fs";

const files = [
  "app/api/reports/monitoring-scores/route.ts",
  "app/api/reports/kpi-period/route.ts",
  "app/api/period-comparison/route.ts",
];

const from = "AVG(LEAST(2,GREATEST(0,score)))::float8 AS score";
const to = "(ARRAY_AGG(LEAST(2,GREATEST(0,score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score";

for (const file of files) {
  if (!fs.existsSync(file)) throw new Error("PATCH103 missing " + file);
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error("PATCH103 latest-score anchor missing in " + file);
  source = source.replaceAll(from, to);
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH103: latest criterion score enabled in " + file);
}

console.log("PATCH103: dashboard/monitoring/jamlanma/Excel/report calculations now use the latest saved criterion score. A direction with all criteria at 2 displays its exact configured maximum everywhere.");
