import fs from "node:fs";

function read(file) {
  if (!fs.existsSync(file)) throw new Error("PATCH64 missing " + file);
  return fs.readFileSync(file, "utf8");
}
function write(file, source) {
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH64: " + file);
}

// 1) Raqamlashtirish: every criterion upload is daily (one file per Tashkent calendar date).
for (const file of ["app/api/uploads/prepare/route.ts", "app/api/uploads/complete/route.ts"]) {
  let s = read(file);

  s = s.replaceAll(
    'if (patch62IsDaily(recurrenceCriterion.deadline)) {',
    'if (recurrenceCriterion.commission === "raqam" || patch62IsDaily(recurrenceCriterion.deadline)) {',
  );
  s = s.replaceAll(
    'if (patch62IsDaily(criterion.deadline)) {',
    'if (criterion.commission === "raqam" || patch62IsDaily(criterion.deadline)) {',
  );
  s = s.replaceAll(
    'const message = patch62IsDaily(criterion.deadline)',
    'const message = criterion.commission === "raqam" || patch62IsDaily(criterion.deadline)',
  );

  if (!s.includes('commission === "raqam"')) {
    throw new Error("PATCH64 raqam daily server anchor missing in " + file);
  }
  write(file, s);
}

// 2) Institution portal: show all Raqamlashtirish criteria with daily lock/reopen behavior.
{
  const file = "components/institution-portal.tsx";
  let s = read(file);
  const old = [
    '      const daily = deadline.includes("har kuni")',
    '        || deadline.includes("doimiy")',
    '        || deadline.includes("muntazam")',
    '        || deadline.includes("1 kun");',
  ].join("\n");
  const next = [
    '      const daily = criterion.commission === "raqam"',
    '        || deadline.includes("har kuni")',
    '        || deadline.includes("doimiy")',
    '        || deadline.includes("muntazam")',
    '        || deadline.includes("1 kun");',
  ].join("\n");
  if (!s.includes(old) && !s.includes('const daily = criterion.commission === "raqam"')) {
    throw new Error("PATCH64 institution daily UI anchor missing");
  }
  if (s.includes(old)) s = s.replace(old, next);
  write(file, s);
}

// 3) Evaluator UI: criteria whose deadline contains "doimiy" start as a fresh,
// separate evaluation every Tashkent day. Non-doimiy criteria keep their persisted score.
{
  const file = "components/kpi-app.tsx";
  let s = read(file);

  const rowsAnchor = [
    '  const currentRows = data.evaluations.filter(',
    '    (item) => item.institutionId === institution.id && item.roundDay === selectedRound,',
    '  );',
  ].join("\n");

  const rowsReplacement = [
    '  const currentRows = data.evaluations.filter(',
    '    (item) => item.institutionId === institution.id && item.roundDay === selectedRound,',
    '  );',
    '  const patch64Today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());',
    '  const patch64DailyEvaluationIds = new Set(',
    '    criteria.filter((item) => String(item.deadline || "").toLocaleLowerCase("uz").includes("doimiy")).map((item) => item.id),',
    '  );',
    '  const patch64TodayRows = data.dailyEvaluations.filter(',
    '    (item) => item.institutionId === institution.id && item.evaluationDate === patch64Today && patch64DailyEvaluationIds.has(item.criterionId),',
    '  );',
    '  const patch64DisplayRows = [',
    '    ...currentRows.filter((item) => !patch64DailyEvaluationIds.has(item.criterionId)),',
    '    ...patch64TodayRows,',
    '  ];',
  ].join("\n");

  if (!s.includes("patch64DailyEvaluationIds")) {
    if (!s.includes(rowsAnchor)) throw new Error("PATCH64 evaluator currentRows anchor missing");
    s = s.replace(rowsAnchor, rowsReplacement);
  }

  s = s.replace(
    '  setScores(Object.fromEntries(currentRows.map((item) => [item.criterionId, Number(item.score)])));',
    '  setScores(Object.fromEntries(patch64DisplayRows.map((item) => [item.criterionId, Number(item.score)])));',
  );
  s = s.replace(
    '    const saved = currentRows.find((item) => item.criterionId === criterion.id);',
    '    const saved = patch64DisplayRows.find((item) => item.criterionId === criterion.id);',
  );

  if (!s.includes("patch64DisplayRows.map") || !s.includes("patch64DisplayRows.find")) {
    throw new Error("PATCH64 evaluator display row replacement incomplete");
  }

  write(file, s);
}

// 4) Save API: "doimiy" criteria must create/update today's daily_evaluations row
// even when the numerical score equals the previous day's current score.
// If the criterion requires a file, 1/2 requires today's evidence;
// 0 remains allowed when today's evidence is absent.
{
  const file = "app/api/kpi/route.ts";
  let s = read(file);

  const oldMapBlock = [
    '        const existingRows = existingResult.rows as Array<Record<string, unknown>>;',
    '        const existingMap = new Map(existingRows.map((row) => [String(row.criterionId), row]));',
    '        const changedEntries = entries.filter(([criterionId, score]) => {',
    '          const previous = existingMap.get(criterionId);',
    '          const note = (noteMap[criterionId] ?? "").trim();',
    '          if (!previous) return true;',
    '          return Number(previous.score) !== Number(score) || String(previous.note ?? "").trim() !== note;',
    '        });',
  ].join("\n");

  const newMapBlock = [
    '        const existingRows = existingResult.rows as Array<Record<string, unknown>>;',
    '        const existingMap = new Map(existingRows.map((row) => [String(row.criterionId), row]));',
    '        const todayEvaluationResult = await client.query(',
    '          "SELECT criterion_id AS \\"criterionId\\", score, note FROM daily_evaluations WHERE institution_id = $1 AND evaluation_date = (NOW() AT TIME ZONE \'Asia/Tashkent\')::date",',
    '          [institutionId],',
    '        );',
    '        const todayEvaluationMap = new Map(',
    '          (todayEvaluationResult.rows as Array<Record<string, unknown>>).map((row) => [String(row.criterionId), row]),',
    '        );',
    '        const isPatch64DailyEvaluation = (criterionId: string) => {',
    '          const criterion = criteria.find((item) => item.id === criterionId);',
    '          return Boolean(criterion && String(criterion.deadline || "").toLocaleLowerCase("uz").includes("doimiy"));',
    '        };',
    '        const changedEntries = entries.filter(([criterionId, score]) => {',
    '          const previous = existingMap.get(criterionId);',
    '          const note = (noteMap[criterionId] ?? "").trim();',
    '          if (isPatch64DailyEvaluation(criterionId) && !todayEvaluationMap.has(criterionId)) return true;',
    '          if (!previous) return true;',
    '          return Number(previous.score) !== Number(score) || String(previous.note ?? "").trim() !== note;',
    '        });',
  ].join("\n");

  if (!s.includes("isPatch64DailyEvaluation")) {
    if (!s.includes(oldMapBlock)) throw new Error("PATCH64 save_evaluation map anchor missing");
    s = s.replace(oldMapBlock, newMapBlock);
  }

  const oldEvidence = [
    '            const previous = existingMap.get(criterionId);',
    '            const scoreChanged = !previous || Number(previous.score) !== Number(score);',
    '            if (!scoreChanged) continue;',
    '            const evidenceResult = await client.query(',
    '              "SELECT created_at AS \\"createdAt\\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN (\'institution\', \'institution_submission\') ORDER BY created_at DESC LIMIT 1",',
    '              [institutionId, criterionId],',
    '            );',
    '            const latestEvidence = evidenceResult.rows[0]?.createdAt ? new Date(evidenceResult.rows[0].createdAt).getTime() : 0;',
    '            if (!latestEvidence && !previous && Number(score) === 0) continue;',
  ].join("\n");

  const newEvidence = [
    '            const previous = existingMap.get(criterionId);',
    '            const dailyEvaluation = isPatch64DailyEvaluation(criterionId);',
    '            const scoreChanged = !previous || Number(previous.score) !== Number(score);',
    '            if (!scoreChanged && !dailyEvaluation) continue;',
    '            const evidenceResult = await client.query(',
    '              dailyEvaluation',
    '                ? "SELECT created_at AS \\"createdAt\\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN (\'institution\', \'institution_submission\') AND (created_at AT TIME ZONE \'Asia/Tashkent\')::date = (NOW() AT TIME ZONE \'Asia/Tashkent\')::date ORDER BY created_at DESC LIMIT 1"',
    '                : "SELECT created_at AS \\"createdAt\\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN (\'institution\', \'institution_submission\') ORDER BY created_at DESC LIMIT 1",',
    '              [institutionId, criterionId],',
    '            );',
    '            const latestEvidence = evidenceResult.rows[0]?.createdAt ? new Date(evidenceResult.rows[0].createdAt).getTime() : 0;',
    '            if (!latestEvidence && Number(score) === 0 && (dailyEvaluation || !previous)) continue;',
  ].join("\n");

  if (!s.includes("const dailyEvaluation = isPatch64DailyEvaluation")) {
    if (!s.includes(oldEvidence)) throw new Error("PATCH64 evidence anchor missing");
    s = s.replace(oldEvidence, newEvidence);
  }

  // For daily criteria, do not compare today's evidence to yesterday's persisted score timestamp.
  const oldPreviousGuard = '            if (previous?.updatedAt) {';
  const newPreviousGuard = '            if (!dailyEvaluation && previous?.updatedAt) {';
  if (!s.includes(newPreviousGuard)) {
    if (!s.includes(oldPreviousGuard)) throw new Error("PATCH64 previous-score evidence guard missing");
    s = s.replace(oldPreviousGuard, newPreviousGuard);
  }

  write(file, s);
}

console.log("PATCH64: all Raqamlashtirish uploads are daily, one per Asia/Tashkent calendar date, 08:00-19:00.");
console.log("PATCH64: every criterion whose deadline contains 'doimiy' is evaluated as a separate daily record.");
console.log("PATCH64: doimiy evaluator form starts fresh each day; today's 1/2 requires today's evidence when file evidence is required.");
console.log("PATCH64: existing files, historical scores and previous daily_evaluations are preserved.");
