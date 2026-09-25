import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error("PATCH68: anchor not found: " + label);
  return source.replace(from, to);
}

// Jami view must stay on the 100-point scale.
// For each criterion, use the average of all saved daily scores through today
// instead of summing them. The existing commission weighting then guarantees
// each direction cannot exceed its configured maximum and total KPI <= 100.
{
  const file = path.join(process.cwd(), "app/api/dashboard/route.ts");
  let s = fs.readFileSync(file, "utf8");

  s = replaceOnce(
    s,
    '                  SUM(score)::float8 AS score\n             FROM daily_evaluations\n            WHERE evaluation_date <= $1::date',
    '                  AVG(score)::float8 AS score\n             FROM daily_evaluations\n            WHERE evaluation_date <= $1::date',
    "cumulative average query",
  );

  s = replaceOnce(
    s,
    'accumulation: period === "monthly" ? "all-time-running-total" : "today"',
    'accumulation: period === "monthly" ? "all-time-average-on-100-point-scale" : "today"',
    "metadata",
  );

  fs.writeFileSync(file, s, "utf8");
}

// Update the explanatory copy so the UI matches the calculation.
{
  const file = path.join(process.cwd(), "components/public-dashboard.tsx");
  let s = fs.readFileSync(file, "utf8");

  s = s.replace(
    'reportPeriod === "daily" ? "Bugungi natija" : "Shu vaqtgacha yig‘ilgan jami ball"',
    'reportPeriod === "daily" ? "Bugungi natija" : "Shu vaqtgacha o‘rtacha jami ball"',
  );
  s = s.replace(
    'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Monitoring boshlanganidan bugungacha yig‘ilgan ballar"',
    'reportPeriod === "daily" ? "Bugungi baholashlar bo‘yicha" : "Monitoring boshlanganidan bugungacha o‘rtacha natija · maksimum 100 ball"',
  );
  s = s.replace(
    'reportPeriod === "daily" ? "bugungi baholash" : "shu vaqtgacha jami"',
    'reportPeriod === "daily" ? "bugungi baholash" : "shu vaqtgacha o‘rtacha"',
  );

  fs.writeFileSync(file, s, "utf8");
}

console.log("PATCH68: Jami dashboard now averages historical daily scores and remains on a maximum 100-point scale.");
