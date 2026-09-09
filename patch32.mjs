import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) throw new Error(`PATCH32: ${relative} not found`);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH32: no changes applied to ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH32: patched ${relative}`);
}

patchFile('components/evaluator-reference-panel.tsx', (source) => {
  const oldEvaluations = '  const evaluations = Array.isArray(data.evaluations) ? data.evaluations : [];';
  const newEvaluations = `  const evaluations = Array.isArray(data.evaluations) ? data.evaluations : [];
  const dailyEvaluations = Array.isArray(data.dailyEvaluations) ? data.dailyEvaluations : [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());`;
  if (!source.includes(oldEvaluations)) throw new Error('PATCH32: evaluator daily data anchor not found');
  source = source.replace(oldEvaluations, newEvaluations);

  const oldProgress = `  function institutionProgress(institutionId: string) {
    const rows = evaluations.filter((item: AnyRecord) => String(item.institutionId) === String(institutionId)
      && Number(item.roundDay ?? item.round ?? roundDay) === roundDay
      && criterionIds.has(String(item.criterionId)));
    const done = new Set(rows.map((item: AnyRecord) => String(item.criterionId))).size;
    const total = criteria.length;
    return { done, total, percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0 };
  }`;

  const newProgress = `  function institutionProgress(institutionId: string) {
    const rows = dailyEvaluations.filter((item: AnyRecord) => String(item.institutionId) === String(institutionId)
      && String(item.evaluationDate || "") === today
      && criterionIds.has(String(item.criterionId)));
    const done = new Set(rows.map((item: AnyRecord) => String(item.criterionId))).size;
    const total = criteria.length;
    return { done, total, percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0 };
  }`;

  if (!source.includes(oldProgress)) throw new Error('PATCH32: evaluator progress anchor not found');
  source = source.replace(oldProgress, newProgress);

  source = source.replaceAll(`${'${roundDay}'}-kunlik nazorat`, 'Bugungi baholash');
  return source;
});

patchFile('app/api/evaluator/archive/route.ts', (source) => {
  const oldJoin = `            AND a.source IN ('institution', 'institution_submission')
            AND a.criterion_id IS NOT NULL
            AND TRIM(a.criterion_id::text) = ANY($1::text[])`;
  const newJoin = `            AND a.source IN ('institution', 'institution_submission')
            AND a.criterion_id IS NOT NULL
            AND a.submission_date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date
            AND TRIM(a.criterion_id::text) = ANY($1::text[])`;
  if (!source.includes(oldJoin)) throw new Error('PATCH32: evaluator file-count SQL anchor not found');
  source = source.replace(oldJoin, newJoin);
  return source;
});

console.log('PATCH32: evaluator institution rows now reset daily: today\'s scored criteria and today\'s uploaded criterion files only.');
