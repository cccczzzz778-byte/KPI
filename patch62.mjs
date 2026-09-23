import fs from "node:fs";

function read(file) {
  if (!fs.existsSync(file)) throw new Error("PATCH62 missing " + file);
  return fs.readFileSync(file, "utf8");
}
function write(file, source) {
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH62: " + file);
}

const helpers = [
  "function patch62IsDaily(deadline: unknown) {",
  "  const value = String(deadline || \"\").toLocaleLowerCase(\"uz\");",
  "  return value.includes(\"har kuni\") || value.includes(\"doimiy\") || value.includes(\"muntazam\") || value.includes(\"1 kun\");",
  "}",
  "",
  "function patch62RollingDays(deadline: unknown) {",
  "  const value = String(deadline || \"\").toLocaleLowerCase(\"uz\");",
  "  if (value.includes(\"1 hafta\") || value.includes(\"haftada 1 marta\")) return 7;",
  "  if (value.includes(\"10 kun\")) return 10;",
  "  if (value.includes(\"1 oy\") || value.includes(\"har oyda\")) return 30;",
  "  if (value.includes(\"60 kun\")) return 60;",
  "  if (value.includes(\"ikkinchi yarim yillik\")) return 180;",
  "  return null;",
  "}",
  "",
  "function patch62TomorrowTashkentDate() {",
  "  const parts = new Intl.DateTimeFormat(\"en-CA\", { timeZone: \"Asia/Tashkent\", year: \"numeric\", month: \"2-digit\", day: \"2-digit\" }).formatToParts(new Date());",
  "  const year = Number(parts.find((part) => part.type === \"year\")?.value || \"0\");",
  "  const month = Number(parts.find((part) => part.type === \"month\")?.value || \"1\");",
  "  const day = Number(parts.find((part) => part.type === \"day\")?.value || \"1\");",
  "  const next = new Date(Date.UTC(year, month - 1, day + 1));",
  "  return String(next.getUTCFullYear()).padStart(4, \"0\") + \"-\" + String(next.getUTCMonth() + 1).padStart(2, \"0\") + \"-\" + String(next.getUTCDate()).padStart(2, \"0\");",
  "}",
  ""
].join("\n");

// PREPARE: one consistent recurrence check before an upload intent is issued.
{
  const file = "app/api/uploads/prepare/route.ts";
  let s = read(file);
  if (!s.includes("function patch62IsDaily(")) {
    const anchor = "export async function POST(";
    if (!s.includes(anchor)) throw new Error("PATCH62 prepare POST anchor missing");
    s = s.replace(anchor, helpers + "\n" + anchor);
  }

  const marker = "    /* PATCH41_PDF_UPLOAD_RECURRENCE */";
  const start = s.indexOf(marker);
  const endAnchor = "    const uploadId = crypto.randomUUID();";
  const end = s.indexOf(endAnchor, start);
  if (start < 0 || end < 0) throw new Error("PATCH62 prepare recurrence block missing");

  const block = [
    "    /* PATCH62_RECURRENCE_PREPARE */",
    "    if (kind === \"institution_criterion\") {",
    "      /* PATCH50_INSTITUTION_UPLOAD_HOURS_PREPARE */",
    "      if (!institutionUploadWindowOpen()) { /* PATCH62_ALL_UPLOADS_08_19 */",
    "        return Response.json(",
    "          { error: \"Muassasalar faylni faqat soat 08:00 dan 19:00 gacha (O‘zbekiston vaqti) yuklay oladi.\", uploadWindow: \"08:00-19:00\" },",
    "          { status: 403, headers: { \"cache-control\": \"no-store\" } },",
    "        );",
    "      }",
    "",
    "      const recurrenceCriterionId = String(body.criterionId ?? \"\").trim();",
    "      const recurrenceInstitutionId = String(session.institutionId ?? \"\").trim();",
    "      const recurrenceCriterion = criteria.find((item) => item.id === recurrenceCriterionId);",
    "      if (!recurrenceCriterion || !recurrenceInstitutionId) {",
    "        return Response.json({ error: \"Muassasa yoki mezon topilmadi.\" }, { status: 400 });",
    "      }",
    "",
    "      const recurrenceDb = getKpiDatabase();",
    "      if (patch62IsDaily(recurrenceCriterion.deadline)) {",
    "        const sameDay = await recurrenceDb.pool.query(",
    "          \"SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' AND (created_at AT TIME ZONE 'Asia/Tashkent')::date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date ORDER BY created_at DESC LIMIT 1\",",
    "          [recurrenceInstitutionId, recurrenceCriterionId],",
    "        );",
    "        if (sameDay.rows.length) {",
    "          const nextDate = patch62TomorrowTashkentDate();",
    "          return Response.json(",
    "            { error: \"Bu mezon bugun allaqachon yuklangan. Keyingi yuklash: \" + nextDate + \" soat 08:00 dan.\", nextUploadDate: nextDate, deadline: recurrenceCriterion.deadline },",
    "            { status: 409, headers: { \"cache-control\": \"no-store\" } },",
    "          );",
    "        }",
    "      } else {",
    "        const intervalDays = patch62RollingDays(recurrenceCriterion.deadline);",
    "        if (intervalDays) {",
    "          const recentResult = await recurrenceDb.pool.query(",
    "            \"SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' ORDER BY created_at DESC LIMIT 1\",",
    "            [recurrenceInstitutionId, recurrenceCriterionId],",
    "          );",
    "          const lastCreatedAt = recentResult.rows[0]?.createdAt ? new Date(recentResult.rows[0].createdAt).getTime() : 0;",
    "          const nextAt = lastCreatedAt ? lastCreatedAt + intervalDays * 24 * 60 * 60 * 1000 : 0;",
    "          if (nextAt && Date.now() < nextAt) {",
    "            const nextDate = new Intl.DateTimeFormat(\"en-CA\", { timeZone: \"Asia/Tashkent\", year: \"numeric\", month: \"2-digit\", day: \"2-digit\" }).format(new Date(nextAt));",
    "            return Response.json(",
    "              { error: \"Bu mezon uchun fayl \" + recurrenceCriterion.deadline + \" bo‘yicha qabul qilinadi. Keyingi yuklash: \" + nextDate + \".\", nextUploadDate: nextDate, deadline: recurrenceCriterion.deadline },",
    "              { status: 409, headers: { \"cache-control\": \"no-store\" } },",
    "            );",
    "          }",
    "        }",
    "      }",
    "    }",
    ""
  ].join("\n");

  s = s.slice(0, start) + block + s.slice(end);
  write(file, s);
}

// COMPLETE: repeat the same rule while holding the per-criterion DB lock.
// This closes race conditions and makes daily/weekly/monthly behavior identical
// between prepare and final save.
{
  const file = "app/api/uploads/complete/route.ts";
  let s = read(file);
  if (!s.includes("function patch62IsDaily(")) {
    const anchor = "export async function POST(";
    if (!s.includes(anchor)) throw new Error("PATCH62 complete POST anchor missing");
    s = s.replace(anchor, helpers + "\n" + anchor);
  }

  const startMarker = "    if (intent.kind === \"institution_criterion\") {";
  const start = s.indexOf(startMarker);
  const responseMarker = "      return Response.json({ storageProvider, attachment: { id, filename: criterionIntent.filename, sizeBytes: criterionIntent.sizeBytes, dailyLocked: true, recurrenceLocked: true } }, { status: 201 });\n    }";
  const responseAt = s.indexOf(responseMarker, start);
  if (start < 0 || responseAt < 0) throw new Error("PATCH62 complete institution block missing");
  const end = responseAt + responseMarker.length;

  const block = [
    "    if (intent.kind === \"institution_criterion\") {",
    "      /* PATCH50_INSTITUTION_UPLOAD_HOURS_COMPLETE */",
    "      if (!institutionUploadWindowOpen()) { /* PATCH62_ALL_UPLOADS_08_19 */",
    "        await cleanUp(uploadId, intent);",
    "        intent = null;",
    "        return Response.json(",
    "          { error: \"Fayl qabul qilish vaqti tugagan. Muassasalar uchun yuklash har kuni 08:00–19:00 (O‘zbekiston vaqti).\", uploadWindow: \"08:00-19:00\" },",
    "          { status: 403, headers: { \"cache-control\": \"no-store\" } },",
    "        );",
    "      }",
    "",
    "      const criterionIntent = intent;",
    "      if (session.role !== \"institution\" || session.institutionId !== criterionIntent.institutionId) {",
    "        await cleanUp(uploadId, criterionIntent);",
    "        intent = null;",
    "        throw new AccessError(\"Bu mezon fayli boshqa muassasaga tegishli.\", 403);",
    "      }",
    "      const criterion = criteria.find((item) => item.id === criterionIntent.criterionId);",
    "      if (!criterion) {",
    "        await cleanUp(uploadId, criterionIntent);",
    "        intent = null;",
    "        throw new AccessError(\"Mezon topilmadi.\", 400);",
    "      }",
    "",
    "      const client = await db.pool.connect();",
    "      try {",
    "        await client.query(\"BEGIN\");",
    "        await client.query(\"SELECT pg_advisory_xact_lock(hashtext($1))\", [\"criterion-upload:\" + criterionIntent.institutionId + \":\" + criterionIntent.criterionId]);",
    "",
    "        let nextUploadDate = \"\";",
    "        let recurrenceLocked = false;",
    "        if (patch62IsDaily(criterion.deadline)) {",
    "          const sameDay = await client.query(",
    "            \"SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' AND (created_at AT TIME ZONE 'Asia/Tashkent')::date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date ORDER BY created_at DESC LIMIT 1\",",
    "            [criterionIntent.institutionId, criterionIntent.criterionId],",
    "          );",
    "          recurrenceLocked = sameDay.rows.length > 0;",
    "          if (recurrenceLocked) nextUploadDate = patch62TomorrowTashkentDate();",
    "        } else {",
    "          const intervalDays = patch62RollingDays(criterion.deadline);",
    "          if (intervalDays) {",
    "            const recentResult = await client.query(",
    "              \"SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' ORDER BY created_at DESC LIMIT 1\",",
    "              [criterionIntent.institutionId, criterionIntent.criterionId],",
    "            );",
    "            const lastCreatedAt = recentResult.rows[0]?.createdAt ? new Date(recentResult.rows[0].createdAt).getTime() : 0;",
    "            const nextAt = lastCreatedAt ? lastCreatedAt + intervalDays * 24 * 60 * 60 * 1000 : 0;",
    "            recurrenceLocked = Boolean(nextAt && Date.now() < nextAt);",
    "            if (recurrenceLocked) nextUploadDate = new Intl.DateTimeFormat(\"en-CA\", { timeZone: \"Asia/Tashkent\", year: \"numeric\", month: \"2-digit\", day: \"2-digit\" }).format(new Date(nextAt));",
    "          }",
    "        }",
    "",
    "        if (recurrenceLocked) {",
    "          await client.query(\"ROLLBACK\");",
    "          await client.query(\"DELETE FROM upload_intents WHERE id=$1\", [uploadId]);",
    "          await deleteR2Object(criterionIntent.objectKey).catch(() => undefined);",
    "          intent = null;",
    "          const message = patch62IsDaily(criterion.deadline)",
    "            ? \"Bu mezon bugun allaqachon yuklangan. Keyingi yuklash: \" + nextUploadDate + \" soat 08:00 dan.\"",
    "            : \"Bu mezon uchun fayl \" + criterion.deadline + \" bo‘yicha qabul qilinadi. Keyingi yuklash: \" + nextUploadDate + \".\";",
    "          return Response.json(",
    "            { error: message, nextUploadDate, deadline: criterion.deadline },",
    "            { status: 409, headers: { \"cache-control\": \"no-store\" } },",
    "          );",
    "        }",
    "",
    "        await client.query(",
    "          \"INSERT INTO attachments (id, institution_id, round_day, criterion_id, filename, object_key, content_type, size_bytes, uploaded_by, source, responsible_name, responsible_phone, submission_date, storage_provider) VALUES ($1,$2,0,$3,$4,$5,$6,$7,$8,'institution',$9,$10,$11::date,$12)\",",
    "          [id, criterionIntent.institutionId, criterionIntent.criterionId, criterionIntent.filename, criterionIntent.objectKey, criterionIntent.contentType, criterionIntent.sizeBytes, criterionIntent.uploadedBy, criterionIntent.responsibleName, criterionIntent.responsiblePhone, criterionIntent.submissionDate, storageProvider],",
    "        );",
    "        await client.query(",
    "          \"INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'institution_file_uploaded','attachment',$2,$3)\",",
    "          [criterionIntent.uploadedBy, id, criterionIntent.criterionId + \" / \" + criterionIntent.filename + \" / RAILWAY / Mas’ul: \" + criterionIntent.responsibleName + \", \" + criterionIntent.responsiblePhone],",
    "        );",
    "        await client.query(\"COMMIT\");",
    "      } catch (error: unknown) {",
    "        await client.query(\"ROLLBACK\").catch(() => undefined);",
    "        const code = typeof error === \"object\" && error && \"code\" in error ? String((error as { code?: unknown }).code ?? \"\") : \"\";",
    "        if (code === \"23505\") {",
    "          await cleanUp(uploadId, criterionIntent);",
    "          return Response.json({ error: \"Bu mezon uchun joriy davr fayli allaqachon yuklangan. Keyingi ijro muddati kelganda qayta yuklash mumkin.\" }, { status: 409 });",
    "        }",
    "        throw error;",
    "      } finally { client.release(); }",
    "      await db.pool.query(\"DELETE FROM upload_intents WHERE id=$1\", [uploadId]);",
    "      return Response.json({ storageProvider, attachment: { id, filename: criterionIntent.filename, sizeBytes: criterionIntent.sizeBytes, dailyLocked: true, recurrenceLocked: true } }, { status: 201 });",
    "    }"
  ].join("\n");

  s = s.slice(0, start) + block + s.slice(end);
  write(file, s);
}

console.log("PATCH62: DAILY = once per Asia/Tashkent calendar date; date changes at 00:00, upload opens 08:00.");
console.log("PATCH62: WEEKLY = 7 days from the latest accepted upload.");
console.log("PATCH62: MONTHLY = 30 days from the latest accepted upload.");
console.log("PATCH62: 10/60/180-day rules stay unchanged; all institution uploads remain 08:00-19:00.");
console.log("PATCH62: prepare and complete routes now enforce the same recurrence rule.");
