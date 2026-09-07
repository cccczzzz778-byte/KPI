import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { deleteR2Object, isR2Configured } from "@/lib/r2";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

function requireInstitution(session: Awaited<ReturnType<typeof requireAppUser>>) {
  if (session.role !== "institution" || !session.institutionId) {
    throw new AccessError("Bu bo‘lim faqat muassasa kabineti uchun.", 403);
  }
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const forwardedHost = (request.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || "";
  if (!host) throw new AccessError("So‘rov manbasi tekshirilmadi.", 403);
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AccessError("So‘rov manbasi noto‘g‘ri.", 403);
  }
  if (originHost !== host) throw new AccessError("Boshqa manbadan o‘chirishga ruxsat berilmaydi.", 403);
}

function criterionTitle(criterionId: unknown) {
  const id = String(criterionId || "");
  return criteria.find((item) => String(item.id) === id)?.title || id || "Mezon ko‘rsatilmagan";
}

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    requireInstitution(session);

    const db = getKpiDatabase();
    const result = await db.pool.query(
      `SELECT id,
              criterion_id AS "criterionId",
              round_day AS "roundDay",
              filename,
              content_type AS "contentType",
              size_bytes AS "sizeBytes",
              source,
              TO_CHAR(submission_date, 'YYYY-MM-DD') AS "submissionDate",
              created_at AS "createdAt"
         FROM attachments
        WHERE institution_id = $1
          AND source IN ('institution', 'institution_submission')
        ORDER BY created_at DESC
        LIMIT 5000`,
      [session.institutionId],
    );

    const items = result.rows.map((row) => ({
      ...row,
      criterionTitle: criterionTitle(row.criterionId),
    }));

    return Response.json({ items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireAppUser(request);
    requireInstitution(session);

    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id || id.length > 200) throw new AccessError("O‘chiriladigan fayl topilmadi.", 400);

    const db = getKpiDatabase();
    const result = await db.pool.query(
      `DELETE FROM attachments
        WHERE id = $1
          AND institution_id = $2
          AND source IN ('institution', 'institution_submission')
      RETURNING object_key AS "objectKey", filename, criterion_id AS "criterionId"`,
      [id, session.institutionId],
    );

    const deleted = result.rows[0];
    if (!deleted) throw new AccessError("Fayl topilmadi yoki uni o‘chirish huquqi yo‘q.", 404);

    const objectKey = String(deleted.objectKey || "").trim();
    if (objectKey && isR2Configured()) {
      deleteR2Object(objectKey).catch((error) => {
        console.error("Deleted attachment storage cleanup failed", { id, objectKey, error });
      });
    }

    return Response.json(
      {
        deleted: true,
        id,
        filename: deleted.filename,
        criterionId: deleted.criterionId,
        message: "Mezon fayli o‘chirildi. Endi qayta yuklashingiz mumkin.",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return accessErrorResponse(error);
  }
}
