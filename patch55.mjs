import fs from 'node:fs';

const file = 'lib/kpi-data.ts';
if (!fs.existsSync(file)) throw new Error('PATCH55: lib/kpi-data.ts not found');
let source = fs.readFileSync(file, 'utf8');
const startMarker = 'export const criteria: Criterion[] = ';
const endMarker = ';\n\nexport const scoreLabels = [';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('PATCH55: criteria block not found');
const list = JSON.parse(source.slice(start + startMarker.length, end));

const item = list.find((x) => x.id === 'p03-04');
if (!item) throw new Error('PATCH55: p03-04 not found');
if (item.commission !== 'raqam') throw new Error('PATCH55: p03-04 is not in raqam commission');

const previous = item.deadline;
item.deadline = 'Har kuni (doimiy)';

source = source.slice(0, start) + startMarker + JSON.stringify(list, null, 2) + source.slice(end);
fs.writeFileSync(file, source, 'utf8');

console.log('PATCH55: p03-04 Raqamlashtirish recurrence: ' + previous + ' -> Har kuni (doimiy).');
console.log('PATCH55: only p03-04 changed; upload allowed once per day, within 08:00-19:00.');
