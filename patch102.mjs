import fs from "node:fs";

const file = "app/api/dashboard/route.ts";
if (!fs.existsSync(file)) throw new Error("PATCH102: dashboard route missing");
let source = fs.readFileSync(file, "utf8");

const from = `          \`SELECT institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  AVG(LEAST(2, GREATEST(0, score)))::float8 AS score
             FROM daily_evaluations
            WHERE evaluation_date <= $1::date
            GROUP BY institution_id, criterion_id\`,`;

const to = `          \`SELECT DISTINCT ON (institution_id, criterion_id)
                  institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  LEAST(2, GREATEST(0, score))::float8 AS score
             FROM daily_evaluations
            WHERE evaluation_date <= $1::date
            ORDER BY institution_id, criterion_id, evaluation_date DESC, updated_at DESC\`,`;

if (!source.includes(from)) {
  throw new Error("PATCH102: Jami dashboard historical-average query anchor missing");
}
source = source.replace(from, to);
fs.writeFileSync(file, source, "utf8");

console.log("PATCH102: Dashboard Jami now uses the latest saved score per criterion. If every criterion in a direction is at 2, that direction displays its exact configured maximum.");
