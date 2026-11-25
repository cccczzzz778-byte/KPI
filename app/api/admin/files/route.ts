import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { buildAdminFileFilter } from "@/lib/admin-file-filters";
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
    const sort = clean(url.searchParams.get("sort")) === "oldest" ? "oldest" : "newest";
    const limit = Math.min(200, Math.max(20, Number(url.searchParams.get("limit") || 50)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
    const { whereSql, params } = buildAdminFileFilter(url);

    const db = getKpiDatabase();
    const [statsResult, todayResult, institutionsResult] = await Promise.all([
      db.pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(DISTINCT a.institution_id)::int AS institutions,
                COALESCE(SUM(a.size_bytes), 0)::bigint AS bytes,
                COUNT(*) FILTER (WHERE a.archived_at IS NOT NULL)::int AS archived
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
              a.created_at AS "createdAt",
              a.archived_at AS "archivedAt"
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
        archived: Number(statsRow.archived || 0),
      },
      institutions: institutionsResult.rows.map((row) => ({ id: String(row.id), name: String(row.name) })),
      criteria: criteria.map((item) => ({ id: item.id, title: item.title, commission: item.commission })),
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

// Arxivga o'tkazish / arxivdan chiqarish (faqat administrator).
// { action: "archive_before", before: "YYYY-MM-DD" } — shu sanagacha (sana kirmaydi) yuklangan barcha faol fayllar
// { action: "archive" | "restore", id: "<fayl id>" } — bitta fayl
export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const payload = await request.json().catch(() => ({})) as { action?: string; before?: string; id?: string };
    const db = getKpiDatabase();

    if (payload.action === "archive_before") {
      const before = clean(payload.before ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) throw new AccessError("Sana noto‘g‘ri.", 400);
      const result = await db.pool.query(
        `UPDATE attachments
            SET archived_at = NOW()
          WHERE archived_at IS NULL
            AND created_at < ($1::date)::timestamp AT TIME ZONE 'Asia/Tashkent'`,
        [before],
      );
      const count = result.rowCount ?? 0;
      await db.pool.query(
        "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'archive_files','attachments',$2,$3)",
        [session.email, before, `${count} ta fayl ${before} sanagacha arxivga o‘tkazildi`],
      ).catch(() => undefined);
      return Response.json({ ok: true, count });
    }

    if (payload.action === "archive" || payload.action === "restore") {
      const id = clean(payload.id ?? "");
      if (!id) throw new AccessError("Fayl aniqlanmadi.", 400);
      const result = await db.pool.query(
        payload.action === "archive"
          ? "UPDATE attachments SET archived_at = NOW() WHERE id = $1 AND archived_at IS NULL"
          : "UPDATE attachments SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL",
        [id],
      );
      await db.pool.query(
        "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,$2,'attachment',$3,$4)",
        [session.email, payload.action === "archive" ? "archive_file" : "restore_file", id, payload.action === "archive" ? "Fayl arxivga o‘tkazildi" : "Fayl arxivdan chiqarildi"],
      ).catch(() => undefined);
      return Response.json({ ok: true, count: result.rowCount ?? 0 });
    }

    throw new AccessError("Amal noto‘g‘ri.", 400);
  } catch (error) {
    return accessErrorResponse(error);
  }
}
