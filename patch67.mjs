import fs from "node:fs";

function read(file) {
  if (!fs.existsSync(file)) throw new Error("PATCH67 missing " + file);
  return fs.readFileSync(file, "utf8");
}
function write(file, source) {
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH67: " + file);
}

// Restore criterion-specific upload recurrence for Raqamlashtirish.
// A Raqamlashtirish criterion is daily only when its own deadline says
// har kuni / doimiy / muntazam / 1 kun. Weekly/monthly/10/60/180-day
// criteria keep those exact periods.
for (const file of ["app/api/uploads/prepare/route.ts", "app/api/uploads/complete/route.ts"]) {
  let s = read(file);

  s = s.replaceAll(
    'if (recurrenceCriterion.commission === "raqam" || patch62IsDaily(recurrenceCriterion.deadline)) {',
    'if (patch62IsDaily(recurrenceCriterion.deadline)) {',
  );
  s = s.replaceAll(
    'if (criterion.commission === "raqam" || patch62IsDaily(criterion.deadline)) {',
    'if (patch62IsDaily(criterion.deadline)) {',
  );
  s = s.replaceAll(
    'const message = criterion.commission === "raqam" || patch62IsDaily(criterion.deadline)',
    'const message = patch62IsDaily(criterion.deadline)',
  );

  write(file, s);
}

// Institution UI must mirror the same deadline-based recurrence.
{
  const file = "components/institution-portal.tsx";
  let s = read(file);
  s = s.replaceAll(
    '      const daily = criterion.commission === "raqam"\n        || deadline.includes("har kuni")',
    '      const daily = deadline.includes("har kuni")',
  );
  write(file, s);
}

console.log("PATCH67: Raqamlashtirish upload cadence restored to each criterion deadline.");
console.log("PATCH67: daily/doimiy = every day; weekly = 7 days; 10-day = 10 days; monthly = 30 days; 60-day = 60 days; half-year = 180 days.");
