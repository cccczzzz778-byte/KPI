import fs from 'node:fs';

function read(file) {
  if (!fs.existsSync(file)) throw new Error('PATCH59 missing ' + file);
  return fs.readFileSync(file, 'utf8');
}
function write(file, source) {
  fs.writeFileSync(file, source, 'utf8');
  console.log('PATCH59: ' + file);
}
const helper = `function patch59IsCalendarDailyCriterion(item: { deadline?: unknown } | undefined) {
  const value = String(item?.deadline || "").toLocaleLowerCase("uz");
  return value.includes("har kuni") || value.includes("doimiy") || value.includes("muntazam") || value.includes("1 kun");
}

`;

// DAILY / DOIMIY / MUNTAZAM / 1-KUN:
// new Asia/Tashkent date opens immediately at 00:00; no 08:00 gate and no rolling 24h.
{
  const file = 'app/api/uploads/prepare/route.ts';
  let s = read(file);
  if (!s.includes('function patch59IsCalendarDailyCriterion')) {
    const a = 'export async function POST(';
    if (!s.includes(a)) throw new Error('PATCH59 prepare POST anchor missing');
    s = s.replace(a, helper + a);
  }
  const marker = '/* PATCH50_INSTITUTION_UPLOAD_HOURS_PREPARE */';
  const m = s.indexOf(marker);
  if (m < 0) throw new Error('PATCH59 prepare time marker missing');
  const gate = s.indexOf('if (!institutionUploadWindowOpen()) {', m);
  if (gate < 0) throw new Error('PATCH59 prepare time gate missing');
  s = s.slice(0, gate) + 'if (!patch59IsCalendarDailyCriterion(criterion) && !institutionUploadWindowOpen()) {' + s.slice(gate + 'if (!institutionUploadWindowOpen()) {'.length);
  write(file, s);
}

{
  const file = 'app/api/uploads/complete/route.ts';
  let s = read(file);
  if (!s.includes('function patch59IsCalendarDailyCriterion')) {
    const a = 'export async function POST(';
    if (!s.includes(a)) throw new Error('PATCH59 complete POST anchor missing');
    s = s.replace(a, helper + a);
  }

  // Remove the last remaining rolling 24-hour rule at final completion.
  const oldDaily = '  if (value.includes("har kuni") || value.includes("doimiy") || value.includes("muntazam") || value.includes("1 kun")) return 1;';
  if (s.includes(oldDaily)) {
    s = s.replace(oldDaily, '  if (value.includes("har kuni") || value.includes("doimiy") || value.includes("muntazam") || value.includes("1 kun")) return null; /* PATCH59_CALENDAR_DAY */');
  } else if (!s.includes('PATCH59_CALENDAR_DAY')) {
    throw new Error('PATCH59 complete recurrence daily anchor missing');
  }

  const marker = '/* PATCH50_INSTITUTION_UPLOAD_HOURS_COMPLETE */';
  const m = s.indexOf(marker);
  if (m < 0) throw new Error('PATCH59 complete time marker missing');
  const gate = s.indexOf('if (!institutionUploadWindowOpen()) {', m);
  if (gate < 0) throw new Error('PATCH59 complete time gate missing');
  const replacement = 'const patch59TimeCriterion = criteria.find((item) => item.id === intent.criterionId);\n      if (!patch59IsCalendarDailyCriterion(patch59TimeCriterion) && !institutionUploadWindowOpen()) {';
  s = s.slice(0, gate) + replacement + s.slice(gate + 'if (!institutionUploadWindowOpen()) {'.length);
  write(file, s);
}

// Institution UI must not hide/disable daily upload after 19:00 or before 08:00.
// Non-daily criteria are still protected by prepare + complete server checks above.
{
  const file = 'app/api/institution/route.ts';
  let s = read(file);
  if (!s.includes('PATCH59_UI_24H_DAILY')) {
    if (!s.includes('criteriaIsOpen,')) throw new Error('PATCH59 institution criteriaIsOpen response anchor missing');
    s = s.replace('criteriaIsOpen,', 'criteriaIsOpen: true, /* PATCH59_UI_24H_DAILY: server enforces non-daily 08:00-19:00 */');
  }
  write(file, s);
}

console.log('PATCH59: daily/doimiy/muntazam/1-kun opens immediately after 00:00 Asia/Tashkent.');
console.log('PATCH59: no rolling 24h wait remains at prepare or complete.');
console.log('PATCH59: daily-like criteria are uploadable 00:00-23:59, once per calendar date.');
console.log('PATCH59: weekly/10-day/monthly/60-day/180-day criteria keep their existing recurrence and 08:00-19:00 window.');
