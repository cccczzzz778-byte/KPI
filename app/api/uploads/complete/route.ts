import { createHash } from "node:crypto";
import { getKpiDatabase } from "@/lib/netlify-db";
import { criteria } from "@/lib/kpi-data";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";
import { deleteR2Object, headR2Object, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

type UploadIntent = {
  version: number;
  tokenHash?: string;
  uploadedAt?: number;
  kind: "institution_order" | "institution_criterion" | "evaluator";
  storageProvider: "railway";
  objectKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  institutionId: string;
  criterionId: string;
  roundDay: number;
  responsibleName: string;
  responsiblePhone: string;
  submissionDate: string;
  uploadedBy: string;
  expiresAt: number;
};

function tokenDigest(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }

function recurrenceIntervalDays(deadline: unknown) {
  const value = String(deadline || "").toLocaleLowerCase("uz");
  if (value.includes("har kuni") || value.includes("doimiy") || value.includes("muntazam") || value.includes("1 kun")) return null; /* PATCH59_CALENDAR_DAY */
  if (value.includes("1 hafta") || value.includes("haftada 1 marta")) return 7;
  if (value.includes("10 kun")) return 10;
  if (value.includes("1 oy") || value.includes("har oyda")) return 30;
  if (value.includes("60 kun")) return 60;
  if (value.includes("ikkinchi yarim yillik")) return 180;
  return null;
}

async function cleanUp(uploadId: string, intent?: UploadIntent | null) {
  const db = getKpiDatabase();
  // Never delete an object referenced by a committed attachment.
  if (intent?.objectKey && isR2Configured()) {
    try {
      const referenced = await db.pool.query("SELECT 1 FROM attachments WHERE object_key=$1 LIMIT 1", [intent.objectKey]);
      if (!referenced.rowCount) await deleteR2Object(intent.objectKey);
    } catch (error) {
      // On database or storage failure, preserve the object rather than risk data loss.
      console.error("upload cleanup deferred", error);
      return;
    }
  }
  await db.pool.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]).catch(() => undefined);
}

async function verifyStored(intent: UploadIntent) {
  if (!isR2Configured()) throw new Error("Railway Storage Bucket sozlanmagan.");
  try {
    const result = await headR2Object(intent.objectKey);
    if (Number(result.ContentLength ?? -1) !== intent.sizeBytes) {
      throw new Error("Ombordagi fayl hajmi yuborilgan fayl hajmiga mos emas.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("hajmi")) throw error;
    throw new Error("Fayl Railway Storage Bucket omboriga to‘liq yozilmagan.");
  }
}

function institutionUploadWindowOpen() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  return minutes >= 8 * 60 && minutes < 19 * 60;
}

function patch59IsCalendarDailyCriterion(item: { deadline?: unknown } | undefined) {
  const value = String(item?.deadline || "").toLocaleLowerCase("uz");
  return value.includes("har kuni") || value.includes("doimiy") || value.includes("muntazam") || value.includes("1 kun");
}

function patch62IsDaily(deadline: unknown) {
  const value = String(deadline || "").toLocaleLowerCase("uz");
  return value.includes("har kuni") || value.includes("doimiy") || value.includes("muntazam") || value.includes("1 kun");
}

function patch62RollingDays(deadline: unknown) {
  const value = String(deadline || "").toLocaleLowerCase("uz");
  if (value.includes("1 hafta") || value.includes("haftada 1 marta")) return 7;
  if (value.includes("10 kun")) return 10;
  if (value.includes("1 oy") || value.includes("har oyda")) return 30;
  if (value.includes("60 kun")) return 60;
  if (value.includes("ikkinchi yarim yillik")) return 180;
  return null;
}

function patch62TomorrowTashkentDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value || "0");
  const month = Number(parts.find((part) => part.type === "month")?.value || "1");
  const day = Number(parts.find((part) => part.type === "day")?.value || "1");
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return String(next.getUTCFullYear()).padStart(4, "0") + "-" + String(next.getUTCMonth() + 1).padStart(2, "0") + "-" + String(next.getUTCDate()).padStart(2, "0");
}

export async function POST(request: Request) {
  let intent: UploadIntent | null = null;
  let uploadId = "";
  try {
    const session = await requireAppUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    uploadId = String(body.uploadId ?? "").trim();
    const uploadToken = String(body.uploadToken ?? "").trim();
    if (!uploadId || !uploadToken || uploadToken.length > 256) return Response.json({ error: "Yuklash tokeni yetishmaydi." }, { status: 400 });
    const uploadTokenHash = tokenDigest(uploadToken);

    const db = getKpiDatabase();
    const result = await db.pool.query(
      "SELECT payload FROM upload_intents WHERE id=$1 AND token=$2 AND expires_at>NOW() LIMIT 1",
      [uploadId, uploadTokenHash],
    );
    intent = (result.rows[0]?.payload as UploadIntent | undefined) ?? null;
    if (!intent) return Response.json({ error: "Yuklash tokeni noto‘g‘ri yoki eskirgan." }, { status: 403 });
    if (intent.uploadedBy !== session.email) { intent = null; throw new AccessError("Bu yuklash boshqa foydalanuvchiga tegishli.", 403); }
    if (!intent.uploadedAt) { intent = null; throw new AccessError("Fayl xavfsiz yuklash bosqichidan o‘tmagan.", 409); }

    await verifyStored(intent);
    const id = crypto.randomUUID();
    const storageProvider = "railway";

    if (intent.kind === "institution_order") {
      const existing = await db.pool.query("SELECT id FROM attachments WHERE institution_id = $1 AND source = 'institution_order' AND archived_at IS NULL LIMIT 1", [intent.institutionId]);
      if (existing.rowCount) {
        await cleanUp(uploadId, intent);
        return Response.json({ error: "BUYRUQ avval yuklangan. Qayta yuklash bloklangan." }, { status: 409 });
      }
      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO attachments (id, institution_id, round_day, criterion_id, filename, object_key, content_type, size_bytes, uploaded_by, source, responsible_name, responsible_phone, submission_date, storage_provider)
           VALUES ($1,$2,0,'__buyruq__',$3,$4,$5,$6,$7,'institution_order',$8,$9,$10::date,$11)`,
          [id, intent.institutionId, intent.filename, intent.objectKey, intent.contentType, intent.sizeBytes, intent.uploadedBy, intent.responsibleName, intent.responsiblePhone, intent.submissionDate, storageProvider],
        );
        await client.query(
          `INSERT INTO institution_responsibles (institution_id, responsible_name, responsible_phone, order_attachment_id, updated_at)
           VALUES ($1,$2,$3,$4,NOW())
           ON CONFLICT (institution_id) DO UPDATE SET responsible_name=EXCLUDED.responsible_name, responsible_phone=EXCLUDED.responsible_phone, order_attachment_id=EXCLUDED.order_attachment_id, updated_at=NOW()`,
          [intent.institutionId, intent.responsibleName, intent.responsiblePhone, id],
        );
        await client.query("INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'institution_order_uploaded','attachment',$2,$3)", [intent.uploadedBy, id, `${intent.filename} / RAILWAY / Mas’ul: ${intent.responsibleName}, ${intent.responsiblePhone}`]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
      await db.pool.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]).catch((error) => console.error("committed upload intent cleanup failed", error));
      return Response.json({ uploaded: true, id, storageProvider, attachment: { id, filename: intent.filename, sizeBytes: intent.sizeBytes } }, { status: 201 });
    }

    if (intent.kind === "institution_criterion") {
      /* PATCH50_INSTITUTION_UPLOAD_HOURS_COMPLETE */
      if (!institutionUploadWindowOpen()) { /* PATCH62_ALL_UPLOADS_08_19 */
        await cleanUp(uploadId, intent);
        intent = null;
        return Response.json(
          { error: "Fayl qabul qilish vaqti tugagan. Muassasalar uchun yuklash har kuni 08:00–19:00 (O‘zbekiston vaqti).", uploadWindow: "08:00-19:00" },
          { status: 403, headers: { "cache-control": "no-store" } },
        );
      }

      const criterionIntent = intent;
      if (session.role !== "institution" || session.institutionId !== criterionIntent.institutionId) {
        await cleanUp(uploadId, criterionIntent);
        intent = null;
        throw new AccessError("Bu mezon fayli boshqa muassasaga tegishli.", 403);
      }
      const criterion = criteria.find((item) => item.id === criterionIntent.criterionId);
      if (!criterion) {
        await cleanUp(uploadId, criterionIntent);
        intent = null;
        throw new AccessError("Mezon topilmadi.", 400);
      }

      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["criterion-upload:" + criterionIntent.institutionId + ":" + criterionIntent.criterionId]);

        let nextUploadDate = "";
        let recurrenceLocked = false;
        if (patch62IsDaily(criterion.deadline)) {
          const sameDay = await client.query(
            "SELECT created_at AS \"createdAt\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND archived_at IS NULL AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' AND (created_at AT TIME ZONE 'Asia/Tashkent')::date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date ORDER BY created_at DESC LIMIT 1",
            [criterionIntent.institutionId, criterionIntent.criterionId],
          );
          recurrenceLocked = sameDay.rows.length > 0;
          if (recurrenceLocked) nextUploadDate = patch62TomorrowTashkentDate();
        } else {
          const intervalDays = patch62RollingDays(criterion.deadline);
          if (intervalDays) {
            const recentResult = await client.query(
              "SELECT created_at AS \"createdAt\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND archived_at IS NULL AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' ORDER BY created_at DESC LIMIT 1",
              [criterionIntent.institutionId, criterionIntent.criterionId],
            );
            const lastCreatedAt = recentResult.rows[0]?.createdAt ? new Date(recentResult.rows[0].createdAt).getTime() : 0;
            const nextAt = lastCreatedAt ? lastCreatedAt + intervalDays * 24 * 60 * 60 * 1000 : 0;
            recurrenceLocked = Boolean(nextAt && Date.now() < nextAt);
            if (recurrenceLocked) nextUploadDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nextAt));
          }
        }

        if (recurrenceLocked) {
          await client.query("ROLLBACK");
          await client.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]);
          await deleteR2Object(criterionIntent.objectKey).catch(() => undefined);
          intent = null;
          const message = patch62IsDaily(criterion.deadline)
            ? "Bu mezon bugun allaqachon yuklangan. Keyingi yuklash: " + nextUploadDate + " soat 08:00 dan."
            : "Bu mezon uchun fayl " + criterion.deadline + " bo‘yicha qabul qilinadi. Keyingi yuklash: " + nextUploadDate + ".";
          return Response.json(
            { error: message, nextUploadDate, deadline: criterion.deadline },
            { status: 409, headers: { "cache-control": "no-store" } },
          );
        }

        await client.query(
          "INSERT INTO attachments (id, institution_id, round_day, criterion_id, filename, object_key, content_type, size_bytes, uploaded_by, source, responsible_name, responsible_phone, submission_date, storage_provider) VALUES ($1,$2,0,$3,$4,$5,$6,$7,$8,'institution',$9,$10,$11::date,$12)",
          [id, criterionIntent.institutionId, criterionIntent.criterionId, criterionIntent.filename, criterionIntent.objectKey, criterionIntent.contentType, criterionIntent.sizeBytes, criterionIntent.uploadedBy, criterionIntent.responsibleName, criterionIntent.responsiblePhone, criterionIntent.submissionDate, storageProvider],
        );
        await client.query(
          "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'institution_file_uploaded','attachment',$2,$3)",
          [criterionIntent.uploadedBy, id, criterionIntent.criterionId + " / " + criterionIntent.filename + " / RAILWAY / Mas’ul: " + criterionIntent.responsibleName + ", " + criterionIntent.responsiblePhone],
        );
        await client.query("COMMIT");
      } catch (error: unknown) {
        await client.query("ROLLBACK").catch(() => undefined);
        const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
        if (code === "23505") {
          await cleanUp(uploadId, criterionIntent);
          return Response.json({ error: "Bu mezon uchun joriy davr fayli allaqachon yuklangan. Keyingi ijro muddati kelganda qayta yuklash mumkin." }, { status: 409 });
        }
        throw error;
      } finally { client.release(); }
      await db.pool.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]).catch((error) => console.error("committed upload intent cleanup failed", error));
      return Response.json({ storageProvider, attachment: { id, filename: criterionIntent.filename, sizeBytes: criterionIntent.sizeBytes, dailyLocked: true, recurrenceLocked: true } }, { status: 201 });
    }

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO attachments (id, institution_id, round_day, criterion_id, filename, object_key, content_type, size_bytes, uploaded_by, source, storage_provider)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'evaluator',$10)`,
        [id, intent.institutionId, intent.roundDay, intent.criterionId, intent.filename, intent.objectKey, intent.contentType, intent.sizeBytes, intent.uploadedBy, storageProvider],
      );
      await client.query("INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'file_uploaded','attachment',$2,$3)", [intent.uploadedBy, id, `${intent.filename} / RAILWAY`]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    await db.pool.query("DELETE FROM upload_intents WHERE id=$1", [uploadId]).catch((error) => console.error("committed upload intent cleanup failed", error));
    return Response.json({ storageProvider, attachment: { id, filename: intent.filename, sizeBytes: intent.sizeBytes } }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (intent && uploadId) await cleanUp(uploadId, intent);
    console.error("upload complete failed", error);
    return Response.json({ error: "Fayl yozuvini saqlashda server xatoligi yuz berdi." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
