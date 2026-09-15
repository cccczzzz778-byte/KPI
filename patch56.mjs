import fs from 'node:fs';

function patch(file, from, to) {
  if (!fs.existsSync(file)) throw new Error('PATCH56 missing '+file);
  let s = fs.readFileSync(file,'utf8');
  if (!s.includes(from)) throw new Error('PATCH56 anchor missing in '+file);
  s = s.replace(from,to);
  fs.writeFileSync(file,s,'utf8');
  console.log('PATCH56: '+file);
}

// p03-04 is explicitly calendar-daily: one upload on each Tashkent calendar day.
// Do NOT impose a rolling 24-hour cooldown on this criterion. The existing
// same-day guard still prevents a second upload on the same date, and the
// global institution window still limits uploads to 08:00-19:00.
patch(
  'app/api/uploads/prepare/route.ts',
  '      if (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun")) intervalDays = 1;',
  '      if (recurrenceCriterionId !== "p03-04" && (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun"))) intervalDays = 1;',
);

patch(
  'app/api/uploads/complete/route.ts',
  '          const intervalDays = recurrenceIntervalDays(criterion.deadline);',
  '          const intervalDays = intent.criterionId === "p03-04" ? null : recurrenceIntervalDays(criterion.deadline);',
);

console.log('PATCH56: p03-04 = one upload per Asia/Tashkent calendar day, 08:00-19:00.');
console.log('PATCH56: no other Raqamlashtirish criterion cadence changed.');
