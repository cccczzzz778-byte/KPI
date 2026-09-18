import fs from 'node:fs';

function read(file) {
  if (!fs.existsSync(file)) throw new Error('PATCH60 missing ' + file);
  return fs.readFileSync(file, 'utf8');
}
function write(file, source) {
  fs.writeFileSync(file, source, 'utf8');
  console.log('PATCH60: ' + file);
}

// Correct rule:
// 1) daily/doimiy/muntazam/1-kun cadence resets by Asia/Tashkent CALENDAR DATE at 00:00;
// 2) actual institution upload is allowed only 08:00-19:00;
// 3) therefore there is no rolling 24-hour wait.
{
  const file = 'app/api/uploads/prepare/route.ts';
  let s = read(file);
  const from = 'if (!patch59IsCalendarDailyCriterion(criterion) && !institutionUploadWindowOpen()) {';
  if (s.includes(from)) s = s.replace(from, 'if (!institutionUploadWindowOpen()) { /* PATCH60_ALL_UPLOADS_08_19 */');
  else if (!s.includes('PATCH60_ALL_UPLOADS_08_19')) throw new Error('PATCH60 prepare hour gate anchor missing');
  write(file, s);
}

{
  const file = 'app/api/uploads/complete/route.ts';
  let s = read(file);
  const from = 'const patch59TimeCriterion = criteria.find((item) => item.id === intent.criterionId);\n      if (!patch59IsCalendarDailyCriterion(patch59TimeCriterion) && !institutionUploadWindowOpen()) {';
  if (s.includes(from)) {
    s = s.replace(from, 'if (!institutionUploadWindowOpen()) { /* PATCH60_ALL_UPLOADS_08_19 */');
  } else if (!s.includes('PATCH60_ALL_UPLOADS_08_19')) {
    throw new Error('PATCH60 complete hour gate anchor missing');
  }
  if (!s.includes('PATCH59_CALENDAR_DAY')) throw new Error('PATCH60 calendar-day recurrence fix missing');
  write(file, s);
}

{
  const file = 'app/api/institution/route.ts';
  let s = read(file);
  const from = 'criteriaIsOpen: true, /* PATCH59_UI_24H_DAILY: server enforces non-daily 08:00-19:00 */';
  if (s.includes(from)) {
    s = s.replace(from, 'criteriaIsOpen, /* PATCH60_UI_08_19 */');
  } else if (!s.includes('PATCH60_UI_08_19')) {
    throw new Error('PATCH60 institution UI hour anchor missing');
  }
  write(file, s);
}

console.log('PATCH60: day changes at 00:00 Asia/Tashkent for daily-like recurrence; no 24h wait.');
console.log('PATCH60: actual file upload remains open only 08:00-19:00 for all institution criteria.');
console.log('PATCH60: if uploaded yesterday at 18:59, today it may upload again from 08:00.');
