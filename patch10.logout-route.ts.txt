import { getKpiDatabase } from "@/lib/netlify-db";
import { sessionDigest, sessionTokenFromRequest } from "@/lib/server-auth";

export const runtime = "nodejs";

function clearSessionCookies(headers: Headers) {
  headers.append("set-cookie", "__Host-kpi_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Priority=High");
  headers.append("set-cookie", "kpi_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
}

async function invalidateSession(request: Request) {
  const rawToken = sessionTokenFromRequest(request);
  if (!rawToken || rawToken.length > 256) return;

  const db = getKpiDatabase();
  const tokenHash = sessionDigest(rawToken);
  const result = await db.pool.query("SELECT user_email FROM sessions WHERE token=$1 LIMIT 1", [tokenHash]);
  const email = String(result.rows[0]?.user_email || "");
  await db.pool.query("DELETE FROM sessions WHERE token=$1", [tokenHash]);
  if (email) {
    await db.pool.query(
      "INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,'logout','user',$1,'Tizimdan chiqdi')",
      [email],
    ).catch(() => undefined);
  }
}

export async function POST(request: Request) {
  try {
    await invalidateSession(request);
  } catch (error) {
    console.error("logout failed unexpectedly", error);
  }

  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
    "pragma": "no-cache",
  });
  clearSessionCookies(headers);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function GET(request: Request) {
  // Logout links in the existing UI navigate to this endpoint with GET.
  // Permit only user/top-level same-site navigation so third-party pages cannot force-log-out users.
  const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    return new Response("Forbidden", {
      status: 403,
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    await invalidateSession(request);
  } catch (error) {
    console.error("logout navigation failed unexpectedly", error);
  }

  // IMPORTANT: keep redirect relative. On Railway request.url may contain the
  // internal container host (localhost:8080), which would otherwise leak into
  // the browser and cause ERR_CONNECTION_REFUSED after logout.
  const headers = new Headers({
    location: "/login",
    "cache-control": "no-store, max-age=0",
    "pragma": "no-cache",
  });
  clearSessionCookies(headers);
  return new Response(null, { status: 303, headers });
}
