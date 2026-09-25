import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`PATCH66: anchor not found: ${label}`);
  return source.replace(from, to);
}

// "Oylik" is not a month report anymore. It is the cumulative score collected
// from the start of monitoring up to today.
{
  const file = path.join(process.cwd(), "components/public-dashboard.tsx");
  let s = fs.readFileSync(file, "utf8");

  s = replaceOnce(
    s,
    '>Oylik</button>',
    '>Jami</button>',
    "toggle label",
  );

  s = replaceOnce(
    s,
    'reportPeriod === "daily" ? "Bugungi natija" : "Shu vaqtgacha jami ball"',
    'reportPeriod === "daily" ? "Bugungi natija" : "Shu vaqtgacha yig‘ilgan jami ball"',
    "readout",
  );

  s = replaceOnce(
    s,
    'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Joriy oy boshidan bugungacha yig‘ilgan ballar"',
    'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Monitoring boshlanganidan bugungacha yig‘ilgan ballar"',
    "description",
  );

  s = replaceOnce(
    s,
    'reportPeriod === "daily" ? "bugungi baholash" : "joriy oy yig‘indisi"',
    'reportPeriod === "daily" ? "bugungi baholash" : "shu vaqtgacha jami"',
    "metric copy",
  );

  fs.writeFileSync(file, s, "utf8");
}

// Cumulative mode must not reset at the beginning of a calendar month.
// Keep every historical daily score and sum it through the current Tashkent date.
{
  const file = path.join(process.cwd(), "app/api/dashboard/route.ts");
  let s = fs.readFileSync(file, "utf8");

  s = replaceOnce(
    s,
    '    const monthStart = `${currentDate.slice(0, 7)}-01`;\n',
    '',
    "remove month start",
  );

  const oldQuery = `    const evaluationPromise = period === "monthly"
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

  const newQuery = `    const evaluationPromise = period === "monthly"
      ? db.pool.query(
          \`SELECT institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  SUM(score)::float8 AS score
             FROM daily_evaluations
            WHERE evaluation_date <= $1::date
            GROUP BY institution_id, criterion_id\`,
          [currentDate],
        )
      : db.pool.query(`;

  s = replaceOnce(s, oldQuery, newQuery, "all-time cumulative query");

  s = replaceOnce(
    s,
    '{ institutions, evaluations, period, currentDate, accumulation: period === "monthly" ? "current-month-running-total" : "today" }',
    '{ institutions, evaluations, period, currentDate, accumulation: period === "monthly" ? "all-time-running-total" : "today" }',
    "metadata",
  );

  fs.writeFileSync(file, s, "utf8");
}

console.log("PATCH66: public Jami view now sums all saved daily scores through today and no longer resets each month.");
console.log("PATCH66: each saved daily score remains constrained by the existing 0/1/2 validation.");
