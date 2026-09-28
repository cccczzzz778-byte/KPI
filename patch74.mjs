import fs from "node:fs";

function write(file, source) {
  const i = file.lastIndexOf("/");
  if (i >= 0) fs.mkdirSync(file.slice(0, i), { recursive: true });
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH74: " + file);
}

write("lib/audit-log.ts", String.raw`import { getKpiDatabase } from "@/lib/netlify-db";

export type AuditEntry = {
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

let ready = false;

export async function ensureAuditTable() {
  if (ready) return;
  const db = getKpiDatabase();
  await db.pool.query(\`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_email TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      old_value JSONB,
      new_value JSONB,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  \`);
  await db.pool.query("CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC)");
  await db.pool.query("CREATE INDEX IF NOT EXISTS audit_logs_actor_email_idx ON audit_logs (actor_email)");
  await db.pool.query("CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id)");
  ready = true;
}

export async function writeAuditLog(entry: AuditEntry) {
  await ensureAuditTable();
  const db = getKpiDatabase();
  await db.pool.query(
    \`INSERT INTO audit_logs
      (actor_email, actor_role, action, entity_type, entity_id, old_value, new_value, metadata)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)\`,
    [
      entry.actorEmail ?? null,
      entry.actorRole ?? null,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue),
      entry.newValue === undefined ? null : JSON.stringify(entry.newValue),
      entry.metadata === undefined ? null : JSON.stringify(entry.metadata),
    ],
  );
}
`);

write("app/api/admin/audit/route.ts", String.raw`import { ensureAuditTable } from "@/lib/audit-log";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role !== "admin") throw new AccessError("Audit jurnalini ko‘rish huquqi yo‘q.", 403);

    await ensureAuditTable();
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit") || "200");
    const limit = Math.max(1, Math.min(500, Number.isFinite(requested) ? requested : 200));

    const db = getKpiDatabase();
    const result = await db.pool.query(
      \`SELECT id,
              actor_email AS "actorEmail",
              actor_role AS "actorRole",
              action,
              entity_type AS "entityType",
              entity_id AS "entityId",
              old_value AS "oldValue",
              new_value AS "newValue",
              metadata,
              created_at AS "createdAt"
         FROM audit_logs
        ORDER BY created_at DESC
        LIMIT $1\`,
      [limit],
    );
    return Response.json({ items: result.rows }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
`);

write("app/api/health/route.ts", String.raw`import { getKpiDatabase } from "@/lib/netlify-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";

  try {
    const db = getKpiDatabase();
    await db.pool.query("SELECT 1");
  } catch {
    database = "error";
  }

  const ok = database === "ok";
  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      app: "buxoro-kpi",
      database,
      uptimeSeconds: Math.floor(process.uptime()),
      build: process.env.APP_BUILD_REV || null,
      checkedAt: new Date().toISOString(),
      responseMs: Date.now() - started,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
`);

write("app/api/admin/system-status/route.ts", String.raw`import { getKpiDatabase } from "@/lib/netlify-db";
import { isR2Configured } from "@/lib/r2";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (!["admin", "monitor"].includes(String(session.role))) {
      throw new AccessError("Tizim holatini ko‘rish huquqi yo‘q.", 403);
    }

    const checks = {
      app: true,
      database: false,
      cacheConfigured: Boolean(process.env.REDIS_URL),
      storageConfigured: isR2Configured(),
    };

    let databaseLatencyMs: number | null = null;
    try {
      const t0 = Date.now();
      const db = getKpiDatabase();
      await db.pool.query("SELECT 1");
      databaseLatencyMs = Date.now() - t0;
      checks.database = true;
    } catch {}

    return Response.json({
      checks,
      databaseLatencyMs,
      build: process.env.APP_BUILD_REV || null,
      uptimeSeconds: Math.floor(process.uptime()),
      checkedAt: new Date().toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
`);

console.log("PATCH74: Phase 1 audit groundwork + health + admin system status added.");
