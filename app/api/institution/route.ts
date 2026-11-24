import { defaultInstitutions } from "@/lib/kpi-data";
import { accessErrorResponse, AccessError, requireAppUser } from "@/lib/server-auth";
import { getKpiDatabase } from "@/lib/netlify-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role !== "institution") throw new AccessError("Bu sahifa faqat muassasalar uchun.");
    if (!session.institutionId) throw new AccessError("Hisobga muassasa biriktirilmagan.");

    const db = getKpiDatabase();
    const [institutionResult, settingsResult, submissionsResult, nowResult, responsibleResult, orderResult] = await Promise.all([
      db.pool.query("SELECT id, name, district, type, active FROM institutions WHERE id = $1 LIMIT 1", [session.institutionId]),
      db.pool.query("SELECT value FROM system_settings WHERE key = 'institution_upload_date' LIMIT 1"),
      db.pool.query(
        `SELECT id, institution_id AS "institutionId", criterion_id AS "criterionId", filename,
                content_type AS "contentType", size_bytes AS "sizeBytes", uploaded_by AS "uploadedBy",
                source, responsible_name AS "responsibleName", responsible_phone AS "responsiblePhone",
                TO_CHAR(submission_date, 'YYYY-MM-DD') AS "submissionDate", created_at AS "createdAt"
           FROM attachments
          WHERE institution_id = $1 AND source = 'institution'
          ORDER BY created_at DESC`,
        [session.institutionId],
      ),
      db.pool.query(
        `SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS date,
                TO_CHAR(NOW() AT TIME ZONE 'Asia/Tashkent', 'HH24:MI') AS time`,
      ),
      db.pool.query(`SELECT responsible_name AS \"responsibleName\", responsible_phone AS \"responsiblePhone\", order_attachment_id AS \"orderAttachmentId\" FROM institution_responsibles WHERE institution_id = $1 LIMIT 1`, [session.institutionId]),
      db.pool.query(`SELECT id, filename, size_bytes AS \"sizeBytes\", TO_CHAR(submission_date, 'YYYY-MM-DD') AS \"submissionDate\", created_at AS \"createdAt\" FROM attachments WHERE institution_id = $1 AND source = 'institution_order' LIMIT 1`, [session.institutionId]),
    ]);

    const fallback = defaultInstitutions.find((item) => item.id === session.institutionId);
    const institution = institutionResult.rows[0] ?? (fallback ? { ...fallback, active: 1 } : null);
    if (!institution) throw new AccessError("Muassasa ma’lumoti topilmadi.", 404);

    const uploadDate = String(settingsResult.rows[0]?.value ?? "");
    const today = String(nowResult.rows[0]?.date ?? "");
    const currentTime = String(nowResult.rows[0]?.time ?? "");
    const orderIsOpen = Boolean(uploadDate && uploadDate === today && currentTime >= "08:00" && currentTime <= "19:00");
    const criteriaIsOpen = Boolean(currentTime >= "08:00" && currentTime <= "19:00");

    return Response.json({
      session,
      institution,
      uploadDate,
      openTime: "08:00",
      closeTime: "19:00",
      today,
      currentTime,
      orderIsOpen,
      criteriaIsOpen, /* PATCH60_UI_08_19 */
      submissions: submissionsResult.rows,
      responsible: responsibleResult.rows[0] ?? null,
      order: orderResult.rows[0] ?? null,
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
