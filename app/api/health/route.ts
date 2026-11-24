import { getKpiDatabase } from "@/lib/netlify-db";

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
      build: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.APP_BUILD_REV || null,
      checkedAt: new Date().toISOString(),
      responseMs: Date.now() - started,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
