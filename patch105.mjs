import fs from "node:fs";

const apiFile = "app/api/dashboard/route.ts";
const uiFile = "components/public-dashboard.tsx";

if (!fs.existsSync(apiFile)) throw new Error("PATCH105: dashboard API missing");
if (!fs.existsSync(uiFile)) throw new Error("PATCH105: public dashboard missing");

let api = fs.readFileSync(apiFile, "utf8");

if (!api.includes('sessionTokenFromRequest')) {
  api = api.replace(
    'import { getKpiDatabase } from "@/lib/netlify-db";',
    'import { getKpiDatabase } from "@/lib/netlify-db";\nimport { sessionDigest, sessionTokenFromRequest } from "@/lib/server-auth";',
  );
}

if (!api.includes('INSTITUTION_DASHBOARD_BLOCKED')) {
  const anchor = '    const db = getKpiDatabase();';
  if (!api.includes(anchor)) throw new Error("PATCH105: dashboard db anchor missing");
  const guard = `    const db = getKpiDatabase();\n\n    // PATCH105: institution accounts must not access the leadership dashboard.\n    const dashboardSessionToken = sessionTokenFromRequest(request);\n    if (dashboardSessionToken) {\n      const dashboardSession = await db.pool.query(\n        \`SELECT u.role\n           FROM sessions s\n           JOIN users u ON u.email = s.user_email\n          WHERE s.token = $1\n            AND s.expires_at > NOW()\n            AND u.active = 1\n          LIMIT 1\`,\n        [sessionDigest(dashboardSessionToken)],\n      );\n      if (String(dashboardSession.rows[0]?.role || \"\") === \"institution\") {\n        return Response.json(\n          { error: \"Muassasa foydalanuvchilari uchun Dashboard yopiq.\", code: \"INSTITUTION_DASHBOARD_BLOCKED\" },\n          { status: 403, headers: { \"cache-control\": \"no-store\" } },\n        );\n      }\n    }`;
  api = api.replace(anchor, guard);
}

fs.writeFileSync(apiFile, api, "utf8");

let ui = fs.readFileSync(uiFile, "utf8");
if (!ui.includes('INSTITUTION_DASHBOARD_BLOCKED')) {
  const from = '        if (!response.ok) throw new Error(payload.error || "Dashboard ma’lumotlari yuklanmadi.");';
  const to = `        if (response.status === 403 && (payload as DashboardPayload & { code?: string }).code === \"INSTITUTION_DASHBOARD_BLOCKED\") {\n          window.location.href = \"/institution\";\n          return payload;\n        }\n        if (!response.ok) throw new Error(payload.error || \"Dashboard ma’lumotlari yuklanmadi.\");`;
  if (!ui.includes(from)) throw new Error("PATCH105: dashboard response anchor missing");
  ui = ui.replace(from, to);
}

fs.writeFileSync(uiFile, ui, "utf8");
console.log("PATCH105: institution accounts are blocked from Dashboard and redirected to /institution.");

await import("./patch106.mjs");
