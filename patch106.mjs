import fs from "node:fs";

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`PATCH106: missing ${file}`);
  return fs.readFileSync(file, "utf8");
}
function write(file, source) {
  fs.writeFileSync(file, source, "utf8");
  console.log(`PATCH106: patched ${file}`);
}

// 1) Block new logins for every role except admin.
{
  const file = "app/api/auth/login/route.ts";
  let s = read(file);
  if (!s.includes("PATCH106_ADMIN_ONLY_LOGIN")) {
    const anchor = `    if (!valid) {\n      await Promise.all(rules.map((rule) => recordFailure(db, rule)));\n      await securityEvent(db, \"login_failed\", identifierHash, ipHash, { reason: \"invalid_credentials\" });\n      return Response.json({ error: \"Login yoki parol noto‘g‘ri.\" }, { status: 401, headers: { \"cache-control\": \"no-store\" } });\n    }`;
    if (!s.includes(anchor)) throw new Error("PATCH106: login valid anchor not found");
    const guard = `${anchor}\n\n    // PATCH106_ADMIN_ONLY_LOGIN\n    if (String(user!.role || \"\") !== \"admin\") {\n      await db.pool.query(\"DELETE FROM sessions WHERE user_email=$1\", [user!.email]).catch(() => undefined);\n      await securityEvent(db, \"login_blocked_non_admin\", identifierHash, ipHash, { role: user!.role });\n      return Response.json(\n        { error: \"Tizim vaqtincha faqat administrator uchun ochiq.\", code: \"ADMIN_ONLY\" },\n        { status: 403, headers: { \"cache-control\": \"no-store\" } },\n      );\n    }`;
    s = s.replace(anchor, guard);
  }
  write(file, s);
}

// 2) Invalidate/block already-open non-admin sessions across protected KPI APIs.
{
  const file = "lib/server-auth.ts";
  let s = read(file);
  if (!s.includes("PATCH106_ADMIN_ONLY_SESSION")) {
    const anchor = `  if (!existing.active) throw new AccessError(\"Foydalanuvchi hisobi bloklangan.\", 403);`;
    if (!s.includes(anchor)) throw new Error("PATCH106: server-auth active anchor not found");
    const guard = `${anchor}\n\n  // PATCH106_ADMIN_ONLY_SESSION\n  if (String(existing.role || \"\") !== \"admin\") {\n    await db.pool.query(\"DELETE FROM sessions WHERE token=$1\", [tokenHash]).catch(() => undefined);\n    throw new AccessError(\"Tizim vaqtincha faqat administrator uchun ochiq.\", 403);\n  }`;
    s = s.replace(anchor, guard);
  }
  write(file, s);
}

// 3) Dashboard itself is admin-only, including anonymous/public access.
{
  const file = "app/api/dashboard/route.ts";
  let s = read(file);
  if (!s.includes("PATCH106_DASHBOARD_ADMIN_ONLY")) {
    const block = /\n\s*\/\/ PATCH105:[\s\S]*?\n\s*const institutionPromise =/;
    if (!block.test(s)) throw new Error("PATCH106: dashboard PATCH105 guard block not found");
    const replacement = `\n\n    // PATCH106_DASHBOARD_ADMIN_ONLY\n    const dashboardSessionToken = sessionTokenFromRequest(request);\n    if (!dashboardSessionToken) {\n      return Response.json(\n        { error: \"Dashboard faqat administrator uchun ochiq.\", code: \"ADMIN_ONLY\" },\n        { status: 403, headers: { \"cache-control\": \"no-store\" } },\n      );\n    }\n    const dashboardSession = await db.pool.query(\n      \`SELECT u.role\n         FROM sessions s\n         JOIN users u ON u.email = s.user_email\n        WHERE s.token = $1\n          AND s.expires_at > NOW()\n          AND u.active = 1\n        LIMIT 1\`,\n      [sessionDigest(dashboardSessionToken)],\n    );\n    if (String(dashboardSession.rows[0]?.role || \"\") !== \"admin\") {\n      if (dashboardSession.rows[0]) {\n        await db.pool.query(\"DELETE FROM sessions WHERE token=$1\", [sessionDigest(dashboardSessionToken)]).catch(() => undefined);\n      }\n      return Response.json(\n        { error: \"Dashboard faqat administrator uchun ochiq.\", code: \"ADMIN_ONLY\" },\n        { status: 403, headers: { \"cache-control\": \"no-store\" } },\n      );\n    }\n\n    const institutionPromise =`;
    s = s.replace(block, replacement);
  }
  write(file, s);
}

console.log("PATCH106: KPI access locked to admin only; evaluator, monitor, institution and anonymous dashboard access are blocked.");
