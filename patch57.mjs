import fs from 'node:fs';

const file = 'lib/kpi-data.ts';
if (!fs.existsSync(file)) throw new Error('PATCH57: lib/kpi-data.ts not found');
let source = fs.readFileSync(file, 'utf8');
const startMarker = 'export const criteria: Criterion[] = ';
const endMarker = ';\n\nexport const scoreLabels = [';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('PATCH57: criteria block not found');
const list = JSON.parse(source.slice(start + startMarker.length, end));

// Moliya va infratuzilma: operational/monitoring criteria that can reasonably
// be evidenced every week. p01-04 (Mustaqillik banner/bayroq) is explicitly excluded.
// One-time planning/calculation/proposal criteria keep their original cadence.
const weeklyIds = new Set([
  'p01-02', // obodonlashtirish va sanitariya holati
  'p01-03', // xodimlar xonadonlari bo‘yicha obodonlashtirish ishlari
  'p08-01', // qo‘shimcha pullik xizmat turlarini ko‘paytirish
  'p08-02', // moliyaviy mustaqillik va barqarorlik
  'p08-03', // pullik xizmat sifati va servis
  'p16-01', // bino/hudud infratuzilmasi holatini ko‘zdan kechirish
  'p16-02', // ta’mirlash, sanitariya va jihoz ehtiyojlari bo‘yicha amaliy ishlar
  'p17-01', // PF-88 loyiha-smeta hujjatlari monitoringi
  'p17-02', // qurilish-ta’mirlash sifati monitoringi
  'p18-03', // qozonxona va isitish tizimlari holati
  'p18-04', // ko‘mir zaxirasi, sarfi va saqlanishi nazorati
]);

const changed = [];
for (const item of list) {
  if (!weeklyIds.has(item.id)) continue;
  if (item.commission !== 'moliya') throw new Error('PATCH57: non-moliya id in weekly allowlist: '+item.id);
  changed.push({ id: item.id, from: item.deadline });
  item.deadline = 'Haftada 1 marta';
}
if (changed.length !== weeklyIds.size) throw new Error('PATCH57: expected '+weeklyIds.size+' criteria, found '+changed.length);
const excluded = list.find((item) => item.id === 'p01-04');
if (!excluded || excluded.commission !== 'moliya') throw new Error('PATCH57: p01-04 exclusion criterion missing');
if (String(excluded.deadline).toLowerCase().includes('haftada 1 marta')) throw new Error('PATCH57: p01-04 must remain excluded from weekly cadence');

source = source.slice(0, start) + startMarker + JSON.stringify(list, null, 2) + source.slice(end);
fs.writeFileSync(file, source, 'utf8');
console.log('PATCH57: Moliya weekly cadence = '+[...weeklyIds].join(', '));
console.log('PATCH57: p01-04 Mustaqillik banner/bayroq criterion unchanged.');
console.log('PATCH57: one-time criteria p08-04, p17-03, p18-01, p18-02 keep original cadence.');
