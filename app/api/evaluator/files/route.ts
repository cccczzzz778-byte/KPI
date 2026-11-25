import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

function commissionKey(value: unknown) {
  const raw = String(value || "").trim().toLocaleLowerCase("uz");
  const normalized = raw
    .replace(/[ʻʼ’‘\`´']/g, "")
    .replace(/[^a-z0-9а-яёқғҳў]+/gi, " " )
    .replace(/\s+/g, " " )
    .trim();
  if (!normalized) return "";
  if (normalized === "infra" || normalized.includes("raqam") || normalized.includes("digital") || normalized.includes("it infratuz")) return "digital";
  if (normalized === "moliya" || normalized.includes("moliya") || normalized.includes("finance") || normalized.includes("xojal") || normalized.includes("xo jal")) return "finance";
  if (normalized === "sifat" || normalized.includes("statsionar") || normalized.includes("stotsionar") || normalized.includes("stationar")) return "stationary";
  if (normalized === "profil" || normalized.includes("birlamchi") || normalized.includes("primary")) return "primary";
  if (normalized === "ijro" || normalized.includes("ijro") || normalized.includes("kadr") || normalized.includes("murojaat")) return "exec";
  return normalized.replace(/\s+/g, "");
}


export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role !== "evaluator") throw new AccessError("Bu bo‘lim faqat baholovchi uchun.", 403);

    const url = new URL(request.url);
    const institutionId = String(url.searchParams.get("institutionId") || "").trim();
    if (!institutionId) throw new AccessError("Muassasa aniqlanmadi.", 400);

    const db = getKpiDatabase();
    const institutionResult = await db.pool.query(
      "SELECT id, name FROM institutions WHERE id=$1 AND active=1 LIMIT 1",
      [institutionId],
    );
    const institution = institutionResult.rows[0];
    if (!institution) throw new AccessError("Muassasa topilmadi.", 404);

    const result = await db.pool.query(
      `SELECT id,
              institution_id AS "institutionId",
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
        WHERE institution_id=$1
          AND archived_at IS NULL
          AND source IN ('institution_submission', 'institution_order')
        ORDER BY created_at DESC
        LIMIT 1000`,
      [institutionId],
    );

    const items = result.rows.flatMap((row) => {
      if (row.source === "institution_order") {
        return [{
          ...row,
          institutionName: String(institution.name),
          criterionTitle: "BUYRUQ (chora-tadbir)",
          sourceLabel: "BUYRUQ",
        }];
      }
      const criterion = criteria.find((item) => item.id === row.criterionId);
      if (!criterion || commissionKey(criterion.commission) !== commissionKey(session.commission)) return [];
      return [{
        ...row,
        institutionName: String(institution.name),
        criterionTitle: criterion.title,
        sourceLabel: "Muassasa mezon fayli",
      }];
    });

    return Response.json({ items, institution: { id: String(institution.id), name: String(institution.name) } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
