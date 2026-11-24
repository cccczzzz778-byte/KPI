import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

function clean(value: string | null) {
  return String(value ?? "").trim();
}

async function requireAdmin(request: Request) {
  const session = await requireAppUser(request);
  if (session.role !== "admin") throw new AccessError("Bu bo‘lim faqat administrator uchun.", 403);
  return session;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q")).toLocaleLowerCase("uz");
    const institutionId = clean(url.searchParams.get("institutionId"));
    const criterionId = clean(url.searchParams.get("criterionId"));
    const from = clean(url.searchParams.get("from"));
    const to = clean(url.searchParams.get("to"));
    const kind = clean(url.searchParams.get("kind"));
    const sort = clean(url.searchParams.get("sort")) === "oldest" ? "oldest" : "newest";
    const limit = Math.min(200, Math.max(20, Number(url.searchParams.get("limit") || 50)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (q) {
      const p = add(`%${q}%`);
      const titleIds = criteria
        .filter((item) => String(item.title || "").toLocaleLowerCase("uz").includes(q))
        .map((item) => item.id);
      if (titleIds.length) {
        const ids = add(titleIds);
        where.push(`(LOWER(COALESCE(a.filename, '')) LIKE ${p} OR LOWER(COALESCE(i.name, '')) LIKE ${p} OR LOWER(COALESCE(a.criterion_id, '')) LIKE ${p} OR a.criterion_id = ANY(${ids}::text[]))`);
      } else {
        where.push(`(LOWER(COALESCE(a.filename, '')) LIKE ${p} OR LOWER(COALESCE(i.name, '')) LIKE ${p} OR LOWER(COALESCE(a.criterion_id, '')) LIKE ${p})`);
      }
    }
    if (institutionId) where.push(`a.institution_id = ${add(institutionId)}`);
    if (criterionId) where.push(`a.criterion_id = ${add(criterionId)}`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      where.push(`COALESCE(a.submission_date, DATE(a.created_at AT TIME ZONE 'Asia/Tashkent')) >= ${add(from)}::date`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      where.push(`COALESCE(a.submission_date, DATE(a.created_at AT TIME ZONE 'Asia/Tashkent')) <= ${add(to)}::date`);
    }
    if (kind === "order") where.push("a.source = 'institution_order'");
    else if (kind === "criterion") where.push("a.source = 'institution_submission'");
    else if (kind === "other") where.push("a.source NOT IN ('institution_order', 'institution_submission')");

    const db = getKpiDatabase();
    const whereSql = where.join(" AND ");
    const [statsResult, todayResult, institutionsResult] = await Promise.all([
      db.pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(DISTINCT a.institution_id)::int AS institutions,
                COALESCE(SUM(a.size_bytes), 0)::bigint AS bytes
           FROM attachments a
           LEFT JOIN institutions i ON i.id = a.institution_id
          WHERE ${whereSql}`,
        params,
      ),
      db.pool.query(
        `SELECT COUNT(*)::int AS total
           FROM attachments a
          WHERE COALESCE(a.submission_date, DATE(a.created_at AT TIME ZONE 'Asia/Tashkent')) = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tashkent')::date`,
      ),
      db.pool.query("SELECT id, name FROM institutions WHERE active=1 ORDER BY name ASC"),
    ]);

    const rowParams = [...params, limit, offset];
    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;
    const orderSql = sort === "oldest" ? "a.created_at ASC" : "a.created_at DESC";
    const result = await db.pool.query(
      `SELECT a.id,
              a.institution_id AS "institutionId",
              COALESCE(i.name, a.institution_id) AS "institutionName",
              a.criterion_id AS "criterionId",
              a.round_day AS "roundDay",
              a.filename,
              a.content_type AS "contentType",
              a.size_bytes AS "sizeBytes",
              a.source,
              a.responsible_name AS "responsibleName",
              a.responsible_phone AS "responsiblePhone",
              TO_CHAR(a.submission_date, 'YYYY-MM-DD') AS "submissionDate",
              a.created_at AS "createdAt"
         FROM attachments a
         LEFT JOIN institutions i ON i.id = a.institution_id
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${limitParam} OFFSET ${offsetParam}`,
      rowParams,
    );

    const items = result.rows.map((row) => {
      const criterion = criteria.find((item) => item.id === row.criterionId);
      const filename = String(row.filename || "Fayl");
      const extension = filename.includes(".") ? filename.split(".").pop()?.toUpperCase() || "FAYL" : "FAYL";
      return {
        ...row,
        extension,
        criterionTitle: row.source === "institution_order"
          ? "BUYRUQ (chora-tadbir)"
          : criterion?.title || row.criterionId || "Mezon ko‘rsatilmagan",
        sourceLabel: row.source === "institution_order"
          ? "BUYRUQ"
          : row.source === "institution_submission"
            ? "Muassasa mezon fayli"
            : "Baholash asosi",
      };
    });

    const statsRow = statsResult.rows[0] || {};
    return Response.json({
      items,
      total: Number(statsRow.total || 0),
      stats: {
        total: Number(statsRow.total || 0),
        institutions: Number(statsRow.institutions || 0),
        bytes: Number(statsRow.bytes || 0),
        today: Number(todayResult.rows[0]?.total || 0),
      },
      institutions: institutionsResult.rows.map((row) => ({ id: String(row.id), name: String(row.name) })),
      criteria: criteria.map((item) => ({ id: item.id, title: item.title, commission: item.commission })),
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
