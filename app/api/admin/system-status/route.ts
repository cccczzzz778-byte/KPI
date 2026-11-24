import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getKpiDatabase } from "@/lib/netlify-db";
import { isR2Configured } from "@/lib/r2";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function storageConfig() {
  const endpoint = process.env.S3_ENDPOINT || process.env.ENDPOINT || "";
  const region = process.env.S3_REGION || process.env.REGION || "auto";
  const bucket = process.env.S3_BUCKET || process.env.BUCKET || "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY || "";
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

async function latestBackup() {
  const cfg = storageConfig();
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) return { status: "not_configured", lastBackupAt: null, key: null, sizeBytes: null };
  try {
    const s3 = new S3Client({ endpoint: cfg.endpoint, region: cfg.region, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }, forcePathStyle: true });
    let token: string | undefined;
    let latest: { Key?: string; LastModified?: Date; Size?: number } | null = null;
    let pages = 0;
    do {
      const result = await s3.send(new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: "db-backups/", ContinuationToken: token, MaxKeys: 1000 }));
      for (const item of result.Contents || []) {
        if (!item.LastModified) continue;
        if (!latest?.LastModified || item.LastModified.getTime() > latest.LastModified.getTime()) latest = item;
      }
      token = result.IsTruncated ? result.NextContinuationToken : undefined;
      pages += 1;
    } while (token && pages < 5);
    return { status: latest ? "ok" : "empty", lastBackupAt: latest?.LastModified?.toISOString() || null, key: latest?.Key || null, sizeBytes: latest?.Size ?? null };
  } catch {
    return { status: "error", lastBackupAt: null, key: null, sizeBytes: null };
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role !== "admin") throw new AccessError("Tizim nazoratini ko‘rish huquqi yo‘q.", 403);
    const started = Date.now();
    const db = getKpiDatabase();
    await db.pool.query("SELECT 1");
    const databaseLatencyMs = Date.now() - started;
    const [usersResult, institutionsResult, sessionsResult, auditResult, activeResult, backup] = await Promise.all([
      db.pool.query("SELECT COUNT(*)::int AS count FROM users WHERE active=1"),
      db.pool.query("SELECT COUNT(*)::int AS count FROM institutions WHERE active=1"),
      db.pool.query("SELECT COUNT(DISTINCT user_email)::int AS count FROM sessions WHERE expires_at>NOW() AND last_seen_at>=NOW()-INTERVAL '15 minutes'"),
      db.pool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE created_at>=NOW()-INTERVAL '24 hours'"),
      db.pool.query("SELECT s.user_email AS email, COALESCE(u.name,'') AS name, COALESCE(u.role,'') AS role, MAX(s.last_seen_at) AS \"lastSeenAt\" FROM sessions s LEFT JOIN users u ON u.email=s.user_email WHERE s.expires_at>NOW() AND s.last_seen_at>=NOW()-INTERVAL '15 minutes' GROUP BY s.user_email,u.name,u.role ORDER BY MAX(s.last_seen_at) DESC LIMIT 50"),
      latestBackup(),
    ]);
    return Response.json({
      checks: { app: true, database: true, cacheConfigured: Boolean(process.env.REDIS_URL), storageConfigured: isR2Configured() },
      databaseLatencyMs,
      uptimeSeconds: Math.floor(process.uptime()),
      build: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.APP_BUILD_REV || null,
      checkedAt: new Date().toISOString(),
      counts: { activeUsers: Number(usersResult.rows[0]?.count || 0), institutions: Number(institutionsResult.rows[0]?.count || 0), onlineNow: Number(sessionsResult.rows[0]?.count || 0), audit24h: Number(auditResult.rows[0]?.count || 0) },
      activeSessions: activeResult.rows,
      backup,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
