import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { accessErrorResponse, AccessError, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role !== "institution" || !session.institutionId) {
      throw new AccessError("Bu bo‘lim faqat muassasa kabineti uchun.", 403);
    }

    const db = getKpiDatabase();
    const result = await db.pool.query(
      `SELECT id,
              criterion_id AS "criterionId",
              round_day AS "roundDay",
              filename,
              content_type AS "contentType",
              size_bytes AS "sizeBytes",
              source,
              responsible_name AS "responsibleName",
              responsible_phone AS "responsiblePhone",
              TO_CHAR(submission_date, 'YYYY-MM-DD') AS "submissionDate",
              created_at AS "createdAt"
         FROM attachments
        WHERE institution_id = $1
          AND source IN ('institution_submission', 'institution_order')
        ORDER BY created_at DESC
        LIMIT 5000`,
      [session.institutionId],
    );

    const items = result.rows.map((row) => {
      const criterion = criteria.find((item) => item.id === row.criterionId);
      const criterionTitle = row.source === "institution_order"
        ? "BUYRUQ (chora-tadbir)"
        : criterion?.title || row.criterionId || "Mezon ko‘rsatilmagan";
      return { ...row, criterionTitle };
    });

    return Response.json({ items });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
