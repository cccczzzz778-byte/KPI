import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`PATCH65: anchor not found: ${label}`);
  return source.replace(from, to);
}

// Public dashboard: "Oylik" now means the running total collected in the current month.
// Every saved daily score remains 0/1/2 for that criterion/day; monthly mode SUMs those rows.
const dashboardPath = path.join(process.cwd(), "components/public-dashboard.tsx");
let dashboard = fs.readFileSync(dashboardPath, "utf8");

dashboard = replaceOnce(
  dashboard,
  'reportPeriod === "daily" ? "Bugungi natija" : "30 kunlik o‘rtacha"',
  'reportPeriod === "daily" ? "Bugungi natija" : "Shu vaqtgacha jami ball"',
  "monthly readout",
);

dashboard = replaceOnce(
  dashboard,
  'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Oxirgi 30 kunning ish kunlari o‘rtachasi"',
  'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Joriy oy boshidan bugungacha yig‘ilgan ballar"',
  "monthly description",
);

dashboard = replaceOnce(
  dashboard,
  'reportPeriod === "daily" ? "bugungi baholash" : "oxirgi 30 kun ish kunlari bo‘yicha"',
  'reportPeriod === "daily" ? "bugungi baholash" : "joriy oy yig‘indisi"',
  "monthly metric copy",
);

fs.writeFileSync(dashboardPath, dashboard, "utf8");
console.log("PATCH65: public dashboard monthly labels changed to running cumulative total.");

const routePath = path.join(process.cwd(), "app/api/dashboard/route.ts");
let route = fs.readFileSync(routePath, "utf8");

route = replaceOnce(
  route,
  '    const currentDate = tashkentDate();\n    const db = getKpiDatabase();',
  '    const currentDate = tashkentDate();\n    const monthStart = `${currentDate.slice(0, 7)}-01`;\n    const db = getKpiDatabase();',
  "month start",
);

const oldMonthly = `    const evaluationPromise = period === "monthly"
      ? db.pool.query(
          \`SELECT institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  (SUM(score)::float8 / NULLIF((
                    SELECT COUNT(*)::float8
                    FROM generate_series(
                      (($1::date - INTERVAL '29 days')::date),
                      $1::date,
                      INTERVAL '1 day'
                    ) AS d(day)
                    WHERE EXTRACT(ISODOW FROM d.day) BETWEEN 1 AND 5
                  ), 0)) AS score
             FROM daily_evaluations
            WHERE evaluation_date BETWEEN (($1::date - INTERVAL '29 days')::date) AND $1::date
              AND EXTRACT(ISODOW FROM evaluation_date) BETWEEN 1 AND 5
            GROUP BY institution_id, criterion_id\`,
          [currentDate],
        )
      : db.pool.query(`;

const newMonthly = `    const evaluationPromise = period === "monthly"
      ? db.pool.query(
          \`SELECT institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  SUM(score)::float8 AS score
             FROM daily_evaluations
            WHERE evaluation_date BETWEEN $1::date AND $2::date
            GROUP BY institution_id, criterion_id\`,
          [monthStart, currentDate],
        )
      : db.pool.query(`;

route = replaceOnce(route, oldMonthly, newMonthly, "monthly sum query");

route = replaceOnce(
  route,
  '{ institutions, evaluations, period, currentDate, averagingDays: period === "monthly" ? "weekdays-in-last-30-days" : 1 }',
  '{ institutions, evaluations, period, currentDate, accumulation: period === "monthly" ? "current-month-running-total" : "today" }',
  "response metadata",
);

fs.writeFileSync(routePath, route, "utf8");
console.log("PATCH65: monthly dashboard now SUMs daily_evaluations from month start through today; no averaging and no weekday exclusion.");
console.log("PATCH65: each daily criterion score still stays within the existing 0/1/2 validation, so daily Raqamlashtirish points accumulate day by day.");
