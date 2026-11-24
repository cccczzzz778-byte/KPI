import { getKpiDatabase } from "@/lib/netlify-db";

export type AuditEntry = {
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown>;
};

export async function ensureAuditTable() {
  const db = getKpiDatabase();
  await db.pool.query("CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, actor_email TEXT NOT NULL DEFAULT '', action TEXT NOT NULL, target_type TEXT NOT NULL DEFAULT '', target_id TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await db.pool.query("CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC)");
  await db.pool.query("CREATE INDEX IF NOT EXISTS audit_logs_actor_email_idx ON audit_logs (actor_email)");
}

export async function writeAuditLog(entry: AuditEntry) {
  await ensureAuditTable();
  const db = getKpiDatabase();
  const targetType = entry.targetType ?? entry.entityType ?? "";
  const targetId = entry.targetId ?? entry.entityId ?? "";
  const metadataText = entry.metadata ? " | " + JSON.stringify(entry.metadata) : "";
  const roleText = entry.actorRole ? " [" + entry.actorRole + "]" : "";
  const details = String(entry.details ?? "").trim() + roleText + metadataText;
  await db.pool.query("INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)", [entry.actorEmail ?? "", entry.action, targetType, targetId, details]);
}
