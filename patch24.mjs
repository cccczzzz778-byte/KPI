import fs from 'node:fs';
import path from 'node:path';

const kpiPath = path.join(process.cwd(), 'lib/kpi-data.ts');
if (!fs.existsSync(kpiPath)) throw new Error('PATCH24-DIAG: lib/kpi-data.ts not found.');
const kpiText = fs.readFileSync(kpiPath, 'utf8');
console.log('PATCH24-DIAG-KPI-DATA-BEGIN');
console.log(kpiText);
console.log('PATCH24-DIAG-KPI-DATA-END');

const portalPath = path.join(process.cwd(), 'components/institution-portal.tsx');
if (fs.existsSync(portalPath)) {
  const portal = fs.readFileSync(portalPath, 'utf8');
  const lines = portal.split('\n');
  const interesting = lines.filter((line) => /criteria|criterion|uploadCriterion|fayl|file/i.test(line));
  console.log('PATCH24-DIAG-PORTAL-BEGIN');
  console.log(interesting.slice(0, 220).join('\n'));
  console.log('PATCH24-DIAG-PORTAL-END');
}

console.log('PATCH24-DIAG: inspection only.');
