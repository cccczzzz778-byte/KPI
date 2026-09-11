import fs from 'node:fs';

const target = 'lib/kpi-data.ts';
if (!fs.existsSync(target)) throw new Error('PATCH40: lib/kpi-data.ts not found');

// Exact criterion IDs and evaluator distribution from the uploaded
// 60 KUNLIK BAHOLOVCHILAR VA MEZONLAR TAQSIMOTI Word file.
const sourceOrder = {
  ijro: ['p02-02','p02-03','p02-04','p04-04','p06-01','p06-02','p06-03'],
  birlamchi: ['p01-01','p01-05','p02-01','p04-05','p05-01','p05-02','p05-03','p07-01','p07-02','p07-03','p11-01','p11-02','p11-03','p11-04','p12-01','p12-02','p12-03','p15-01','p15-02','p15-03'],
  statsionar: ['p03-01','p03-02','p03-03','p04-01','p04-02','p04-03','p09-01','p09-02','p09-03','p09-04','p09-05','p10-01','p10-02','p10-03','p10-04','p14-01'],
  raqam: ['p03-04','p20-01','p20-02','p20-03','p19-01','p19-02','p19-03','digital-mother-child-registry','digital-camera-monitoring'],
  moliya: ['p01-02','p01-03','p01-04','p08-01','p08-02','p08-03','p08-04','p16-01','p16-02','p17-01','p17-02','p17-03','p18-01','p18-02','p18-03','p18-04'],
};

const allowed = new Map();
for (const [commission, ids] of Object.entries(sourceOrder)) {
  for (const id of ids) allowed.set(id, commission);
}

let source = fs.readFileSync(target, 'utf8');
const startMarker = 'export const criteria: Criterion[] = ';
const endMarker = ';\n\nexport const scoreLabels = [';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('PATCH40: criteria JSON block not found');

const parsed = JSON.parse(source.slice(start + startMarker.length, end));
const byId = new Map(parsed.map((item) => [String(item.id), item]));
const extra = parsed.filter((item) => !allowed.has(String(item.id))).map((item) => String(item.id));
const missing = [...allowed.keys()].filter((id) => !byId.has(id));
if (missing.length) throw new Error('PATCH40: Word source criteria missing from active list: ' + missing.join(', '));

const criteria = [];
for (const [commission, ids] of Object.entries(sourceOrder)) {
  for (const id of ids) {
    const item = { ...byId.get(id), commission };
    criteria.push(item);
  }
}

const expectedCounts = { ijro: 7, birlamchi: 20, statsionar: 16, raqam: 9, moliya: 16 };
const actualCounts = Object.fromEntries(Object.keys(expectedCounts).map((key) => [key, criteria.filter((item) => item.commission === key).length]));
if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
  throw new Error('PATCH40: source distribution mismatch: ' + JSON.stringify(actualCounts));
}
if (criteria.length !== 68) throw new Error('PATCH40: expected 68 criteria listed in Word, got ' + criteria.length);

source = source.slice(0, start) + startMarker + JSON.stringify(criteria, null, 2) + source.slice(end);
fs.writeFileSync(target, source, 'utf8');

console.log('PATCH40: uploaded Word file is now the active-criteria allowlist.');
console.log('PATCH40: active distribution = ' + JSON.stringify(actualCounts) + ', total=68.');
console.log('PATCH40: removed non-source active criteria = ' + (extra.length ? extra.join(', ') : 'none (active list already matched the Word file)'));
console.log('PATCH40: historical database rows and uploaded evidence files were not deleted.');
