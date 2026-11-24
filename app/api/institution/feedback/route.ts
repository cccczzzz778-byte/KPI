import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

function requireInstitution(session: Awaited<ReturnType<typeof requireAppUser>>) {
  if (session.role !== "institution" || !session.institutionId) {
    throw new AccessError("Bu bo‘lim faqat muassasa kabineti uchun.", 403);
  }
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
    const sql = [
      'SELECT criterion_id AS "criterionId",',
      '       score,',
      '       note,',
      '       evaluator_name AS "evaluatorName",',
      "       TO_CHAR(updated_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS \"evaluationDate\",",
      '       updated_at AS "updatedAt"',
      '  FROM evaluations',
      ' WHERE institution_id = $1',
      ' ORDER BY updated_at DESC',
    ].join('\n');
    const result = await db.pool.query(sql, [session.institutionId]);

    const items = result.rows.map((row) => ({
      ...row,
      score: Number(row.score || 0),
      note: String(row.note || ""),
      evaluatorName: String(row.evaluatorName || ""),
      criterionTitle: criterionTitle(row.criterionId),
    }));

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return Response.json({ today, items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
