import fs from 'node:fs';
import path from 'node:path';

function printMatches(relative, patterns, radius = 12) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) {
    console.log(`PATCH26-DIAG: missing ${relative}`);
    return;
  }
  const lines = fs.readFileSync(target, 'utf8').split('\n');
  console.log(`PATCH26-DIAG-BEGIN ${relative}`);
  const wanted = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some((pattern) => pattern.test(lines[i]))) {
      for (let j = Math.max(0, i - radius); j <= Math.min(lines.length - 1, i + radius); j++) wanted.add(j);
    }
  }
  [...wanted].sort((a, b) => a - b).forEach((i) => console.log(`${i + 1}: ${lines[i]}`));
  console.log(`PATCH26-DIAG-END ${relative}`);
}

printMatches('components/institution-portal.tsx', [/submitted/i, /submissionDate/i, /uploadCriterion/i, /institution_submission/i, /Bugun yuklangan/i, /har kuni/i], 16);
printMatches('app/api/institution/route.ts', [/attachment/i, /submission_date/i, /institution_submission/i, /institution'/i], 16);
printMatches('app/api/uploads/prepare/route.ts', [/institution_submission/i, /submission_date/i, /existing/i, /criterion/i, /round_day/i], 18);
printMatches('app/api/uploads/complete/route.ts', [/institution_submission/i, /submission_date/i, /existing/i, /criterion/i, /round_day/i], 18);
console.log('PATCH26-DIAG: inspection only.');
