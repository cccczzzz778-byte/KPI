import fs from 'node:fs';
import path from 'node:path';

const source = path.join(process.cwd(), 'patch36.digital-report-route.ts.txt');
const target = path.join(process.cwd(), 'app/api/reports/digital/route.ts');
if (!fs.existsSync(source)) throw new Error('PATCH36: report route template missing');
fs.mkdirSync(path.dirname(target), { recursive: true });
let route = fs.readFileSync(source, 'utf8');
route = route.replace(
  'const institutionMap = new Map<string, any>(defaultInstitutions.map((item) => [String(item.id), { ...item, active: 1 }]));',
  'const institutionMap = new Map<string, any>();\n    for (const item of defaultInstitutions) institutionMap.set(String(item.id), { ...item, active: 1 });',
);
route = route.replace(
  'const scoreMap = new Map(scoreResult.rows.map((row: any) => [String(row.institutionId), row]));',
  'const scoreMap = new Map<string, any>();\n    for (const row of scoreResult.rows) scoreMap.set(String(row.institutionId), row);',
);
fs.writeFileSync(target, route, 'utf8');
console.log('PATCH36: live digital KPI SVG report route created.');
