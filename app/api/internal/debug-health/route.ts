import { getKpiDatabase } from "@/lib/netlify-db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getKpiDatabase();
    const result = await db.pool.query(`
      SELECT a.institution_id AS "institutionId",
             COALESCE(i.name, '') AS "institutionName",
             a.source,
             a.criterion_id AS "criterionId",
             a.round_day AS "roundDay",
             COUNT(*)::int AS count,
             MAX(a.created_at) AS "latestAt"
        FROM attachments a
        LEFT JOIN institutions i ON i.id = a.institution_id
       WHERE COALESCE(i.name, '') ILIKE '%vobkent%'
          OR COALESCE(i.name, '') ILIKE '%вобкент%'
       GROUP BY a.institution_id, i.name, a.source, a.criterion_id, a.round_day
       ORDER BY MAX(a.created_at) DESC
    `);
    const recent = await db.pool.query(`
      SELECT a.institution_id AS "institutionId",
             COALESCE(i.name, '') AS "institutionName",
             a.source,
             a.criterion_id AS "criterionId",
             a.round_day AS "roundDay",
             a.filename,
             a.created_at AS "createdAt"
        FROM attachments a
        LEFT JOIN institutions i ON i.id = a.institution_id
       ORDER BY a.created_at DESC
       LIMIT 20
    `);
    console.log('DEBUG_VOBKENT_COUNTS', JSON.stringify(result.rows));
    console.log('DEBUG_RECENT_ATTACHMENTS', JSON.stringify(recent.rows));
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error('DEBUG_HEALTH_FAILED', error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
