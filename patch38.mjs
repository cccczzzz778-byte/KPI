import fs from 'node:fs';
const target = 'lib/kpi-data.ts';
if (!fs.existsSync(target)) throw new Error('PATCH38: lib/kpi-data.ts not found');
const text = fs.readFileSync(target, 'utf8');
console.log('PATCH38_KPI_DATA_BEGIN');
console.log(text);
console.log('PATCH38_KPI_DATA_END');
