import fs from "node:fs";

const file = "app/api/dashboard/route.ts";
if (!fs.existsSync(file)) throw new Error("PATCH102: dashboard route missing");
let source = fs.readFileSync(file, "utf8");

const from = 'AVG(LEAST(2, GREATEST(0, score)))::float8 AS score';
const to = '(ARRAY_AGG(LEAST(2, GREATEST(0, score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score';

if (!source.includes(from)) {
  throw new Error("PATCH102: dashboard Jami AVG expression anchor missing");
}
source = source.replace(from, to);
fs.writeFileSync(file, source, "utf8");

console.log("PATCH102: Dashboard Jami now uses the latest saved score per criterion. If every criterion in a direction is at 2, that direction displays its exact configured maximum.");
