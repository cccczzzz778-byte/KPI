import { criteria, type CommissionKey } from "@/lib/kpi-data";
import { getMonthOverride, KPI_MONTH_OVERRIDES } from "@/lib/kpi-month-overrides";
import { getKpiDatabase } from "@/lib/netlify-db";
import { ensureApplicabilityTable } from "@/lib/institution-applicability";
import { averagePeriodScores, kpiMonthKeyForDate, previousMonthKey } from "@/period-comparison.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS: CommissionKey[] = ["ijro", "birlamchi", "statsionar", "raqam", "moliya"];
const MAX: Record<CommissionKey, number> = { ijro: 10.3, birlamchi: 29.4, statsionar: 23.5, raqam: 13.3, moliya: 23.5 };
const IDS = Object.fromEntries(KEYS.map((key) => [key, criteria.filter((item) => item.commission === key).map((item) => item.id)])) as Record<CommissionKey, string[]>;

function tashkentDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

function monthBounds(key: string) {
  if (key === "2026-09") return { start: "2000-01-01", end: "2026-10-04" };
  if (key === "2026-10") return { start: "2026-10-05", end: "2026-10-31" };
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new Error("Noto‘g‘ri hisobot davri: " + key);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: key + "-01", end: key + "-" + String(lastDay).padStart(2, "0") };
}

function label(key: string) {
  const names = ["", "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
  const [year, month] = key.split("-").map(Number);
  return (names[month] || key) + " " + year;
}

function directionScore(raw: number, key: CommissionKey) {
  const count = IDS[key].length;
  if (!count) return 0;
  return Math.max(0, Math.min(MAX[key], Number(((raw / (count * 2)) * MAX[key]).toFixed(1))));
}

function buildPeriodScores(rows: any[], exclusions: Map<string, Set<CommissionKey>>, monthKey = "") {
  const byInstitution = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const institutionId = String(row.institutionId);
    if (!byInstitution.has(institutionId)) byInstitution.set(institutionId, new Map());
    byInstitution.get(institutionId)!.set(String(row.criterionId), Number(row.score || 0));
  }

  const totals = new Map<string, { total: number; hasEvaluation: boolean }>();
  for (const [institutionId, scoreMap] of byInstitution.entries()) {
    const excluded = exclusions.get(institutionId) ?? new Set<CommissionKey>();
    const parts = Object.fromEntries(KEYS.map((key) => {
      if (excluded.has(key)) return [key, 0];
      const raw = IDS[key].reduce((sum, criterionId) => sum + Number(scoreMap.get(criterionId) || 0), 0);
      return [key, directionScore(raw, key)];
    })) as Record<CommissionKey, number>;
    const applicable = KEYS.filter((key) => !excluded.has(key));
    const rawTotal = applicable.reduce((sum, key) => sum + parts[key], 0);
    const maxTotal = applicable.reduce((sum, key) => sum + MAX[key], 0);
    totals.set(institutionId, {
      total: maxTotal > 0 ? Number(((rawTotal / maxTotal) * 100).toFixed(1)) : 0,
      hasEvaluation: scoreMap.size > 0,
    });
  }
  return applyOverrides(totals, monthKey);
}

function applyOverrides(totals: Map<string, { total: number; hasEvaluation: boolean }>, monthKey: string) {
  if (!monthKey) return totals;
  const ids = new Set<string>([...totals.keys()]);
  for (const id of Object.keys(KPI_MONTH_OVERRIDES[monthKey] || {})) ids.add(id);
  for (const id of ids) {
    const override = getMonthOverride(monthKey, id);
    if (!override) continue;
    const applicable = KEYS.filter((key) => override[key] !== null);
    const rawTotal = applicable.reduce((sum, key) => sum + Number(override[key] || 0), 0);
    const maxTotal = applicable.reduce((sum, key) => sum + MAX[key], 0);
    totals.set(id, { total: maxTotal > 0 ? Number(((rawTotal / maxTotal) * 100).toFixed(1)) : 0, hasEvaluation: true });
  }
  return totals;
}

export async function GET() {
  try {
    await ensureApplicabilityTable();
    const db = getKpiDatabase();
    const today = tashkentDate();
    const currentKey = kpiMonthKeyForDate(today);
    const previousKey = previousMonthKey(currentKey);
    const currentBounds = monthBounds(currentKey);
    const previousBounds = monthBounds(previousKey);
    const currentEnd = today < currentBounds.end ? today : currentBounds.end;

    const [institutionsResult, currentResult, previousResult, exclusionsResult] = await Promise.all([
      db.pool.query("SELECT id,name,district,type FROM institutions WHERE active=1 ORDER BY LOWER(name)"),
      db.pool.query(
        'SELECT institution_id AS "institutionId", criterion_id AS "criterionId", (ARRAY_AGG(LEAST(2,GREATEST(0,score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date GROUP BY institution_id,criterion_id',
        [currentBounds.start, currentEnd],
      ),
      db.pool.query(
        'SELECT institution_id AS "institutionId", criterion_id AS "criterionId", (ARRAY_AGG(LEAST(2,GREATEST(0,score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date GROUP BY institution_id,criterion_id',
        [previousBounds.start, previousBounds.end],
      ),
      db.pool.query('SELECT institution_id AS "institutionId", commission FROM institution_commission_exclusions'),
    ]);

    const exclusions = new Map<string, Set<CommissionKey>>();
    for (const row of exclusionsResult.rows) {
      const institutionId = String(row.institutionId);
      const commission = String(row.commission) as CommissionKey;
      if (!KEYS.includes(commission)) continue;
      if (!exclusions.has(institutionId)) exclusions.set(institutionId, new Set());
      exclusions.get(institutionId)!.add(commission);
    }

    const current = buildPeriodScores(currentResult.rows, exclusions, currentKey);
    const previous = buildPeriodScores(previousResult.rows, exclusions, previousKey);

    const rows = institutionsResult.rows.map((institution: any) => {
      const id = String(institution.id);
      const currentRow = current.get(id) ?? { total: 0, hasEvaluation: false };
      const previousRow = previous.get(id) ?? { total: 0, hasEvaluation: false };
      const available = [previousRow.hasEvaluation ? previousRow.total : NaN, currentRow.hasEvaluation ? currentRow.total : NaN].filter(Number.isFinite) as number[];
      const aggregate = averagePeriodScores(available);
      const delta = Number((currentRow.total - previousRow.total).toFixed(1));
      return {
        institutionId: id,
        name: String(institution.name),
        district: String(institution.district || ""),
        previous: previousRow.total,
        current: currentRow.total,
        aggregate,
        delta,
        hasPrevious: previousRow.hasEvaluation,
        hasCurrent: currentRow.hasEvaluation,
      };
    }).sort((a: any, b: any) => b.aggregate - a.aggregate || b.current - a.current || a.name.localeCompare(b.name, "uz"));

    const currentValues = rows.filter((row: any) => row.hasCurrent).map((row: any) => row.current);
    const previousValues = rows.filter((row: any) => row.hasPrevious).map((row: any) => row.previous);
    const aggregateValues = rows.filter((row: any) => row.hasCurrent || row.hasPrevious).map((row: any) => row.aggregate);

    return Response.json({
      currentKey,
      previousKey,
      currentLabel: label(currentKey),
      previousLabel: label(previousKey),
      currentPeriodText: currentKey === "2026-10" ? "5-oktabrdan" : "oy boshidan",
      summary: {
        currentAverage: averagePeriodScores(currentValues),
        previousAverage: averagePeriodScores(previousValues),
        aggregateAverage: averagePeriodScores(aggregateValues),
        evaluatedCurrent: currentValues.length,
        evaluatedPrevious: previousValues.length,
      },
      rows,
    }, { headers: { "cache-control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error("period comparison failed", error);
    const message = error instanceof Error ? error.message : "Davriy KPI tahlilini yuklab bo‘lmadi.";
    return Response.json({ error: message }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
