import fs from 'node:fs';

const file = 'lib/kpi-data.ts';
if (!fs.existsSync(file)) throw new Error('PATCH54: lib/kpi-data.ts not found');
let source = fs.readFileSync(file, 'utf8');
const startMarker = 'export const criteria: Criterion[] = ';
const endMarker = ';\n\nexport const scoreLabels = [';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('PATCH54: criteria block not found');
const list = JSON.parse(source.slice(start + startMarker.length, end));

// Only Birlamchi tibbiy yordam criteria that were on a 60-day cadence
// are changed to weekly. Other commissions and other Birlamchi periods stay intact.
const changed = [];
for (const item of list) {
  const deadline = String(item.deadline || '').toLocaleLowerCase('uz');
  if (item.commission === 'birlamchi' && deadline.includes('60 kun')) {
    changed.push({ id: item.id, from: item.deadline });
    item.deadline = 'Haftada 1 marta';
  }
}
if (changed.length !== 8) {
  throw new Error('PATCH54: expected 8 Birlamchi 60-day criteria, got ' + changed.length + ': ' + changed.map(x=>x.id).join(','));
}
source = source.slice(0, start) + startMarker + JSON.stringify(list, null, 2) + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('PATCH54: Birlamchi 60-day -> weekly: ' + changed.map(x=>x.id).join(', '));
console.log('PATCH54: upload recurrence parser will enforce 7 days from the new 2026-09-14 baseline upload.');
