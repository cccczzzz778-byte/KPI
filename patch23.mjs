import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) throw new Error(`PATCH23: ${relative} not found`);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH23: no changes applied to ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH23: patched ${relative}`);
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`PATCH23 anchor not found: ${label}`);
  return text.replace(from, to);
}

patchFile('components/kpi-app.tsx', (source) => {
  source = replaceOnce(
    source,
    '    setScores(Object.fromEntries(criteria.map((criterion) => [criterion.id, evaluationMap.get(`${institution.id}:${selectedRound}:${criterion.id}`) ?? 0])));',
    '    setScores(Object.fromEntries(data.evaluations.filter((item) => item.institutionId === institution.id && item.roundDay === selectedRound).map((item) => [item.criterionId, Number(item.score)])));',
    'load-only-saved-scores',
  );

  source = replaceOnce(
    source,
    '    const activeCriteria = criteria.filter((criterion) => criterion.commission === activeCommission);',
    '    const activeCriteria = criteria.filter((criterion) => criterion.commission === activeCommission && Object.prototype.hasOwnProperty.call(scores, criterion.id));',
    'save-only-selected-or-existing-criteria',
  );

  source = replaceOnce(
    source,
    '      await loadData(true);\n      setFiles({});\n      toast.success(`${commissions.find((item) => item.id === activeCommission)?.short} bahosi va asoslari saqlandi.`);',
    '      await loadData(true);\n      setFiles({});\n      setEvaluationOpen(false);\n      toast.success(`${commissions.find((item) => item.id === activeCommission)?.short} bo‘yicha tanlangan mezonlar saqlandi.`);',
    'close-after-partial-save',
  );

  source = replaceOnce(
    source,
    'mode === "evaluator" ? "Muassasalarni asoslovchi izoh va fayl bilan baholang"',
    'mode === "evaluator" ? "Muassasalarni yuklangan mezonlar bo‘yicha bosqichma-bosqich baholang"',
    'evaluator-heading',
  );

  source = replaceOnce(
    source,
    'Har bir mezon 0/1/2 ball bilan, izoh va asoslovchi fayl bilan baholanadi.',
    'Har bir mezon 0/1/2 ball bilan baholanadi. Baholovchi kerakli mezonlarni alohida saqlashi mumkin, izoh esa ixtiyoriy.',
    'evaluation-help-copy',
  );

  source = replaceOnce(
    source,
    'readOnlyEvaluation ? "ball, izoh va fayl asoslarini ko‘rish" : "har bir ballni asoslang"',
    'readOnlyEvaluation ? "ball, izoh va fayl asoslarini ko‘rish" : "kerakli mezonlarni baholab saqlang"',
    'dialog-description',
  );

  source = replaceOnce(
    source,
    'Faqat shu yo‘nalishdagi barcha baholash mezonlari ko‘rinadi · 20 ball · Har bir mezon uchun majburiy izoh',
    'Faqat shu yo‘nalishdagi baholash mezonlari ko‘rinadi · 20 ball · Izoh ixtiyoriy · Bosqichma-bosqich baholash mumkin',
    'assignment-banner-copy',
  );

  source = replaceOnce(
    source,
    'const filled = items.filter((criterion) => (scores[criterion.id] ?? 0) > 0 || Boolean(notes[criterion.id]?.trim()) || data.evaluations.some((item) => item.institutionId === institution?.id && item.roundDay === roundDay && item.criterionId === criterion.id)).length;',
    'const filled = items.filter((criterion) => Object.prototype.hasOwnProperty.call(scores, criterion.id) || Boolean(notes[criterion.id]?.trim()) || data.evaluations.some((item) => item.institutionId === institution?.id && item.roundDay === roundDay && item.criterionId === criterion.id)).length;',
    'zero-score-counts-as-filled',
  );

  source = replaceOnce(
    source,
    '<label className="criterion-note">Asoslovchi izoh<Textarea value={notes[criterion.id] ?? ""} readOnly={readOnly} onChange={(event) => onNote(criterion.id, event.target.value)} placeholder="Nima bajarilgani yoki kamchilik sababini yozing..." /></label>',
    '<label className="criterion-note">Izoh (ixtiyoriy)<Textarea value={notes[criterion.id] ?? ""} readOnly={readOnly} onChange={(event) => onNote(criterion.id, event.target.value)} placeholder="Kerak bo‘lsa izoh yozing..." /></label>',
    'optional-note-label',
  );

  source = replaceOnce(
    source,
    'Yo‘nalish bahosini saqlash',
    'Tanlangan mezonlarni saqlash',
    'save-button-copy',
  );

  return source;
});

patchFile('app/api/kpi/route.ts', (source) => {
  source = replaceOnce(
    source,
    '        if (!(noteMap[criterionId]?.trim())) {\n          return Response.json({ error: `“${criterion.title}” uchun asoslovchi izoh kiriting.` }, { status: 400 });\n        }\n',
    '',
    'remove-required-note-validation',
  );

  source = replaceOnce(
    source,
    '[institutionId, roundDay, criterionId, Number(score), noteMap[criterionId].trim(), session.email, session.name],',
    '[institutionId, roundDay, criterionId, Number(score), (noteMap[criterionId] ?? "").trim(), session.email, session.name],',
    'optional-note-db-value',
  );

  return source;
});

console.log('PATCH23: evaluator comments are optional and criteria can be scored/saved partially without zeroing untouched criteria.');
