import fs from 'node:fs';
import path from 'node:path';

function printMatches(relative, patterns, radius = 8) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) {
    console.log(`PATCH25-DIAG: missing ${relative}`);
    return;
  }
  const lines = fs.readFileSync(target, 'utf8').split('\n');
  console.log(`PATCH25-DIAG-BEGIN ${relative}`);
  const wanted = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some((pattern) => pattern.test(lines[i]))) {
      for (let j = Math.max(0, i - radius); j <= Math.min(lines.length - 1, i + radius); j++) wanted.add(j);
    }
  }
  [...wanted].sort((a,b) => a-b).forEach((i) => console.log(`${i + 1}: ${lines[i]}`));
  console.log(`PATCH25-DIAG-END ${relative}`);
}

printMatches('app/api/kpi/route.ts', [/evaluation/i, /round_day/i, /INSERT INTO evaluations/i, /ON CONFLICT/i, /SELECT .*evaluations/i], 14);
printMatches('components/kpi-app.tsx', [/type Evaluation/i, /evaluations:/i, /selectedRound/i, /setScores/i, /saveEvaluation/i, /institutionProgress/i, /draftTotal/i], 10);
printMatches('lib/netlify-db.ts', [/evaluations/i, /migration/i, /CREATE TABLE/i], 10);

const migrationRoot = path.join(process.cwd(), 'db', 'migrations');
if (fs.existsSync(migrationRoot)) {
  for (const entry of fs.readdirSync(migrationRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sql = path.join(migrationRoot, entry.name, 'migration.sql');
    if (!fs.existsSync(sql)) continue;
    const text = fs.readFileSync(sql, 'utf8');
    if (/evaluations|round_day/i.test(text)) {
      console.log(`PATCH25-DIAG-MIGRATION-BEGIN ${entry.name}`);
      console.log(text);
      console.log(`PATCH25-DIAG-MIGRATION-END ${entry.name}`);
    }
  }
}
console.log('PATCH25-DIAG: inspection only.');
