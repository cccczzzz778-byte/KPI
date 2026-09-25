import fs from "node:fs";
import path from "node:path";

function read(file) {
  if (!fs.existsSync(file)) throw new Error("PATCH69 missing " + file);
  return fs.readFileSync(file, "utf8");
}
function write(file, source) {
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH69: " + file);
}
function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error("PATCH69 anchor not found: " + label);
  return source.replace(from, to);
}

// 1) Public dashboard API.
// Kunlik = today's actual 0/1/2 score.
// Jami = per-criterion average of every saved daily score through today.
// Clamp historical values defensively to 0..2 before calculation.
{
  const file = path.join(process.cwd(), "app/api/dashboard/route.ts");
  let s = read(file);

  s = replaceOnce(
    s,
    '                  AVG(score)::float8 AS score\n             FROM daily_evaluations\n            WHERE evaluation_date <= $1::date',
    '                  AVG(LEAST(2, GREATEST(0, score)))::float8 AS score\n             FROM daily_evaluations\n            WHERE evaluation_date <= $1::date',
    "jami clamped average",
  );

  s = replaceOnce(
    s,
    '                  score::float8 AS score\n             FROM daily_evaluations\n            WHERE evaluation_date = $1::date',
    '                  LEAST(2, GREATEST(0, score))::float8 AS score\n             FROM daily_evaluations\n            WHERE evaluation_date = $1::date',
    "daily clamped score",
  );

  fs.writeFileSync(file, s, "utf8");
}

// 2) Public dashboard direction formula.
// A direction can never exceed its configured maximum.
// This guarantees total KPI cannot exceed 100.
{
  const file = path.join(process.cwd(), "components/public-dashboard.tsx");
  let s = read(file);
  const oldLine = '  return Number(((earned / (items.length * 2)) * getCommissionMaxScore(commissionId)).toFixed(1));';
  const newLine = [
    '  const maxScore = getCommissionMaxScore(commissionId);',
    '  if (!items.length) return 0;',
    '  const calculated = Number(((earned / (items.length * 2)) * maxScore).toFixed(1));',
    '  return Math.max(0, Math.min(maxScore, calculated));',
  ].join("\n");
  if (s.includes(oldLine)) s = s.replace(oldLine, newLine);
  else if (!s.includes('Math.min(maxScore, calculated)')) throw new Error("PATCH69 public formula anchor missing");
  write(file, s);
}

// 3) Admin/evaluator calculation uses the same protected formula.
{
  const file = path.join(process.cwd(), "components/kpi-app.tsx");
  let s = read(file);
  const oldLine = '  return Number(((earned / (items.length * 2)) * getCommissionMaxScore(commissionId)).toFixed(1));';
  const newLine = [
    '  const maxScore = getCommissionMaxScore(commissionId);',
    '  if (!items.length) return 0;',
    '  const calculated = Number(((earned / (items.length * 2)) * maxScore).toFixed(1));',
    '  return Math.max(0, Math.min(maxScore, calculated));',
  ].join("\n");
  if (s.includes(oldLine)) s = s.replace(oldLine, newLine);
  else if (!s.includes('Math.min(maxScore, calculated)')) throw new Error("PATCH69 app formula anchor missing");
  write(file, s);
}

// 4) Period/Excel report formula gets the same cap.
{
  const file = path.join(process.cwd(), "app/api/reports/kpi-period/route.ts");
  if (fs.existsSync(file)) {
    let s = read(file);
    const oldFn = 'function sc(raw:number,k:CommissionKey){return +((raw/(IDS[k].length*2))*M[k]).toFixed(1)}';
    const newFn = 'function sc(raw:number,k:CommissionKey){const max=M[k],v=+((raw/(IDS[k].length*2))*max).toFixed(1);return Math.max(0,Math.min(max,v))}';
    if (s.includes(oldFn)) s = s.replace(oldFn, newFn);
    write(file, s);
  }
}

console.log("PATCH69 scoring rules:");
console.log("- each saved criterion score = 0, 1 or 2");
console.log("- Kunlik = today's criterion scores");
console.log("- Jami = average of all saved daily scores per criterion through today");
console.log("- direction = (sum of criterion averages / (criterion count * 2)) * direction max");
console.log("- direction maxima = 10.3 + 29.4 + 23.5 + 13.3 + 23.5 = 100");
console.log("- every direction is capped at its max; total KPI therefore cannot exceed 100");
