import fs from 'node:fs';

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`PATCH43: ${file} not found`);
  return fs.readFileSync(file, 'utf8');
}
function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
  console.log(`PATCH43: patched ${file}`);
}
function replace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`PATCH43: anchor not found: ${label}`);
  return source.replace(from, to);
}

// Evaluator must reopen the last/current score snapshot on the following day too.
{
  const file = 'components/kpi-app.tsx';
  let s = read(file);
  s = replace(s,
`  const today = tashkentDateKey();
  const todayRows = data.dailyEvaluations.filter(
    (item) => item.institutionId === institution.id && item.evaluationDate === today,
  );`,
`  const currentRows = data.evaluations.filter(
    (item) => item.institutionId === institution.id && item.roundDay === activeRound,
  );`, 'current evaluation rows');
  s = replace(s,
    '  setScores(Object.fromEntries(todayRows.map((item) => [item.criterionId, Number(item.score)])));',
    '  setScores(Object.fromEntries(currentRows.map((item) => [item.criterionId, Number(item.score)])));',
    'persistent evaluator scores');
  s = replace(s,
    '    const saved = todayRows.find((item) => item.criterionId === criterion.id);',
    '    const saved = currentRows.find((item) => item.criterionId === criterion.id);',
    'persistent evaluator notes');
  s = s.replaceAll('Kamida 6 belgi', 'Kamida 12 belgi, harf + raqam');
  write(file, s);
}

// Evaluation writes are atomic; unchanged saves do not move timestamps; score changes need fresh evidence.
{
  const file = 'app/api/kpi/route.ts';
  let s = read(file);
  const start = s.indexOf('    if (payload.action === "save_evaluation") {');
  const end = s.indexOf('    requireAdmin(session.role);', start);
  if (start < 0 || end < 0) throw new Error('PATCH43: save_evaluation block not found');
  const block = String.raw`    if (payload.action === "save_evaluation") {
      const institutionId = payload.institutionId?.trim() ?? "";
      const roundDay = Number(payload.roundDay);
      const scoreMap = payload.scores ?? {};
      const noteMap = payload.notes ?? {};
      const allowedCommission = session.role === "evaluator" ? session.commission : null;
      if (session.role === "monitor") throw new AccessError("Monitoring foydalanuvchisi baho qo‘ya olmaydi.");
      if (!institutionId || !rounds.includes(roundDay as (typeof rounds)[number])) {
        return Response.json({ error: "Muassasa yoki baholash davri noto‘g‘ri." }, { status: 400 });
      }
      const entries = Object.entries(scoreMap);
      if (!entries.length) return Response.json({ error: "Baholash mezonlari tanlanmagan." }, { status: 400 });
      for (const [criterionId, score] of entries) {
        const criterion = criteria.find((item) => item.id === criterionId);
        if (!criterion || ![0, 1, 2].includes(Number(score))) {
          return Response.json({ error: "Ball qiymati noto‘g‘ri." }, { status: 400 });
        }
        if (allowedCommission && criterion.commission !== allowedCommission) {
          throw new AccessError("Siz faqat biriktirilgan yo‘nalishni baholay olasiz.");
        }
      }

      const client = await db.pool.connect();
      let saved = 0;
      let unchanged = 0;
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["evaluation:" + institutionId + ":" + roundDay]);
        const existingResult = await client.query(
          "SELECT criterion_id AS \"criterionId\", score, note, updated_at AS \"updatedAt\" FROM evaluations WHERE institution_id = $1 AND round_day = $2",
          [institutionId, roundDay],
        );
        const existingRows = existingResult.rows as Array<Record<string, unknown>>;
        const existingMap = new Map(existingRows.map((row) => [String(row.criterionId), row]));
        const changedEntries = entries.filter(([criterionId, score]) => {
          const previous = existingMap.get(criterionId);
          const note = (noteMap[criterionId] ?? "").trim();
          if (!previous) return true;
          return Number(previous.score) !== Number(score) || String(previous.note ?? "").trim() !== note;
        });
        unchanged = entries.length - changedEntries.length;

        if (session.role === "evaluator") {
          for (const [criterionId, score] of changedEntries) {
            const criterion = criteria.find((item) => item.id === criterionId);
            if (!criterion || criterion.requiresInstitutionFile !== true) continue;
            const previous = existingMap.get(criterionId);
            const scoreChanged = !previous || Number(previous.score) !== Number(score);
            if (!scoreChanged) continue;
            const evidenceResult = await client.query(
              "SELECT created_at AS \"createdAt\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN ('institution', 'institution_submission') ORDER BY created_at DESC LIMIT 1",
              [institutionId, criterionId],
            );
            const latestEvidence = evidenceResult.rows[0]?.createdAt ? new Date(evidenceResult.rows[0].createdAt).getTime() : 0;
            if (!latestEvidence && !previous && Number(score) === 0) continue;
            if (!latestEvidence) {
              throw new AccessError("Avval muassasa ushbu mezon bo‘yicha dalil faylini yuklashi kerak.", 409);
            }
            if (previous?.updatedAt) {
              const previousScoreAt = new Date(previous.updatedAt as string | number | Date).getTime();
              if (Number.isFinite(previousScoreAt) && latestEvidence <= previousScoreAt) {
                throw new AccessError("Bu mezonning amaldagi bali yangi dalil fayli yuklanmaguncha o‘zgartirilmaydi.", 409);
              }
            }
          }
        }

        for (const [criterionId, score] of changedEntries) {
          const note = (noteMap[criterionId] ?? "").trim();
          await client.query(
            "INSERT INTO daily_evaluations (institution_id, criterion_id, evaluation_date, score, note, evaluator_email, evaluator_name, created_at, updated_at) VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Tashkent')::date, $3, $4, $5, $6, NOW(), NOW()) ON CONFLICT (institution_id, criterion_id, evaluation_date) DO UPDATE SET score = EXCLUDED.score, note = EXCLUDED.note, evaluator_email = EXCLUDED.evaluator_email, evaluator_name = EXCLUDED.evaluator_name, updated_at = NOW()",
            [institutionId, criterionId, Number(score), note, session.email, session.name],
          );
          await client.query(
            "INSERT INTO evaluations (institution_id, round_day, criterion_id, score, note, evaluator_email, evaluator_name, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) ON CONFLICT (institution_id, round_day, criterion_id) DO UPDATE SET score = EXCLUDED.score, note = EXCLUDED.note, evaluator_email = EXCLUDED.evaluator_email, evaluator_name = EXCLUDED.evaluator_name, updated_at = CASE WHEN evaluations.score IS DISTINCT FROM EXCLUDED.score THEN NOW() ELSE evaluations.updated_at END",
            [institutionId, roundDay, criterionId, Number(score), note, session.email, session.name],
          );
        }
        if (changedEntries.length) {
          const auditDetail = "Baholash yangilandi: " + changedEntries.length + " mezon · " + (new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" })).format(new Date());
          await client.query(
            "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1, 'evaluation_saved', 'institution', $2, $3)",
            [session.email, institutionId, auditDetail],
          );
        }
        await client.query("COMMIT");
        saved = changedEntries.length;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      return Response.json({ saved, unchanged });
    }

`;
  s = s.slice(0, start) + block + s.slice(end);
  s = replace(s,
`      if (payload.password && payload.password.length < 6) {
        return Response.json({ error: "Parol kamida 6 ta belgidan iborat bo‘lsin." }, { status: 400 });
      }`,
`      if (payload.password) {
        const password = payload.password;
        if (password.length < 12 || password.length > 128) {
          return Response.json({ error: "Parol 12–128 ta belgidan iborat bo‘lsin." }, { status: 400 });
        }
        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          return Response.json({ error: "Parolda kamida bitta harf va bitta raqam bo‘lsin." }, { status: 400 });
        }
        const weak = password.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (["123456789012", "password1234", "admin123456", "qwerty123456"].includes(weak)) {
          return Response.json({ error: "Bu parol juda oddiy. Murakkabroq parol tanlang." }, { status: 400 });
        }
      }`, 'strong password policy');
  write(file, s);
}

// The final upload completion repeats the recurrence check under a DB advisory lock.
// This prevents two concurrent uploads from bypassing the period restriction.
{
  const file = 'app/api/uploads/complete/route.ts';
  let s = read(file);
  if (!s.includes('import { criteria } from "@/lib/kpi-data";')) {
    s = replace(s, 'import { getKpiDatabase } from "@/lib/netlify-db";', 'import { getKpiDatabase } from "@/lib/netlify-db";\nimport { criteria } from "@/lib/kpi-data";', 'criteria import');
  }
  if (!s.includes('function recurrenceIntervalDays')) {
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
    s = replace(s, 'async function cleanUp(', helper + 'async function cleanUp(', 'recurrence helper');
  }
  const orderAt = s.indexOf('    if (intent.kind === "institution_order") {');
  const elseStart = s.indexOf('    } else {\n      const id = crypto.randomUUID();', orderAt);
  const endMarker = '\n    }\n\n    return Response.json({ saved: true }';
  const elseEnd = s.indexOf(endMarker, elseStart);
  if (orderAt < 0 || elseStart < 0 || elseEnd < 0) throw new Error('PATCH43: complete non-order block not found');
  const newElse = String.raw`    } else {
      const id = crypto.randomUUID();
      const sourceName = intent.kind === "evaluator" ? "evaluator" : "institution";
      if (intent.kind === "institution_criterion") {
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
        const client = await db.pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["criterion-upload:" + intent.institutionId + ":" + intent.criterionId]);
          const intervalDays = recurrenceIntervalDays(criterion.deadline);
          if (intervalDays) {
            const recentResult = await client.query(
              "SELECT created_at AS \"createdAt\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN ('institution', 'institution_submission') ORDER BY created_at DESC LIMIT 1",
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
            "INSERT INTO attachments (id, institution_id, round_day, criterion_id, filename, content_type, size_bytes, object_key, uploaded_by, source, submission_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(NOW() AT TIME ZONE 'Asia/Tashkent')::date)",
            [id, intent.institutionId, intent.roundDay, intent.criterionId, intent.filename, intent.contentType, intent.sizeBytes, intent.objectKey, session.email, sourceName],
          );
          await client.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      } else {
        await db.pool.query(
          "INSERT INTO attachments (id, institution_id, round_day, criterion_id, filename, content_type, size_bytes, object_key, uploaded_by, source, submission_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(NOW() AT TIME ZONE 'Asia/Tashkent')::date)",
          [id, intent.institutionId, intent.roundDay, intent.criterionId, intent.filename, intent.contentType, intent.sizeBytes, intent.objectKey, session.email, sourceName],
        );
        await db.pool.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]);
      }
    }`;
  s = s.slice(0, elseStart) + newElse + s.slice(elseEnd + '\n    }'.length);
  write(file, s);
}

// Correct stale daily-only wording in institution views.
{
  const file = 'components/institution-portal.tsx';
  let s = read(file);
  const pairs = [
    ['Mezon bo‘yicha kunlik fayllar', 'Mezon bo‘yicha dalil fayllari'],
    ['Fayl talab qilinadigan mezonlarga har kuni 1 ta fayl yuklash mumkin (08:00–19:00).', 'Har bir mezon fayli “Ijro muddati”da ko‘rsatilgan davriylik bo‘yicha yuklanadi. Muddat kelmaguncha qayta yuklash bloklanadi.'],
    ['<strong>Bugun yuklangan</strong>', '<strong>Amaldagi fayl yuklangan</strong>'],
    [' · Ertaga yana yuklash mumkin', ' · Qayta yuklash ijro muddati kelganda ochiladi'],
    ['"Bugungi faylni yuklash"', '"Mezon faylini yuklash"'],
  ];
  for (const [a, b] of pairs) s = s.replaceAll(a, b);
  write(file, s);
}
{
  const file = 'components/institution-submission-manager.tsx';
  let s = read(file);
  s = s.replace('Har bir mezonga yuklangan hujjatni ko‘rish, noto‘g‘ri faylni o‘chirish va keyin qayta yuklash mumkin.', 'Har bir mezonga yuklangan hujjatlarni ko‘rish mumkin. Qayta yuklash mezonning ijro muddati kelganda ochiladi.');
  write(file, s);
}

console.log('PATCH43: current evaluator score persists across days.');
console.log('PATCH43: unchanged saves do not rewrite score timestamps.');
console.log('PATCH43: score changes for file-required criteria require fresh institution evidence; first zero without evidence remains allowed.');
console.log('PATCH43: recurrence is enforced at prepare and final completion; concurrent double-upload bypass is closed.');
console.log('PATCH43: institution recurrence UI copy and account password policy hardened.');
console.log('PATCH43: no historical evaluation or uploaded evidence was deleted.');
