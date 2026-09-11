import fs from 'node:fs';

// Adapt the generated one-line evaluator source to the audited hardening patch.
const appFile = 'components/kpi-app.tsx';
let app = fs.readFileSync(appFile, 'utf8');
const compact = '    const todayRows = data.dailyEvaluations.filter((item) => item.institutionId === institution.id && item.evaluationDate === today);';
const expanded = '  const todayRows = data.dailyEvaluations.filter(\n    (item) => item.institutionId === institution.id && item.evaluationDate === today,\n  );';
if (!app.includes(compact)) throw new Error('PATCH45: compact evaluator anchor not found');
app = app.replace(compact, expanded);
fs.writeFileSync(appFile, app, 'utf8');

// Run patch43 without its obsolete upload-route shape; upload hardening is applied below to the audited current route.
let core = fs.readFileSync('patch43.mjs', 'utf8');
const cutStart = core.indexOf('// The final upload completion repeats the recurrence check under a DB advisory lock.');
const cutEnd = core.indexOf('// Correct stale daily-only wording in institution views.', cutStart);
if (cutStart < 0 || cutEnd < 0) throw new Error('PATCH45: patch43 upload section markers not found');
core = core.slice(0, cutStart) + core.slice(cutEnd);
fs.writeFileSync('.patch45-core.mjs', core, 'utf8');
await import('./.patch45-core.mjs?run=1');

app = fs.readFileSync(appFile, 'utf8');
if (!app.includes('item.roundDay === activeRound')) throw new Error('PATCH45: activeRound output not found');
app = app.replace('item.roundDay === activeRound', 'item.roundDay === selectedRound');
fs.writeFileSync(appFile, app, 'utf8');

// Harden the actual current institution_criterion completion path.
const completeFile = 'app/api/uploads/complete/route.ts';
let complete = fs.readFileSync(completeFile, 'utf8');
if (!complete.includes('import { criteria } from "@/lib/kpi-data";')) {
  const anchor = 'import { getKpiDatabase } from "@/lib/netlify-db";';
  if (!complete.includes(anchor)) throw new Error('PATCH45: complete import anchor not found');
  complete = complete.replace(anchor, anchor + '\nimport { criteria } from "@/lib/kpi-data";');
}
if (!complete.includes('function recurrenceIntervalDays')) {
  const helper = String.raw`function recurrenceIntervalDays(deadline: unknown) {
  const value = String(deadline || "").toLocaleLowerCase("uz");
  if (value.includes("har kuni") || value.includes("doimiy") || value.includes("muntazam") || value.includes("1 kun")) return 1;
  if (value.includes("1 hafta") || value.includes("haftada 1 marta")) return 7;
  if (value.includes("10 kun")) return 10;
  if (value.includes("1 oy") || value.includes("har oyda")) return 30;
  if (value.includes("60 kun")) return 60;
  if (value.includes("ikkinchi yarim yillik")) return 180;
  return null;
}

`;
  const anchor = 'async function cleanUp(';
  if (!complete.includes(anchor)) throw new Error('PATCH45: cleanup anchor not found');
  complete = complete.replace(anchor, helper + anchor);
}

const criterionStart = complete.indexOf('    if (intent.kind === "institution_criterion") {');
const criterionEndMarker = '      return Response.json({ storageProvider, attachment: { id, filename: intent.filename, sizeBytes: intent.sizeBytes, dailyLocked: true } }, { status: 201 });\n    }';
const criterionEndAt = complete.indexOf(criterionEndMarker, criterionStart);
if (criterionStart < 0 || criterionEndAt < 0) throw new Error('PATCH45: audited institution criterion block not found');
const criterionEnd = criterionEndAt + criterionEndMarker.length;

const newCriterionBlock = String.raw`    if (intent.kind === "institution_criterion") {
      if (session.role !== "institution" || session.institutionId !== intent.institutionId) {
        await cleanUp(uploadId, intent);
        intent = null;
        throw new AccessError("Bu mezon fayli boshqa muassasaga tegishli.", 403);
      }
      const criterion = criteria.find((item) => item.id === intent.criterionId);
      if (!criterion) {
        await cleanUp(uploadId, intent);
        intent = null;
        throw new AccessError("Mezon topilmadi.", 400);
      }
      const intervalDays = recurrenceIntervalDays(criterion.deadline);
      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["criterion-upload:" + intent.institutionId + ":" + intent.criterionId]);
        if (intervalDays) {
          const recentResult = await client.query(
            "SELECT created_at AS \"createdAt\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') ORDER BY created_at DESC LIMIT 1",
            [intent.institutionId, intent.criterionId],
          );
          const lastCreatedAt = recentResult.rows[0]?.createdAt ? new Date(recentResult.rows[0].createdAt).getTime() : 0;
          const nextAt = lastCreatedAt ? lastCreatedAt + intervalDays * 24 * 60 * 60 * 1000 : 0;
          if (nextAt && Date.now() < nextAt) {
            const nextDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nextAt));
            await client.query("ROLLBACK");
            await client.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]);
            await deleteR2Object(intent.objectKey).catch(() => undefined);
            const deadline = criterion.deadline;
            intent = null;
            return Response.json(
              { error: "Bu mezon uchun fayl " + deadline + " bo‘yicha qabul qilinadi. Keyingi yuklash: " + nextDate + ".", nextUploadDate: nextDate, deadline },
              { status: 409, headers: { "cache-control": "no-store" } },
            );
          }
        }
        await client.query(
          "INSERT INTO attachments (id, institution_id, round_day, criterion_id, filename, object_key, content_type, size_bytes, uploaded_by, source, responsible_name, responsible_phone, submission_date, storage_provider) VALUES ($1,$2,0,$3,$4,$5,$6,$7,$8,'institution',$9,$10,$11::date,$12)",
          [id, intent.institutionId, intent.criterionId, intent.filename, intent.objectKey, intent.contentType, intent.sizeBytes, intent.uploadedBy, intent.responsibleName, intent.responsiblePhone, intent.submissionDate, storageProvider],
        );
        await client.query(
          "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'institution_file_uploaded','attachment',$2,$3)",
          [intent.uploadedBy, id, intent.criterionId + " / " + intent.filename + " / RAILWAY / Mas’ul: " + intent.responsibleName + ", " + intent.responsiblePhone],
        );
        await client.query("COMMIT");
      } catch (error: unknown) {
        await client.query("ROLLBACK").catch(() => undefined);
        const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
        if (code === "23505") {
          await cleanUp(uploadId, intent);
          return Response.json({ error: "Bu mezon uchun joriy davr fayli allaqachon yuklangan. Keyingi ijro muddati kelganda qayta yuklash mumkin." }, { status: 409 });
        }
        throw error;
      } finally { client.release(); }
      await db.pool.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]);
      return Response.json({ storageProvider, attachment: { id, filename: intent.filename, sizeBytes: intent.sizeBytes, dailyLocked: true, recurrenceLocked: true } }, { status: 201 });
    }`;

complete = complete.slice(0, criterionStart) + newCriterionBlock + complete.slice(criterionEnd);
fs.writeFileSync(completeFile, complete, 'utf8');
console.log('PATCH45: final institution upload recurrence recheck + concurrency lock applied.');
console.log('PATCH45: evaluator persistence, atomic evaluation updates, fresh-evidence score lock, UI cleanup and password hardening applied.');
console.log('PATCH45: existing files, scores and history preserved.');
