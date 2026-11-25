import { createHash } from "node:crypto";
import { criteria, rounds } from "@/lib/kpi-data";
import { accessErrorResponse, AccessError, requireAppUser } from "@/lib/server-auth";
import { getKpiDatabase } from "@/lib/netlify-db";
import { isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const INSTITUTION_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "doc", "docx", "xls", "xlsx", "zip", "rar"]);

type UploadKind = "institution_order" | "institution_criterion" | "evaluator";
type UploadIntent = {
  version: 3;
  tokenHash: string;
  kind: UploadKind;
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

function extension(filename: string) { return filename.toLowerCase().split(".").pop() ?? ""; }
function safeFilename(filename: string) {
  return filename.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "fayl";
}
function makeToken() { return `${crypto.randomUUID()}-${crypto.randomUUID()}`; }
function tokenDigest(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }

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
  try {
    const session = await requireAppUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    const kind = String(body.kind ?? "") as UploadKind;
    const filename = safeFilename(String(body.filename ?? ""));
    const sizeBytes = Number(body.sizeBytes ?? 0);
    const contentType = String(body.contentType ?? "application/octet-stream").slice(0, 160) || "application/octet-stream";
    const criterionId = String(body.criterionId ?? "").trim();
    const criterion = criteria.find((item) => item.id === criterionId);

    if (!isR2Configured()) {
      return Response.json({ error: "Railway Storage Bucket hali ulanmagan." }, { status: 503 });
    }
    if (!filename || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) {
      return Response.json({ error: "Fayl hajmi 30 MB dan oshmasligi kerak." }, { status: 400 });
    }
    if (!( ["institution_order", "institution_criterion", "evaluator"] as string[]).includes(kind)) {
      return Response.json({ error: "Yuklash turi noto‘g‘ri." }, { status: 400 });
    }

    const db = getKpiDatabase();
    let institutionId = "";
    let roundDay = 0;
    let responsibleName = "";
    let responsiblePhone = "";
    let submissionDate = "";
    let objectKey = "";

    if (kind === "institution_order") {
      if (session.role !== "institution" || !session.institutionId) throw new AccessError("Bu amal faqat muassasa uchun.");
      if (!INSTITUTION_EXTENSIONS.has(extension(filename))) return Response.json({ error: "Faqat PDF, JPEG, Word, Excel, ZIP yoki RAR fayl yuklash mumkin." }, { status: 400 });
      responsibleName = String(body.responsibleName ?? "").trim();
      responsiblePhone = String(body.responsiblePhone ?? "").trim();
      if (!responsibleName || !responsiblePhone) return Response.json({ error: "Mas’ul F.I.Sh. va telefon raqamini kiriting." }, { status: 400 });
      institutionId = session.institutionId;
      const [settingsResult, nowResult, existingResult] = await Promise.all([
        db.pool.query("SELECT value FROM system_settings WHERE key = 'institution_upload_date' LIMIT 1"),
        db.pool.query(`SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS date, TO_CHAR(NOW() AT TIME ZONE 'Asia/Tashkent', 'HH24:MI') AS time`),
        db.pool.query("SELECT id FROM attachments WHERE institution_id = $1 AND source = 'institution_order' AND archived_at IS NULL LIMIT 1", [institutionId]),
      ]);
      if (existingResult.rowCount) return Response.json({ error: "BUYRUQ avval yuklangan. Qayta yuklash bloklangan." }, { status: 409 });
      const uploadDate = String(settingsResult.rows[0]?.value ?? "");
      const today = String(nowResult.rows[0]?.date ?? "");
      const time = String(nowResult.rows[0]?.time ?? "");
      if (!uploadDate) throw new AccessError("Administrator BUYRUQ yuklash sanasini hali belgilamagan.");
      if (uploadDate !== today || time < "08:00" || time > "19:00") throw new AccessError(`BUYRUQ faqat ${uploadDate} kuni soat 08:00–19:00 oralig‘ida yuklanadi.`);
      submissionDate = today;
      objectKey = `institution-orders/${institutionId}/${crypto.randomUUID()}-${filename}`;
    }

    if (kind === "institution_criterion") {
      /* PATCH50_INSTITUTION_UPLOAD_HOURS_PREPARE */
      if (!institutionUploadWindowOpen()) { /* PATCH60_ALL_UPLOADS_08_19 */
        return Response.json(
          { error: "Muassasalar faylni faqat soat 08:00 dan 19:00 gacha (O‘zbekiston vaqti) yuklay oladi.", uploadWindow: "08:00-19:00" },
          { status: 403, headers: { "cache-control": "no-store" } },
        );
      }
      if (session.role !== "institution" || !session.institutionId) throw new AccessError("Bu amal faqat muassasa uchun.");
      if (!criterion) return Response.json({ error: "Mezon topilmadi." }, { status: 400 });
      if (!INSTITUTION_EXTENSIONS.has(extension(filename))) return Response.json({ error: "Faqat PDF, JPEG, Word, Excel, ZIP yoki RAR fayl yuklash mumkin." }, { status: 400 });
      institutionId = session.institutionId;
      const [responsibleResult, nowResult] = await Promise.all([
        db.pool.query("SELECT responsible_name AS \"responsibleName\", responsible_phone AS \"responsiblePhone\" FROM institution_responsibles WHERE institution_id = $1 LIMIT 1", [institutionId]),
        db.pool.query(`SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS date, TO_CHAR(NOW() AT TIME ZONE 'Asia/Tashkent', 'HH24:MI') AS time`),
      ]);
      const responsible = responsibleResult.rows[0] as { responsibleName?: string; responsiblePhone?: string } | undefined;
      if (!responsible?.responsibleName || !responsible?.responsiblePhone) throw new AccessError("Avval BUYRUQni mas’ul F.I.Sh. va telefon bilan yuklang.");
      responsibleName = responsible.responsibleName;
      responsiblePhone = responsible.responsiblePhone;
      const today = String(nowResult.rows[0]?.date ?? "");
      const time = String(nowResult.rows[0]?.time ?? "");
      if (time < "08:00" || time > "19:00") throw new AccessError("Mezon fayllari har kuni faqat 08:00–19:00 oralig‘ida yuklanadi.");
      const existing = await db.pool.query(
        `SELECT id FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source = 'institution' AND submission_date = $3::date AND archived_at IS NULL LIMIT 1`,
        [institutionId, criterionId, today],
      );
      if (existing.rowCount) return Response.json({ error: "Bu mezon uchun bugungi fayl allaqachon yuklangan. Ertaga yana 1 marta yuklash mumkin." }, { status: 409 });
      submissionDate = today;
      objectKey = `institution-submissions/${institutionId}/${today}/${criterionId}/${crypto.randomUUID()}-${filename}`;
    }

    if (kind === "evaluator") {
      if (session.role !== "admin" && session.role !== "evaluator") throw new AccessError("Bu amal baholovchi yoki administrator uchun.");
      if (!criterion) return Response.json({ error: "Mezon topilmadi." }, { status: 400 });
      if (!INSTITUTION_EXTENSIONS.has(extension(filename))) return Response.json({ error: "Faqat PDF, JPEG, Word, Excel, ZIP yoki RAR fayl yuklash mumkin." }, { status: 400 });
      institutionId = String(body.institutionId ?? "").trim();
      roundDay = Number(body.roundDay ?? 0);
      if (!institutionId) return Response.json({ error: "Muassasa ma’lumoti yetishmaydi." }, { status: 400 });
      if (!(rounds as readonly number[]).includes(roundDay)) return Response.json({ error: "Baholash bosqichi noto‘g‘ri." }, { status: 400 });
      if (session.role === "evaluator" && criterion.commission !== session.commission) throw new AccessError("Siz faqat biriktirilgan yo‘nalishga fayl yuklay olasiz.");
      objectKey = `evidence/${institutionId}/${roundDay}/${criterionId}/${crypto.randomUUID()}-${filename}`;
    }

    /* PATCH62_RECURRENCE_PREPARE */
    if (kind === "institution_criterion") {
      /* PATCH50_INSTITUTION_UPLOAD_HOURS_PREPARE */
      if (!institutionUploadWindowOpen()) { /* PATCH62_ALL_UPLOADS_08_19 */
        return Response.json(
          { error: "Muassasalar faylni faqat soat 08:00 dan 19:00 gacha (O‘zbekiston vaqti) yuklay oladi.", uploadWindow: "08:00-19:00" },
          { status: 403, headers: { "cache-control": "no-store" } },
        );
      }

      const recurrenceCriterionId = String(body.criterionId ?? "").trim();
      const recurrenceInstitutionId = String(session.institutionId ?? "").trim();
      const recurrenceCriterion = criteria.find((item) => item.id === recurrenceCriterionId);
      if (!recurrenceCriterion || !recurrenceInstitutionId) {
        return Response.json({ error: "Muassasa yoki mezon topilmadi." }, { status: 400 });
      }

      const recurrenceDb = getKpiDatabase();
      if (patch62IsDaily(recurrenceCriterion.deadline)) {
        const sameDay = await recurrenceDb.pool.query(
          "SELECT created_at AS \"createdAt\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND archived_at IS NULL AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' AND (created_at AT TIME ZONE 'Asia/Tashkent')::date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date ORDER BY created_at DESC LIMIT 1",
          [recurrenceInstitutionId, recurrenceCriterionId],
        );
        if (sameDay.rows.length) {
          const nextDate = patch62TomorrowTashkentDate();
          return Response.json(
            { error: "Bu mezon bugun allaqachon yuklangan. Keyingi yuklash: " + nextDate + " soat 08:00 dan.", nextUploadDate: nextDate, deadline: recurrenceCriterion.deadline },
            { status: 409, headers: { "cache-control": "no-store" } },
          );
        }
      } else {
        const intervalDays = patch62RollingDays(recurrenceCriterion.deadline);
        if (intervalDays) {
          const recentResult = await recurrenceDb.pool.query(
            "SELECT created_at AS \"createdAt\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') AND archived_at IS NULL AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14' ORDER BY created_at DESC LIMIT 1",
            [recurrenceInstitutionId, recurrenceCriterionId],
          );
          const lastCreatedAt = recentResult.rows[0]?.createdAt ? new Date(recentResult.rows[0].createdAt).getTime() : 0;
          const nextAt = lastCreatedAt ? lastCreatedAt + intervalDays * 24 * 60 * 60 * 1000 : 0;
          if (nextAt && Date.now() < nextAt) {
            const nextDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nextAt));
            return Response.json(
              { error: "Bu mezon uchun fayl " + recurrenceCriterion.deadline + " bo‘yicha qabul qilinadi. Keyingi yuklash: " + nextDate + ".", nextUploadDate: nextDate, deadline: recurrenceCriterion.deadline },
              { status: 409, headers: { "cache-control": "no-store" } },
            );
          }
        }
      }
    }
    const uploadId = crypto.randomUUID();
    const uploadToken = makeToken();
    const uploadTokenHash = tokenDigest(uploadToken);
    const intent: UploadIntent = {
      version: 3,
      tokenHash: uploadTokenHash,
      kind,
      storageProvider: "railway",
      objectKey,
      filename,
      contentType,
      sizeBytes,
      institutionId,
      criterionId: kind === "institution_order" ? "__buyruq__" : criterionId,
      roundDay,
      responsibleName,
      responsiblePhone,
      submissionDate,
      uploadedBy: session.email,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    await db.pool.query("DELETE FROM upload_intents WHERE expires_at <= NOW()");
    await db.pool.query(
      "INSERT INTO upload_intents (id, token, payload, expires_at) VALUES ($1,$2,$3::jsonb,$4)",
      [uploadId, uploadTokenHash, JSON.stringify(intent), new Date(intent.expiresAt)],
    );

    const uploadUrl = `/api/uploads/blob?uploadId=${encodeURIComponent(uploadId)}`;
    return Response.json({
      uploadId,
      uploadToken,
      uploadUrl,
      uploadHeaders: { "content-type": contentType, "x-kpi-upload-token": uploadToken },
      storageProvider: "railway",
      maxBytes: MAX_FILE_SIZE,
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
