import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`PATCH31: anchor not found: ${label}`);
  return source.replace(from, to);
}

const dashboardPath = path.join(process.cwd(), "components/public-dashboard.tsx");
let dashboard = fs.readFileSync(dashboardPath, "utf8");

dashboard = replaceOnce(
  dashboard,
  'reportPeriod === "daily" ? "Bugungi natija" : "Oylik natija"',
  'reportPeriod === "daily" ? "Bugungi natija" : "30 kunlik o‘rtacha"',
  "monthly readout",
);

dashboard = replaceOnce(
  dashboard,
  'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Joriy oy o‘rtacha natijasi"',
  'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Oxirgi 30 kunning ish kunlari o‘rtachasi"',
  "monthly description",
);

dashboard = replaceOnce(
  dashboard,
  'reportPeriod === "daily" ? "bugungi baholash" : "joriy oy bo‘yicha"',
  'reportPeriod === "daily" ? "bugungi baholash" : "oxirgi 30 kun ish kunlari bo‘yicha"',
  "monthly metric copy",
);

fs.writeFileSync(dashboardPath, dashboard, "utf8");
console.log("PATCH31: public dashboard monthly copy now says rolling 30-day weekday average.");

const routePath = path.join(process.cwd(), "app/api/dashboard/route.ts");
let route = fs.readFileSync(routePath, "utf8");

route = replaceOnce(
  route,
  '    const monthStart = `${currentDate.slice(0, 7)}-01`;\n',
  '',
  "remove calendar month start",
);

const oldMonthly = `    const evaluationPromise = period === "monthly"
      ? db.pool.query(
          \`SELECT institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  AVG(score)::float8 AS score
             FROM daily_evaluations
            WHERE evaluation_date BETWEEN $1::date AND $2::date
            GROUP BY institution_id, criterion_id\`,
          [monthStart, currentDate],
        )
      : db.pool.query(`;

const newMonthly = `    const evaluationPromise = period === "monthly"
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

route = replaceOnce(route, oldMonthly, newMonthly, "rolling 30-day weekday query");

route = replaceOnce(
  route,
  '{ institutions, evaluations, period, currentDate }',
  '{ institutions, evaluations, period, currentDate, averagingDays: period === "monthly" ? "weekdays-in-last-30-days" : 1 }',
  "averaging metadata",
);

fs.writeFileSync(routePath, route, "utf8");
console.log("PATCH31: monthly mode averages only Monday-Friday inside the latest 30 calendar days; Saturday and Sunday are excluded, and unscored weekdays count as zero.");
