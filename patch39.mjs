import fs from 'node:fs';

function replaceOrThrow(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`PATCH39: anchor not found: ${label}`);
  return source.replace(from, to);
}

const maxScores = { ijro: 10.3, birlamchi: 29.4, statsionar: 23.5, raqam: 13.3, moliya: 23.5 };

// Replace numeric criterion labels such as "2.2-mezon" with the actual criterion wording.
{
  const file = 'lib/kpi-data.ts';
  let source = fs.readFileSync(file, 'utf8');
  const startMarker = 'export const criteria: Criterion[] = ';
  const endMarker = ';\n\nexport const scoreLabels = [';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('PATCH39: criteria JSON block not found');
  const jsonText = source.slice(start + startMarker.length, end);
  const criteria = JSON.parse(jsonText);
  for (const item of criteria) {
    const cleanName = String(item.detail || item.title || '').replace(/^\s*\d+(?:\.\d+)+\.\s*/, '').trim();
    if (cleanName) item.title = cleanName;
  }
  source = source.slice(0, start) + startMarker + JSON.stringify(criteria, null, 2) + source.slice(end);
  fs.writeFileSync(file, source, 'utf8');
  console.log('PATCH39: criterion numeric labels replaced with source criterion names.');
}

// Main admin/evaluator/monitoring UI scoring.
{
  const file = 'components/kpi-app.tsx';
  let source = fs.readFileSync(file, 'utf8');
  source = replaceOrThrow(
    source,
    'function getCommissionDraftScore(commissionId: CommissionKey, scoreSource: Record<string, number>) {',
    `const commissionMaxScores: Record<CommissionKey, number> = ${JSON.stringify(maxScores)};\n\nfunction getCommissionMaxScore(commissionId: CommissionKey) {\n  return commissionMaxScores[commissionId];\n}\n\nfunction getCommissionDraftScore(commissionId: CommissionKey, scoreSource: Record<string, number>) {`,
    'main score helper insert',
  );
  source = replaceOrThrow(
    source,
    '  return Number(((earned / (items.length * 2)) * 20).toFixed(1));',
    '  return Number(((earned / (items.length * 2)) * getCommissionMaxScore(commissionId)).toFixed(1));',
    'main weighted score formula',
  );
  source = replaceOrThrow(source, '<strong>{draftScores[commission.id]}/20</strong>', '<strong>{draftScores[commission.id]}/{getCommissionMaxScore(commission.id)}</strong>', 'tab max score');
  source = replaceOrThrow(source, 'Faqat shu yo‘nalishdagi baholash mezonlari ko‘rinadi · 20 ball · Izoh ixtiyoriy · Bosqichma-bosqich baholash mumkin', 'Faqat shu yo‘nalishdagi baholash mezonlari ko‘rinadi · {getCommissionMaxScore(commission.id)} ball · Izoh ixtiyoriy · Bosqichma-bosqich baholash mumkin', 'evaluator banner score');
  source = replaceOrThrow(source, '<TableCell className="total-col"><strong>{score}</strong><span>/20</span></TableCell>', '<TableCell className="total-col"><strong>{score}</strong><span>/{getCommissionMaxScore(commission.id)}</span></TableCell>', 'evaluator row max');
  source = replaceOrThrow(source, '<div className="commission-foot"><span>{criteria.filter((item) => item.commission === commission.id).length} ta mezon</span><strong>20 ball</strong></div>', '<div className="commission-foot"><span>{criteria.filter((item) => item.commission === commission.id).length} ta mezon</span><strong>{getCommissionMaxScore(commission.id)} ball</strong></div>', 'commission cards score');
  source = replaceOrThrow(source, '<TableCell key={commission.id} className="score-col"><strong>{row.parts[commission.id]}</strong><span>/20</span></TableCell>', '<TableCell key={commission.id} className="score-col"><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></TableCell>', 'ranking max score');
  source = replaceOrThrow(source, '<span>{commission.code}-YO‘NALISH · {items.length} TA MEZON · 20 BALL</span>', '<span>{commission.title.toUpperCase()} · {items.length} TA MEZON · {getCommissionMaxScore(commissionId)} BALL</span>', 'evaluation heading score/name');
  source = replaceOrThrow(source, '<p>To‘ldirilgani: {filled}/{items.length} · Yo‘nalish natijasi: {directionScore}/20</p>', '<p>To‘ldirilgani: {filled}/{items.length} · Yo‘nalish natijasi: {directionScore}/{getCommissionMaxScore(commissionId)}</p>', 'evaluation section max');
  fs.writeFileSync(file, source, 'utf8');
  console.log('PATCH39: main UI uses criterion-count-weighted 100-point scoring.');
}

// Public dashboard must use the identical weighting.
{
  const file = 'components/public-dashboard.tsx';
  let source = fs.readFileSync(file, 'utf8');
  source = replaceOrThrow(
    source,
    'function commissionScore(commissionId: CommissionKey, institutionId: string, roundDay: number, evaluationMap: Map<string, number>) {',
    `const commissionMaxScores: Record<CommissionKey, number> = ${JSON.stringify(maxScores)};\n\nfunction getCommissionMaxScore(commissionId: CommissionKey) {\n  return commissionMaxScores[commissionId];\n}\n\nfunction commissionScore(commissionId: CommissionKey, institutionId: string, roundDay: number, evaluationMap: Map<string, number>) {`,
    'public score helper insert',
  );
  source = replaceOrThrow(source, '  return Number(((earned / (items.length * 2)) * 20).toFixed(1));', '  return Number(((earned / (items.length * 2)) * getCommissionMaxScore(commissionId)).toFixed(1));', 'public weighted score formula');
  source = replaceOrThrow(source, '<div className="commission-foot"><span>{criteria.filter((item) => item.commission === commission.id).length} ta mezon</span><strong>20 ball</strong></div>', '<div className="commission-foot"><span>{criteria.filter((item) => item.commission === commission.id).length} ta mezon</span><strong>{getCommissionMaxScore(commission.id)} ball</strong></div>', 'public cards max');
  source = replaceOrThrow(source, '<TableCell key={commission.id} className="score-col"><strong>{row.parts[commission.id]}</strong><span>/20</span></TableCell>', '<TableCell key={commission.id} className="score-col"><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></TableCell>', 'public table max');
  fs.writeFileSync(file, source, 'utf8');
  console.log('PATCH39: public dashboard uses the same weighted 100-point scoring.');
}

const total = Object.values(maxScores).reduce((sum, value) => sum + value, 0);
if (Math.abs(total - 100) > 0.001) throw new Error(`PATCH39: max scores total ${total}`);
console.log('PATCH39: max score distribution = ' + JSON.stringify(maxScores) + ' = 100.0');
console.log('PATCH39: database attachments/files were not modified.');
