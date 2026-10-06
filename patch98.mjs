import fs from "node:fs";

function write(file, source) {
  const slash = file.lastIndexOf("/");
  if (slash >= 0) fs.mkdirSync(file.slice(0, slash), { recursive: true });
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH98: " + file);
}

const route = `import { criteria, type CommissionKey } from "@/lib/kpi-data";
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
  const match = /^(\\d{4})-(\\d{2})$/.exec(key);
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

function buildPeriodScores(rows: any[], exclusions: Map<string, Set<CommissionKey>>) {
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
        'SELECT institution_id AS "institutionId", criterion_id AS "criterionId", AVG(LEAST(2,GREATEST(0,score)))::float8 AS score FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date GROUP BY institution_id,criterion_id',
        [currentBounds.start, currentEnd],
      ),
      db.pool.query(
        'SELECT institution_id AS "institutionId", criterion_id AS "criterionId", AVG(LEAST(2,GREATEST(0,score)))::float8 AS score FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date GROUP BY institution_id,criterion_id',
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

    const current = buildPeriodScores(currentResult.rows, exclusions);
    const previous = buildPeriodScores(previousResult.rows, exclusions);

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
`;

const component = `"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Layers3, Loader2 } from "lucide-react";

type Row = {
  institutionId: string;
  name: string;
  district: string;
  previous: number;
  current: number;
  aggregate: number;
  delta: number;
  hasPrevious: boolean;
  hasCurrent: boolean;
};

type Payload = {
  currentLabel: string;
  previousLabel: string;
  currentPeriodText: string;
  summary: { currentAverage: number; previousAverage: number; aggregateAverage: number; evaluatedCurrent: number; evaluatedPrevious: number };
  rows: Row[];
  error?: string;
};

function score(value: number) {
  return Number(value || 0).toFixed(1);
}

function Trend({ value }: { value: number }) {
  if (value > 0) return <span className="period-trend up"><ArrowUpRight size={15} />+{score(value)}</span>;
  if (value < 0) return <span className="period-trend down"><ArrowDownRight size={15} />{score(value)}</span>;
  return <span className="period-trend flat"><ArrowRight size={15} />0.0</span>;
}

export default function PeriodComparisonPanel({ mode }: { mode: "dashboard" | "monitoring" }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/period-comparison", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as Payload;
        if (!response.ok) throw new Error(payload.error || "Davriy KPI tahlilini yuklab bo‘lmadi.");
        return payload;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((error) => console.error(error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const topRows = useMemo(() => data?.rows.slice(0, 12) ?? [], [data]);

  if (loading) return <section className="period-loading"><Loader2 className="period-spinner" /> Davriy KPI ko‘rsatkichlari yuklanmoqda...</section>;
  if (!data) return null;

  const aggregateDelta = Number((data.summary.currentAverage - data.summary.previousAverage).toFixed(1));

  if (mode === "dashboard") {
    return <section className="leadership-period-block" aria-label="Hisobot davrlari bo‘yicha KPI">
      <div className="leadership-period-heading">
        <div><span className="leadership-eyebrow">RAHBARIYAT UCHUN YIG‘MA TAHLIL</span><h3>Hisobot davrlari bo‘yicha KPI ko‘rsatkichlari</h3></div>
        <span className="leadership-period-note">Natijalar 100 ballik tizimda hisoblanadi</span>
      </div>
      <div className="leadership-period-cards">
        <article className="leadership-period-card current">
          <div className="period-card-icon"><CalendarDays /></div>
          <div className="period-card-body"><span>Joriy hisobot davri</span><strong>{score(data.summary.currentAverage)}<em>/100</em></strong><small>{data.currentLabel} · {data.currentPeriodText}</small></div>
          <Trend value={aggregateDelta} />
        </article>
        <article className="leadership-period-card previous">
          <div className="period-card-icon"><BarChart3 /></div>
          <div className="period-card-body"><span>Avvalgi hisobot davri</span><strong>{score(data.summary.previousAverage)}<em>/100</em></strong><small>{data.previousLabel} · yakuniy ko‘rsatkich</small></div>
        </article>
        <article className="leadership-period-card aggregate">
          <div className="period-card-icon"><Layers3 /></div>
          <div className="period-card-body"><span>Yig‘ma o‘rtacha ko‘rsatkich</span><strong>{score(data.summary.aggregateAverage)}<em>/100</em></strong><small>{data.previousLabel} + {data.currentLabel}</small></div>
          <span className="period-card-badge">2 davr</span>
        </article>
      </div>
    </section>;
  }

  return <section className="leadership-comparison-panel">
    <div className="leadership-comparison-head">
      <div><span className="leadership-eyebrow">RAHBARIYAT UCHUN DAVRIY MONITORING</span><h3>Muassasalar kesimida yig‘ma KPI tahlili</h3><p>Avvalgi va joriy hisobot davri natijalari hamda o‘zgarish dinamikasi.</p></div>
      <div className="leadership-summary-pill"><Layers3 size={17} /><span>Yig‘ma o‘rtacha</span><strong>{score(data.summary.aggregateAverage)}/100</strong></div>
    </div>
    <div className="leadership-comparison-table-wrap">
      <table className="leadership-comparison-table">
        <thead><tr><th>№</th><th>Muassasa</th><th>{data.previousLabel}<small>Avvalgi hisobot davri</small></th><th>{data.currentLabel}<small>Joriy hisobot davri</small></th><th>Yig‘ma o‘rtacha ko‘rsatkich<small>2 hisobot davri</small></th><th>Dinamika</th></tr></thead>
        <tbody>{topRows.map((row, index) => <tr key={row.institutionId}><td>{index + 1}</td><td><strong>{row.name}</strong><span>{row.district}</span></td><td>{row.hasPrevious ? <b className="score-chip previous">{score(row.previous)}</b> : <b className="score-chip empty">—</b>}</td><td>{row.hasCurrent ? <b className="score-chip current">{score(row.current)}</b> : <b className="score-chip empty">—</b>}</td><td><b className="score-chip aggregate">{score(row.aggregate)}</b></td><td><Trend value={row.delta} /></td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}
`;

write("app/api/period-comparison/route.ts", route);
write("components/period-comparison-panel.tsx", component);

{
  const file = "components/public-dashboard.tsx";
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes('import PeriodComparisonPanel from "@/components/period-comparison-panel";')) {
    const anchor = '"use client";';
    if (!s.includes(anchor)) throw new Error("PATCH98 public dashboard import anchor missing");
    s = s.replace(anchor, anchor + '\nimport PeriodComparisonPanel from "@/components/period-comparison-panel";');
  }
  if (!s.includes('<PeriodComparisonPanel mode="dashboard" />')) {
    const anchor = '<section className="metric-grid"';
    const index = s.indexOf(anchor);
    if (index < 0) throw new Error("PATCH98 public metric-grid anchor missing");
    s = s.slice(0, index) + '<PeriodComparisonPanel mode="dashboard" />' + s.slice(index);
  }
  write(file, s);
}

{
  const file = "components/kpi-app.tsx";
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes('import PeriodComparisonPanel from "@/components/period-comparison-panel";')) {
    const anchor = '"use client";';
    if (!s.includes(anchor)) throw new Error("PATCH98 kpi app import anchor missing");
    s = s.replace(anchor, anchor + '\nimport PeriodComparisonPanel from "@/components/period-comparison-panel";');
  }
  if (!s.includes('<PeriodComparisonPanel mode="monitoring" />')) {
    const anchor = '<CommissionCards /><section className="workspace-panel">';
    if (!s.includes(anchor)) throw new Error("PATCH98 monitoring panel anchor missing");
    s = s.replace(anchor, '<CommissionCards /><PeriodComparisonPanel mode="monitoring" /><section className="workspace-panel">');
  }
  write(file, s);
}

{
  const file = "app/globals.css";
  let s = fs.readFileSync(file, "utf8");
  const marker = "/* PATCH98_LEADERSHIP_PERIOD_UI */";
  if (!s.includes(marker)) s += `\n\n${marker}\n.period-loading{margin:14px 0;padding:16px 18px;border:1px solid #d7e5ea;border-radius:16px;background:#fff;color:#5d7180;display:flex;align-items:center;gap:9px;font-size:13px}.period-spinner{animation:spin 1s linear infinite}.leadership-period-block{margin:14px 0 16px;padding:18px;border:1px solid #d8e6ea;border-radius:20px;background:linear-gradient(135deg,#fff 0%,#f8fcfd 100%);box-shadow:0 12px 30px rgba(15,53,73,.06)}.leadership-period-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:14px}.leadership-period-heading h3,.leadership-comparison-head h3{margin:3px 0 0;color:#102d42;font-size:18px;line-height:1.25}.leadership-eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#148579}.leadership-period-note{font-size:11px;color:#718491}.leadership-period-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.leadership-period-card{position:relative;min-height:122px;border:1px solid #dce7eb;border-radius:17px;padding:17px;display:flex;align-items:center;gap:14px;overflow:hidden;background:#fff}.leadership-period-card:before{content:"";position:absolute;inset:0 auto 0 0;width:4px}.leadership-period-card.current:before{background:#168b7d}.leadership-period-card.previous:before{background:#55758b}.leadership-period-card.aggregate:before{background:#193d5a}.leadership-period-card.current{background:linear-gradient(135deg,#f8fffd,#eefaf7)}.leadership-period-card.previous{background:linear-gradient(135deg,#fff,#f5f8fa)}.leadership-period-card.aggregate{background:linear-gradient(135deg,#f7fbff,#eef5fa)}.period-card-icon{width:46px;height:46px;border-radius:13px;background:#e7f6f2;color:#128777;display:grid;place-items:center;flex:0 0 auto}.previous .period-card-icon{background:#edf2f5;color:#4f7188}.aggregate .period-card-icon{background:#e8f0f6;color:#173d5a}.period-card-icon svg{width:22px}.period-card-body{display:flex;flex-direction:column;min-width:0}.period-card-body>span{font-size:11px;text-transform:uppercase;letter-spacing:.055em;font-weight:800;color:#6a7d89}.period-card-body strong{font-size:29px;line-height:1.05;color:#102d42;margin:4px 0}.period-card-body strong em{font-size:13px;font-style:normal;font-weight:600;color:#80909a;margin-left:3px}.period-card-body small{font-size:11px;color:#718491}.period-card-badge{position:absolute;top:12px;right:12px;padding:5px 8px;border-radius:999px;background:#173d5a;color:#fff;font-size:10px;font-weight:800}.period-trend{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:800;border-radius:999px;padding:5px 7px;white-space:nowrap}.leadership-period-card .period-trend{position:absolute;right:12px;bottom:12px}.period-trend.up{background:#e9f8ef;color:#18844f}.period-trend.down{background:#fff0f0;color:#c64d4d}.period-trend.flat{background:#eef2f5;color:#6e7d88}.leadership-comparison-panel{margin:14px 0 16px;border:1px solid #d9e6ea;border-radius:19px;background:#fff;overflow:hidden;box-shadow:0 10px 28px rgba(15,53,73,.055)}.leadership-comparison-head{padding:17px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #e4ecef;background:linear-gradient(135deg,#fff,#f4fbfa)}.leadership-comparison-head p{margin:5px 0 0;font-size:12px;color:#6f818d}.leadership-summary-pill{display:flex;align-items:center;gap:7px;border:1px solid #cfe2e2;background:#fff;border-radius:12px;padding:9px 11px;color:#31586a;font-size:11px;white-space:nowrap}.leadership-summary-pill strong{font-size:16px;color:#0f7f73}.leadership-comparison-table-wrap{overflow:auto}.leadership-comparison-table{width:100%;border-collapse:collapse;min-width:850px}.leadership-comparison-table th{padding:11px 12px;background:#f5f8fa;border-bottom:1px solid #cbd9df;color:#587080;font-size:10px;text-transform:uppercase;letter-spacing:.04em;text-align:center}.leadership-comparison-table th:nth-child(2){text-align:left}.leadership-comparison-table th small{display:block;margin-top:3px;font-size:9px;text-transform:none;font-weight:500;color:#8a9aa4}.leadership-comparison-table td{padding:11px 12px;border-bottom:1px solid #e5ecef;text-align:center;font-size:12px;color:#203b4c}.leadership-comparison-table td:nth-child(2){text-align:left}.leadership-comparison-table td:nth-child(2) strong{display:block;color:#102d42;font-size:12px}.leadership-comparison-table td:nth-child(2) span{display:block;color:#8898a2;font-size:10px;margin-top:3px}.leadership-comparison-table tbody tr:hover{background:#f8fcfc}.score-chip{display:inline-flex;min-width:58px;justify-content:center;border-radius:9px;padding:6px 9px;font-size:12px}.score-chip.previous{background:#edf3f7;color:#3f6178}.score-chip.current{background:#e7f7f1;color:#117a63}.score-chip.aggregate{background:#eaf0f8;color:#183e5c}.score-chip.empty{background:#f4f5f6;color:#9aa6ad}@media(max-width:900px){.leadership-period-cards{grid-template-columns:1fr}.leadership-period-heading,.leadership-comparison-head{align-items:flex-start;flex-direction:column}.leadership-period-note{display:none}}\n`;
  write(file, s);
}

console.log("PATCH98: leadership Dashboard and Monitoring period comparison UI added with Joriy hisobot davri, Avvalgi hisobot davri, Yig‘ma o‘rtacha ko‘rsatkich and Dinamika.");
