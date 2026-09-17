import fs from 'node:fs';

const file = 'app/api/uploads/prepare/route.ts';
if (!fs.existsSync(file)) throw new Error('PATCH58 missing '+file);
let s = fs.readFileSync(file,'utf8');

// All daily-like criteria use the Tashkent calendar day, not a rolling 24-hour timer.
// Same-day duplicate protection in the institution upload flow remains active.
// Global upload hours remain 08:00-19:00.
const patched = '      if (recurrenceCriterionId !== "p03-04" && (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun"))) intervalDays = 1;';
const original = '      if (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun")) intervalDays = 1;';
if (s.includes(patched)) {
  s = s.replace(patched, '      if (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun")) intervalDays = null;');
} else if (s.includes(original)) {
  s = s.replace(original, '      if (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun")) intervalDays = null;');
} else if (!s.includes('intervalDays = null; /* PATCH58_CALENDAR_DAILY */')) {
  throw new Error('PATCH58 daily recurrence anchor missing');
}
s = s.replace('intervalDays = null;', 'intervalDays = null; /* PATCH58_CALENDAR_DAILY */');
fs.writeFileSync(file,s,'utf8');
console.log('PATCH58: all daily/doimiy/muntazam/1-kun criteria are calendar-daily; no 24h wait.');
console.log('PATCH58: one upload per criterion per Tashkent date; upload window 08:00-19:00 remains.');
