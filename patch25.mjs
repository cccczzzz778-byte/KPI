import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) throw new Error(`PATCH25: ${relative} not found`);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH25: no changes applied to ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH25: patched ${relative}`);
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`PATCH25 anchor not found: ${label}`);
  return text.replace(from, to);
}

const migrationDir = path.join(process.cwd(), 'db', 'migrations', '013_daily_evaluations');
fs.mkdirSync(migrationDir, { recursive: true });
fs.writeFileSync(path.join(migrationDir, 'migration.sql'), `CREATE TABLE IF NOT EXISTS daily_evaluations (
  id BIGSERIAL PRIMARY KEY,
  institution_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  evaluation_date DATE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 2),
  note TEXT NOT NULL DEFAULT '',
  evaluator_email TEXT NOT NULL DEFAULT '',
  evaluator_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, criterion_id, evaluation_date)
);

CREATE INDEX IF NOT EXISTS daily_evaluations_institution_date_idx
  ON daily_evaluations (institution_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS daily_evaluations_criterion_date_idx
  ON daily_evaluations (criterion_id, evaluation_date DESC);

INSERT INTO daily_evaluations (
  institution_id, criterion_id, evaluation_date, score, note,
  evaluator_email, evaluator_name, created_at, updated_at
)
SELECT DISTINCT ON (institution_id, criterion_id, (updated_at AT TIME ZONE 'Asia/Tashkent')::date)
  institution_id,
  criterion_id,
  (updated_at AT TIME ZONE 'Asia/Tashkent')::date,
  score,
  note,
  evaluator_email,
  evaluator_name,
  updated_at,
  updated_at
FROM evaluations
ORDER BY institution_id, criterion_id, (updated_at AT TIME ZONE 'Asia/Tashkent')::date, updated_at DESC
ON CONFLICT (institution_id, criterion_id, evaluation_date) DO NOTHING;
`);
console.log('PATCH25: created daily evaluation migration.');

patchFile('app/api/kpi/route.ts', (source) => {
  source = replaceOnce(
    source,
    '    const [institutionResult, evaluationResult, attachmentResult] = await Promise.all([\n      db.pool.query("SELECT id, name, district, type, active, created_at AS \\"createdAt\\" FROM institutions ORDER BY LOWER(name)"),\n      db.pool.query("SELECT institution_id AS \\"institutionId\\", round_day AS \\"roundDay\\", criterion_id AS \\"criterionId\\", score, note, evaluator_email AS \\"evaluatorEmail\\", evaluator_name AS \\"evaluatorName\\", updated_at AS \\"updatedAt\\" FROM evaluations ORDER BY updated_at DESC"),\n      db.pool.query("SELECT id, institution_id AS \\"institutionId\\", round_day AS \\"roundDay\\", criterion_id AS \\"criterionId\\", filename, content_type AS \\"contentType\\", size_bytes AS \\"sizeBytes\\", uploaded_by AS \\"uploadedBy\\", source, responsible_name AS \\"responsibleName\\", responsible_phone AS \\"responsiblePhone\\", TO_CHAR(submission_date, \'YYYY-MM-DD\') AS \\"submissionDate\\", created_at AS \\"createdAt\\" FROM attachments ORDER BY created_at DESC"),\n    ]);',
    '    const [institutionResult, evaluationResult, dailyEvaluationResult, attachmentResult] = await Promise.all([\n      db.pool.query("SELECT id, name, district, type, active, created_at AS \\"createdAt\\" FROM institutions ORDER BY LOWER(name)"),\n      db.pool.query("SELECT institution_id AS \\"institutionId\\", round_day AS \\"roundDay\\", criterion_id AS \\"criterionId\\", score, note, evaluator_email AS \\"evaluatorEmail\\", evaluator_name AS \\"evaluatorName\\", updated_at AS \\"updatedAt\\" FROM evaluations ORDER BY updated_at DESC"),\n      db.pool.query("SELECT institution_id AS \\"institutionId\\", criterion_id AS \\"criterionId\\", TO_CHAR(evaluation_date, \'YYYY-MM-DD\') AS \\"evaluationDate\\", score, note, evaluator_email AS \\"evaluatorEmail\\", evaluator_name AS \\"evaluatorName\\", created_at AS \\"createdAt\\", updated_at AS \\"updatedAt\\" FROM daily_evaluations ORDER BY evaluation_date DESC, updated_at DESC"),\n      db.pool.query("SELECT id, institution_id AS \\"institutionId\\", round_day AS \\"roundDay\\", criterion_id AS \\"criterionId\\", filename, content_type AS \\"contentType\\", size_bytes AS \\"sizeBytes\\", uploaded_by AS \\"uploadedBy\\", source, responsible_name AS \\"responsibleName\\", responsible_phone AS \\"responsiblePhone\\", TO_CHAR(submission_date, \'YYYY-MM-DD\') AS \\"submissionDate\\", created_at AS \\"createdAt\\" FROM attachments ORDER BY created_at DESC"),\n    ]);',
    'daily-evaluation-get-query',
  );

  source = replaceOnce(
    source,
    '    const evaluationRows = evaluationResult.rows as Array<Record<string, unknown>>;\n    const attachmentRows = attachmentResult.rows as Array<Record<string, unknown>>;\n    const evaluations = evaluationRows.filter((row) =>\n      validCriteria.has(String(row.criterionId)) && allowedCriteria.has(String(row.criterionId)),\n    );',
    '    const evaluationRows = evaluationResult.rows as Array<Record<string, unknown>>;\n    const dailyEvaluationRows = dailyEvaluationResult.rows as Array<Record<string, unknown>>;\n    const attachmentRows = attachmentResult.rows as Array<Record<string, unknown>>;\n    const evaluations = evaluationRows.filter((row) =>\n      validCriteria.has(String(row.criterionId)) && allowedCriteria.has(String(row.criterionId)),\n    );\n    const dailyEvaluations = dailyEvaluationRows.filter((row) =>\n      validCriteria.has(String(row.criterionId)) && allowedCriteria.has(String(row.criterionId)),\n    );',
    'filter-daily-evaluations',
  );

  source = replaceOnce(
    source,
    '    return Response.json({ session, institutions, evaluations, attachments, users, auditLogs, uploadSettings });',
    '    return Response.json({ session, institutions, evaluations, dailyEvaluations, attachments, users, auditLogs, uploadSettings });',
    'return-daily-evaluations',
  );

  source = replaceOnce(
    source,
    '        for (const [criterionId, score] of entries) {\n          await client.query(\n            `INSERT INTO evaluations (institution_id, round_day, criterion_id, score, note, evaluator_email, evaluator_name, updated_at)\n             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())\n             ON CONFLICT (institution_id, round_day, criterion_id)\n             DO UPDATE SET score = EXCLUDED.score, note = EXCLUDED.note, evaluator_email = EXCLUDED.evaluator_email,\n               evaluator_name = EXCLUDED.evaluator_name, updated_at = NOW()`,\n            [institutionId, roundDay, criterionId, Number(score), (noteMap[criterionId] ?? "").trim(), session.email, session.name],\n          );\n        }',
    '        for (const [criterionId, score] of entries) {\n          const note = (noteMap[criterionId] ?? "").trim();\n          await client.query(\n            `INSERT INTO daily_evaluations (institution_id, criterion_id, evaluation_date, score, note, evaluator_email, evaluator_name, created_at, updated_at)\n             VALUES ($1, $2, (NOW() AT TIME ZONE \'Asia/Tashkent\')::date, $3, $4, $5, $6, NOW(), NOW())\n             ON CONFLICT (institution_id, criterion_id, evaluation_date)\n             DO UPDATE SET score = EXCLUDED.score, note = EXCLUDED.note, evaluator_email = EXCLUDED.evaluator_email,\n               evaluator_name = EXCLUDED.evaluator_name, updated_at = NOW()`,\n            [institutionId, criterionId, Number(score), note, session.email, session.name],\n          );\n          await client.query(\n            `INSERT INTO evaluations (institution_id, round_day, criterion_id, score, note, evaluator_email, evaluator_name, updated_at)\n             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())\n             ON CONFLICT (institution_id, round_day, criterion_id)\n             DO UPDATE SET score = EXCLUDED.score, note = EXCLUDED.note, evaluator_email = EXCLUDED.evaluator_email,\n               evaluator_name = EXCLUDED.evaluator_name, updated_at = NOW()`,\n            [institutionId, roundDay, criterionId, Number(score), note, session.email, session.name],\n          );\n        }',
    'daily-evaluation-write-and-legacy-snapshot',
  );

  source = replaceOnce(
    source,
    '[session.email, institutionId, `${roundDay}-kun: ${entries.length} mezon`],',
    '[session.email, institutionId, `Kunlik baholash: ${entries.length} mezon · ${(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" })).format(new Date())}`],',
    'daily-audit-copy',
  );

  return source;
});

patchFile('components/kpi-app.tsx', (source) => {
  source = replaceOnce(
    source,
    'type Evaluation = { institutionId: string; roundDay: number; criterionId: string; score: number; note: string; evaluatorEmail: string; evaluatorName: string; updatedAt: string };\ntype Attachment =',
    'type Evaluation = { institutionId: string; roundDay: number; criterionId: string; score: number; note: string; evaluatorEmail: string; evaluatorName: string; updatedAt: string };\ntype DailyEvaluation = { institutionId: string; criterionId: string; evaluationDate: string; score: number; note: string; evaluatorEmail: string; evaluatorName: string; createdAt: string; updatedAt: string };\ntype Attachment =',
    'daily-evaluation-type',
  );

  source = replaceOnce(
    source,
    'type DashboardData = { session: Session | null; institutions: Institution[]; evaluations: Evaluation[]; attachments: Attachment[]; users: AppUser[]; auditLogs: AuditLog[]; uploadSettings: { uploadDate: string; openTime: string; closeTime: string } };',
    'type DashboardData = { session: Session | null; institutions: Institution[]; evaluations: Evaluation[]; dailyEvaluations: DailyEvaluation[]; attachments: Attachment[]; users: AppUser[]; auditLogs: AuditLog[]; uploadSettings: { uploadDate: string; openTime: string; closeTime: string } };',
    'dashboard-daily-type',
  );

  source = replaceOnce(
    source,
    'const EMPTY_DATA: DashboardData = { session: null, institutions: [], evaluations: [], attachments: [], users: [], auditLogs: [], uploadSettings: { uploadDate: "", openTime: "08:00", closeTime: "18:00" } };',
    'const EMPTY_DATA: DashboardData = { session: null, institutions: [], evaluations: [], dailyEvaluations: [], attachments: [], users: [], auditLogs: [], uploadSettings: { uploadDate: "", openTime: "08:00", closeTime: "18:00" } };',
    'empty-daily-data',
  );

  source = replaceOnce(
    source,
    'function formatBytes(bytes: number) {\n  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;\n  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;\n}\n',
    'function formatBytes(bytes: number) {\n  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;\n  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;\n}\n\nfunction tashkentDateKey() {\n  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());\n  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";\n  return `${get("year")}-${get("month")}-${get("day")}`;\n}\n\nfunction cumulative60Score(rows: DailyEvaluation[], institutionId: string, criterionIds?: Set<string>) {\n  const grouped = new Map<string, DailyEvaluation[]>();\n  rows.forEach((row) => {\n    if (row.institutionId !== institutionId || (criterionIds && !criterionIds.has(row.criterionId))) return;\n    const list = grouped.get(row.criterionId) ?? [];\n    list.push(row);\n    grouped.set(row.criterionId, list);\n  });\n  let total = 0;\n  grouped.forEach((list) => {\n    list.sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate));\n    total += list.slice(0, 60).reduce((sum, row) => sum + Number(row.score || 0), 0);\n  });\n  return total;\n}\n',
    'daily-score-helpers',
  );

  source = replaceOnce(
    source,
    '      evaluations: payload.evaluations ?? [],\n      attachments: payload.attachments ?? [],',
    '      evaluations: payload.evaluations ?? [],\n      dailyEvaluations: payload.dailyEvaluations ?? [],\n      attachments: payload.attachments ?? [],',
    'payload-daily-evaluations',
  );

  source = replaceOnce(
    source,
    '  function openEvaluation(institution: Institution, preferred?: CommissionKey) {\n    setScores(Object.fromEntries(data.evaluations.filter((item) => item.institutionId === institution.id && item.roundDay === selectedRound).map((item) => [item.criterionId, Number(item.score)])));\n    setNotes(Object.fromEntries(criteria.map((criterion) => {\n      const saved = data.evaluations.find((item) => item.institutionId === institution.id && item.roundDay === selectedRound && item.criterionId === criterion.id);\n      return [criterion.id, saved?.note ?? ""];\n    })));',
    '  function openEvaluation(institution: Institution, preferred?: CommissionKey) {\n    const today = tashkentDateKey();\n    const todayRows = data.dailyEvaluations.filter((item) => item.institutionId === institution.id && item.evaluationDate === today);\n    setScores(Object.fromEntries(todayRows.map((item) => [item.criterionId, Number(item.score)])));\n    setNotes(Object.fromEntries(criteria.map((criterion) => {\n      const saved = todayRows.find((item) => item.criterionId === criterion.id);\n      return [criterion.id, saved?.note ?? ""];\n    })));',
    'open-only-today-scores',
  );

  source = replaceOnce(
    source,
    '      toast.success(`${commissions.find((item) => item.id === activeCommission)?.short} bo‘yicha tanlangan mezonlar saqlandi.`);',
    '      toast.success(`${commissions.find((item) => item.id === activeCommission)?.short} bo‘yicha bugungi baholar alohida saqlandi. 60 kunlik yig‘indi avtomatik hisoblanadi.`);',
    'daily-save-toast',
  );

  source = replaceOnce(
    source,
    '  const draftTotal = Number(commissions.reduce((sum, commission) => sum + draftScores[commission.id], 0).toFixed(1));',
    '  const draftTotal = Number(commissions.reduce((sum, commission) => sum + draftScores[commission.id], 0).toFixed(1));\n  const activeCriterionIds = new Set(criteria.filter((criterion) => criterion.commission === activeCommission).map((criterion) => criterion.id));\n  const cumulative60 = selectedInstitution ? cumulative60Score(data.dailyEvaluations, selectedInstitution.id, activeCriterionIds) : 0;',
    'cumulative-60-value',
  );

  source = replaceOnce(
    source,
    '<DialogDescription>{selectedRound}-kunlik nazorat · {readOnlyEvaluation ? "ball, izoh va fayl asoslarini ko‘rish" : "kerakli mezonlarni baholab saqlang"}</DialogDescription>',
    '<DialogDescription>{tashkentDateKey()} · Kunlik baholash · {readOnlyEvaluation ? "ball, izoh va fayl asoslarini ko‘rish" : "bugungi kerakli mezonlarni baholab saqlang"}</DialogDescription>',
    'daily-dialog-description',
  );

  source = replaceOnce(
    source,
    '<div className="draft-total"><span>Jami KPI</span><strong>{draftTotal}<small>/100</small></strong></div>',
    '<div className="draft-total"><span>Bugungi KPI</span><strong>{draftTotal}<small>/100</small></strong><em style={{ display: "block", marginTop: 4, fontSize: 11, fontStyle: "normal", opacity: .85 }}>60 kunlik yig‘indi: {cumulative60} ball</em></div>',
    'cumulative-header-display',
  );

  source = replaceOnce(
    source,
    '5 ta yo‘nalish bo‘yicha barcha baholash mezonlari to‘g‘ridan-to‘g‘ri joylashtirilgan. Har bir mezon 0/1/2 ball bilan baholanadi. Baholovchi kerakli mezonlarni alohida saqlashi mumkin, izoh esa ixtiyoriy.',
    '5 ta yo‘nalish bo‘yicha mezonlar 0/1/2 ball bilan baholanadi. Baholovchi har kuni yangidan ball qo‘yadi, har kunlik baho alohida saqlanadi va 60 kungacha yig‘indi avtomatik hisoblanadi. Izoh ixtiyoriy.',
    'daily-help-copy',
  );

  return source;
});

console.log('PATCH25: daily evaluator scoring enabled. Each day is stored separately and cumulative score is calculated automatically for the latest 60 daily scores per criterion.');
