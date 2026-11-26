import { criteria, defaultInstitutions } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { sessionDigest, sessionTokenFromRequest } from "@/lib/server-auth";
import { ensureApplicabilityTable } from "@/lib/institution-applicability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PeriodMode = "daily" | "monthly";

function tashkentDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function monthKeyForDate(date: string) {
  if (date < "2026-10-05") return "2026-09";
  return date.slice(0, 7);
}

function monthBounds(key: string) {
  if (key === "2026-09") return { start: "2000-01-01", end: "2026-10-04" };
  if (key === "2026-10") return { start: "2026-10-05", end: "2026-10-31" };
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return { start: "2026-10-05", end: "2026-10-31" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${key}-01`, end: `${key}-${String(lastDay).padStart(2, "0")}` };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedPeriod = String(url.searchParams.get("period") || "daily");
    const period: PeriodMode = requestedPeriod === "monthly" ? "monthly" : "daily";
    const currentDate = tashkentDate();
    const currentMonthKey = monthKeyForDate(currentDate);
    const requestedMonth = String(url.searchParams.get("month") || currentMonthKey);
    const selectedMonth = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : currentMonthKey;
    const selectedBounds = monthBounds(selectedMonth);
    const selectedEnd = selectedMonth === currentMonthKey && currentDate < selectedBounds.end ? currentDate : selectedBounds.end;

    const db = getKpiDatabase();

    // Muassasa foydalanuvchilari rahbariyat dashboardini ko'rmaydi (o'z sahifasiga yo'naltiriladi).
    const dashboardSessionToken = sessionTokenFromRequest(request);
    if (dashboardSessionToken) {
      const dashboardSession = await db.pool.query(
        `SELECT u.role
           FROM sessions s
           JOIN users u ON u.email = s.user_email
          WHERE s.token = $1
            AND s.expires_at > NOW()
            AND u.active = 1
          LIMIT 1`,
        [sessionDigest(dashboardSessionToken)],
      );
      if (String(dashboardSession.rows[0]?.role || "") === "institution") {
        return Response.json(
          { error: "Muassasa foydalanuvchilari uchun Dashboard yopiq.", code: "INSTITUTION_DASHBOARD_BLOCKED" },
          { status: 403, headers: { "cache-control": "no-store" } },
        );
      }
    }

    const institutionPromise = db.pool.query(`
      SELECT i.id, i.name, i.district, i.type, i.active,
             r.responsible_name AS "responsibleName",
             r.responsible_phone AS "responsiblePhone"
      FROM institutions i
      LEFT JOIN institution_responsibles r ON r.institution_id = i.id
      ORDER BY LOWER(i.name)
    `);

    const evaluationPromise = period === "monthly"
      ? db.pool.query(
          `SELECT institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  (ARRAY_AGG(LEAST(2, GREATEST(0, score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score
             FROM daily_evaluations
            WHERE evaluation_date BETWEEN $1::date AND $2::date
            GROUP BY institution_id, criterion_id`,
          [selectedBounds.start, selectedEnd],
        )
      : db.pool.query(
          `SELECT institution_id AS "institutionId",
                  criterion_id AS "criterionId",
                  LEAST(2, GREATEST(0, score))::float8 AS score
             FROM daily_evaluations
            WHERE evaluation_date = $1::date`,
          [currentDate],
        );

    const monthPromise = db.pool.query(
      `SELECT DISTINCT
          CASE
            WHEN evaluation_date < DATE '2026-10-05' THEN '2026-09'
            ELSE TO_CHAR(evaluation_date, 'YYYY-MM')
          END AS key
       FROM daily_evaluations
       WHERE evaluation_date <= $1::date
       ORDER BY key DESC`,
      [currentDate],
    );

    const exclusionPromise = db.pool.query("SELECT institution_id AS \"institutionId\", commission FROM institution_commission_exclusions");
    const [institutionResult, evaluationResult, monthResult, exclusionResult] = await Promise.all([
      institutionPromise,
      evaluationPromise,
      monthPromise,
      exclusionPromise,
    ]);

    const institutionMap = new Map<string, Record<string, unknown>>(
      defaultInstitutions.map((item) => [item.id, { ...item, active: 1 }]),
    );
    for (const row of institutionResult.rows) institutionMap.set(String(row.id), row);
    const institutions = Array.from(institutionMap.values())
      .filter((item) => Number(item.active) === 1)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "uz"));

    const validCriterionIds = new Set(criteria.map((item) => item.id));
    const evaluations = evaluationResult.rows
      .filter((row) => validCriterionIds.has(String(row.criterionId)))
      .map((row) => ({
        institutionId: String(row.institutionId),
        roundDay: 10,
        criterionId: String(row.criterionId),
        score: Number(Number(row.score || 0).toFixed(3)),
      }));

    const monthKeys = new Set<string>([currentMonthKey, ...monthResult.rows.map((row) => String(row.key))]);
    const months = Array.from(monthKeys)
      .filter((key) => /^\d{4}-\d{2}$/.test(key))
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ key, ...monthBounds(key) }));

    return Response.json(
      {
        institutions,
        evaluations,
        exclusions: exclusionResult.rows.map((row) => ({
          institutionId: String(row.institutionId),
          commission: String(row.commission),
        })),
        period,
        currentDate,
        selectedMonth,
        currentMonth: currentMonthKey,
        months,
        accumulation: period === "monthly" ? "selected-month-average-on-100-point-scale" : "today",
      },
      { headers: { "cache-control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("public dashboard failed", error);
    const message = error instanceof Error ? error.message : "Dashboard ma’lumotlarini yuklab bo‘lmadi.";
    return Response.json({ error: message }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
