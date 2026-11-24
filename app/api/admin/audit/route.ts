import { ensureAuditTable } from "@/lib/audit-log";
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
    const result = await db.pool.query("SELECT id, actor_email AS \"actorEmail\", action, target_type AS \"targetType\", target_id AS \"targetId\", details, created_at AS \"createdAt\" FROM audit_logs ORDER BY created_at DESC LIMIT $1", [limit]);
    return Response.json({ items: result.rows }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
