import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : undefined });

try {
  const bySource = await pool.query(`
    SELECT i.id,
           i.name,
           a.source,
           COUNT(*)::int AS count
      FROM attachments a
      LEFT JOIN institutions i ON i.id = a.institution_id
     GROUP BY i.id, i.name, a.source
     ORDER BY i.name NULLS LAST, a.source
  `);

  console.log('DEBUG_FILE_COUNTS_BEGIN');
  for (const row of bySource.rows) {
    if (Number(row.count || 0) > 0) {
      console.log(JSON.stringify({ institutionId: row.id, institutionName: row.name, source: row.source, count: Number(row.count || 0) }));
    }
  }

  const latest = await pool.query(`
    SELECT a.institution_id AS "institutionId",
           i.name AS "institutionName",
           a.source,
           a.criterion_id AS "criterionId",
           a.round_day AS "roundDay",
           a.filename,
           a.created_at AS "createdAt"
      FROM attachments a
      LEFT JOIN institutions i ON i.id = a.institution_id
     ORDER BY a.created_at DESC
     LIMIT 30
  `);
  console.log('DEBUG_LATEST_ATTACHMENTS_BEGIN');
  for (const row of latest.rows) console.log(JSON.stringify(row));
  console.log('DEBUG_FILE_COUNTS_END');
} finally {
  await pool.end();
}
