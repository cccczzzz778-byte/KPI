import fs from 'node:fs';
import path from 'node:path';

const source = path.join(process.cwd(), 'patch36.digital-report-route.ts.txt');
const target = path.join(process.cwd(), 'app/api/reports/digital/route.ts');
if (!fs.existsSync(source)) throw new Error('PATCH36: report route template missing');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('PATCH36: live digital KPI SVG report route created.');
