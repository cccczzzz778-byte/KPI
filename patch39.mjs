import fs from 'node:fs';

for (const file of ['components/kpi-app.tsx','components/public-dashboard.tsx','components/evaluator-reference-panel.tsx']) {
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file,'utf8').split('\n');
  console.log(`PATCH39_DIAG_BEGIN ${file}`);
  lines.forEach((line, i) => {
    if (/draftScores|commissionScores|scoreFor|criterionCount|criteria\.filter|\/20|20\)|20\}|20<|\/ 20|score.*20|normalize|weighted|criterion\.title|criterion\.detail/.test(line)) {
      const from = Math.max(0, i - 2), to = Math.min(lines.length, i + 3);
      for (let j = from; j < to; j++) console.log(`${j+1}: ${lines[j]}`);
    }
  });
  console.log(`PATCH39_DIAG_END ${file}`);
}
