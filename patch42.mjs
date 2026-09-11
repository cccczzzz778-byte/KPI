import fs from 'node:fs';

function snippet(file, marker, before = 1200, after = 5000) {
  const text = fs.readFileSync(file, 'utf8');
  const i = text.indexOf(marker);
  console.log(`\n===== PATCH42 AUDIT ${file} :: ${marker} :: index=${i} =====`);
  if (i < 0) return;
  console.log(text.slice(Math.max(0, i - before), Math.min(text.length, i + after)));
}

snippet('components/kpi-app.tsx', 'function openEvaluation', 500, 7000);
snippet('components/kpi-app.tsx', 'save_evaluation', 2500, 5000);
snippet('app/api/kpi/route.ts', 'if (payload.action === "save_evaluation")', 500, 9500);
snippet('app/api/uploads/complete/route.ts', 'export async function POST', 500, 10000);
snippet('components/institution-portal.tsx', 'institution-file-picker', 2000, 9000);
console.log('PATCH42 AUDIT COMPLETE');
