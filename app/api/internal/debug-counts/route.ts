import { getKpiDatabase } from "@/lib/netlify-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const expected = String(process.env.DEBUG_COUNTS_TOKEN || "");
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!expected || token !== expected) return Response.json({ error: "Not found" }, { status: 404 });

  const db = getKpiDatabase();
  const grouped = await db.pool.query(`
    SELECT a.institution_id AS "institutionId",
           COALESCE(i.name, '') AS "institutionName",
           a.source,
           a.criterion_id AS "criterionId",
           a.round_day AS "roundDay",
           COUNT(*)::int AS count,
           MAX(a.created_at) AS "latestAt"
      FROM attachments a
      LEFT JOIN institutions i ON i.id = a.institution_id
     GROUP BY a.institution_id, i.name, a.source, a.criterion_id, a.round_day
     ORDER BY MAX(a.created_at) DESC
  `);

  const latest = await db.pool.query(`
    SELECT a.id,
           a.institution_id AS "institutionId",
           COALESCE(i.name, '') AS "institutionName",
           a.source,
           a.criterion_id AS "criterionId",
           a.round_day AS "roundDay",
           a.filename,
           a.created_at AS "createdAt"
      FROM attachments a
      LEFT JOIN institutions i ON i.id = a.institution_id
     ORDER BY a.created_at DESC
     LIMIT 50
  `);

  const vobkent = grouped.rows.filter((row) => /vobkent|вобкент/i.test(String(row.institutionName || "")));
  return Response.json({ vobkent, grouped: grouped.rows, latest: latest.rows }, { headers: { "cache-control": "no-store" } });
}
