import fs from 'node:fs';

const file = 'app/api/uploads/prepare/route.ts';
if (!fs.existsSync(file)) throw new Error('PATCH56 missing '+file);
let s = fs.readFileSync(file,'utf8');

// p03-04 is explicitly calendar-daily: one upload on each Asia/Tashkent calendar day.
// Skip PATCH41's rolling 24-hour cooldown only for this criterion. The upload route's
// existing same-calendar-day check still prevents a second file on the same date,
// and the global institution upload window remains 08:00-19:00.
const from = '      if (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun")) intervalDays = 1;';
const to = '      if (recurrenceCriterionId !== "p03-04" && (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun"))) intervalDays = 1;';
if (s.includes(from)) s = s.replace(from,to);
else if (!s.includes(to)) throw new Error('PATCH56 prepare anchor missing');
fs.writeFileSync(file,s,'utf8');

console.log('PATCH56: p03-04 = one upload per Asia/Tashkent calendar day, 08:00-19:00.');
console.log('PATCH56: current complete route already enforces same-day duplicate protection; no stale complete-route anchor is patched.');
console.log('PATCH56: no other Raqamlashtirish criterion cadence changed.');
