import fs from 'node:fs';

const appFile = 'components/kpi-app.tsx';
let app = fs.readFileSync(appFile, 'utf8');
const compact = '    const todayRows = data.dailyEvaluations.filter((item) => item.institutionId === institution.id && item.evaluationDate === today);';
const expanded = '  const todayRows = data.dailyEvaluations.filter(\n    (item) => item.institutionId === institution.id && item.evaluationDate === today,\n  );';
if (!app.includes(compact)) throw new Error('PATCH44: compact todayRows anchor not found');
app = app.replace(compact, expanded);
fs.writeFileSync(appFile, app, 'utf8');

await import('./patch43.mjs?patch44=1');

app = fs.readFileSync(appFile, 'utf8');
if (!app.includes('item.roundDay === activeRound')) throw new Error('PATCH44: activeRound output anchor not found');
app = app.replace('item.roundDay === activeRound', 'item.roundDay === selectedRound');
fs.writeFileSync(appFile, app, 'utf8');
console.log('PATCH44: evaluator snapshot uses selectedRound and full workflow hardening applied.');
