"use client";
import PeriodComparisonPanel from "@/components/period-comparison-panel";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  HeartPulse,
  Hospital,
  Landmark,
  LockKeyhole,
  Stethoscope,
  Trophy,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { commissions, criteria, rounds, type CommissionKey } from "@/lib/kpi-data";
import { getMonthOverride } from "@/lib/kpi-month-overrides";

type Institution = { id: string; name: string; district: string; type: string; active: number; responsibleName?: string; responsiblePhone?: string };
type Evaluation = { institutionId: string; roundDay: number; criterionId: string; score: number };
type DashboardPayload = { institutions: Institution[]; evaluations: Evaluation[]; exclusions?: Array<{ institutionId:string; commission:CommissionKey }>; months?: Array<{ key:string; start:string; end:string }>; selectedMonth?:string; currentMonth?:string; error?: string };
type ReportPeriod = "daily" | "monthly";

const KPI_MONTH_NAMES = ["","Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
function currentKpiMonthKey(){const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tashkent",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const g=(t:string)=>p.find(x=>x.type===t)?.value||"";const d=g("year")+"-"+g("month")+"-"+g("day");return d<"2026-10-05"?"2026-09":d.slice(0,7)}
function kpiMonthLabel(key:string){const [y,m]=key.split("-").map(Number);if(key==="2026-09")return "Sentabr 2026 · oldingi oy";if(key==="2026-10")return "Oktabr 2026 · 5-oktabrdan";return (KPI_MONTH_NAMES[m]||key)+" "+y}

const iconByCommission = {
  ijro: ClipboardCheck,
  birlamchi: HeartPulse,
  statsionar: Hospital,
  raqam: BarChart3,
  moliya: Landmark,
};

const commissionMaxScores: Record<CommissionKey, number> = {"ijro":10.3,"birlamchi":29.4,"statsionar":23.5,"raqam":13.3,"moliya":23.5};

function getCommissionMaxScore(commissionId: CommissionKey) {
  return commissionMaxScores[commissionId];
}

function commissionScore(commissionId: CommissionKey, institutionId: string, roundDay: number, evaluationMap: Map<string, number>) {
  const items = criteria.filter((criterion) => criterion.commission === commissionId);
  const earned = items.reduce((sum, item) => sum + (evaluationMap.get(`${institutionId}:${roundDay}:${item.id}`) ?? 0), 0);
  const maxScore = getCommissionMaxScore(commissionId);
  if (!items.length) return 0;
  const calculated = Number(((earned / (items.length * 2)) * maxScore).toFixed(1));
  return Math.max(0, Math.min(maxScore, calculated));
}

function resultLabel(total: number, evaluated: boolean) {
  if (!evaluated) return { label: "Baholanmagan", className: "status-pending" };
  if (total >= 86) return { label: "A’lo", className: "status-excellent" };
  if (total >= 71) return { label: "Yaxshi", className: "status-good" };
  if (total >= 56) return { label: "Qoniqarli", className: "status-average" };
  return { label: "Tanqidiy", className: "status-critical" };
}

export default function PublicDashboard() {
  const [data, setData] = useState<DashboardPayload>({ institutions: [], evaluations: [] });
  const selectedRound = 10;
  const reportPeriod: ReportPeriod = "monthly";
  const [selectedMonth, setSelectedMonth] = useState(() => currentKpiMonthKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const loadDashboard = async () => {
      try {
        const response = await fetch(`/api/dashboard?period=${reportPeriod}&month=${encodeURIComponent(selectedMonth)}`, { cache: "no-store" });
        const payload = (await response.json()) as DashboardPayload;
        if (response.status === 403 && (payload as DashboardPayload & { code?: string }).code === "INSTITUTION_DASHBOARD_BLOCKED") {
          window.location.href = "/institution";
          return payload;
        }
        if (!response.ok) throw new Error(payload.error || "Dashboard ma’lumotlari yuklanmadi.");
        if (active) {
          setData(payload);
          setError("");
        }
      } catch (loadError: unknown) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Yuklashda xatolik.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    const timer = window.setInterval(() => { void loadDashboard(); }, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [reportPeriod, selectedMonth]);

  const evaluationMap = useMemo(
    () => new Map(data.evaluations.map((item) => [`${item.institutionId}:${item.roundDay}:${item.criterionId}`, Number(item.score)])),
    [data.evaluations],
  );
  const ranking = useMemo(() => data.institutions.map((institution) => {
    const override = getMonthOverride(data.selectedMonth || selectedMonth, institution.id);
    const excludedDirections = override ? new Set<CommissionKey>(commissions.filter((commission) => override[commission.id] === null).map((commission) => commission.id)) : new Set<CommissionKey>((data.exclusions ?? []).filter((item) => item.institutionId === institution.id).map((item) => item.commission));
    const parts = Object.fromEntries(
      commissions.map((commission) => [commission.id, excludedDirections.has(commission.id) ? 0 : override ? Number(override[commission.id] || 0) : commissionScore(commission.id, institution.id, selectedRound, evaluationMap)]),
    ) as Record<CommissionKey, number>;
    const applicable = commissions.filter((commission) => !excludedDirections.has(commission.id));
    const rawTotal = applicable.reduce((sum, commission) => sum + parts[commission.id], 0);
    const applicableMaximum = applicable.reduce((sum, commission) => sum + getCommissionMaxScore(commission.id), 0);
    const total = applicableMaximum > 0 ? Number(((rawTotal / applicableMaximum) * 100).toFixed(1)) : 0;
    const evaluated = Boolean(override) || data.evaluations.some((item) => item.institutionId === institution.id && item.roundDay === selectedRound);
    return { institution, parts, total, evaluated, excludedDirections: Array.from(excludedDirections) };
  }).sort((a, b) => b.total - a.total || a.institution.name.localeCompare(b.institution.name, "uz")), [data, evaluationMap, selectedRound, selectedMonth]);

  const evaluatedRows = ranking.filter((row) => row.evaluated);
  const average = evaluatedRows.length
    ? Number((evaluatedRows.reduce((sum, row) => sum + row.total, 0) / evaluatedRows.length).toFixed(1))
    : 0;
  const leader = evaluatedRows[0];

  if (loading) {
    return <main className="dashboard-shell"><div className="page-loading"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-96 w-full" /></div></main>;
  }

  if (error) {
    return <main className="dashboard-shell"><section className="access-state"><BarChart3 /><h1>Dashboard ochilmadi</h1><p>{error}</p></section></main>;
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar app-topbar">
        <div className="brand-lockup"><div className="brand-mark"><Stethoscope size={24} strokeWidth={1.8} /></div><div><p>Buxoro viloyati sog‘liqni saqlash boshqarmasi</p><h1>Tibbiyot muassasalari KPI nazorati</h1></div></div>
        <nav className="panel-nav public-panel-nav" aria-label="Boshqaruv panellari">
          <Link className="active" href="/"><BarChart3 /> Dashboard</Link>
          <Link href="/evaluator"><LockKeyhole /> Baholovchi</Link>
          <Link href="/monitoring"><LockKeyhole /> Monitoring</Link>
          <Link href="/admin"><LockKeyhole /> Admin</Link>
        </nav>
        <a className="login-button" href="/login"><LockKeyhole /> Kabinetga kirish</a>
      </header>

      <section className="control-deck">
        <div className="control-copy">
          <p className="eyebrow">60 kunlik dastur · umumiy Dashboard</p>
          <h2>Muassasalar KPI natijalari va reytingi</h2>
          <p>{criteria.length} ta baholash mezoni, 5 ta yo‘nalish va 100 ballik yakuniy natija. Izohlar, fayllar va boshqaruv amallari faqat himoyalangan kabinetlarda ko‘rinadi.</p>
        </div>
        <div className="round-control compact-round-control"><div><label>Hisobot davri</label><strong className="dashboard-period-readout">{kpiMonthLabel(selectedMonth)+" natijasi"}</strong><span>{"Tanlangan oy bo‘yicha o‘rtacha natija · maksimum 100 ball"}</span></div></div>
      </section>

      <PeriodComparisonPanel mode="dashboard" /><section className="metric-grid" aria-label="Umumiy KPI ko‘rsatkichlari">
        <article className="metric-card"><div className="metric-icon blue"><Building2 /></div><div><span>Muassasalar</span><strong>{ranking.length}</strong><small>faol muassasa</small></div></article>
        <article className="metric-card"><div className="metric-icon teal"><ClipboardCheck /></div><div><span>Baholangan</span><strong>{evaluatedRows.length}</strong><small>{kpiMonthLabel(selectedMonth)}</small></div></article>
        <article className="metric-card"><div className="metric-icon violet"><BarChart3 /></div><div><span>O‘rtacha KPI</span><strong>{average}<em>/100</em></strong><small>baholanganlar bo‘yicha</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><Trophy /></div><div><span>Yetakchi natija</span><strong>{leader?.total ?? 0}<em>/100</em></strong><small>{leader?.institution.name ?? "Hozircha baho yo‘q"}</small></div></article>
      </section>

      <section className="commission-grid">
        {commissions.map((commission) => {
          const Icon = iconByCommission[commission.id];
          return <article key={commission.id} className="commission-card" style={{ "--commission": commission.color } as React.CSSProperties}><div className="commission-topline"><span>{commission.code}-YO‘NALISH</span><Icon /></div><h3>{commission.title}</h3><div className="commission-foot"><span>{criteria.filter((item) => item.commission === commission.id).length} ta mezon</span><strong>{getCommissionMaxScore(commission.id)} ball</strong></div></article>;
        })}
      </section>

      <section className="workspace-panel">
        <div className="workspace-toolbar"><h3 className="panel-heading"><BarChart3 /> Muassasalar reytingi</h3><span className="toolbar-note">Jami KPI natijasi · maksimum 100 ball</span></div>
        <Table><TableHeader><TableRow><TableHead className="rank-col">#</TableHead><TableHead>Muassasa</TableHead><TableHead className="public-responsible-head">Mas’ul shaxs</TableHead>{commissions.map((commission) => <TableHead key={commission.id} className="score-col">{commission.short}</TableHead>)}<TableHead className="total-col">Jami KPI</TableHead><TableHead>Holat</TableHead></TableRow></TableHeader><TableBody>{ranking.map((row, index) => { const status = resultLabel(row.total, row.evaluated); return <TableRow key={row.institution.id}><TableCell className="rank-col"><span className="rank-number">{index + 1}</span></TableCell><TableCell className="institution-cell"><strong>{row.institution.name}</strong><span>{row.institution.district} · {row.institution.type}</span></TableCell><TableCell className="public-responsible-cell">{row.institution.responsibleName || row.institution.responsiblePhone ? <><strong>{row.institution.responsibleName || "—"}</strong>{row.institution.responsiblePhone ? <a href={`tel:${row.institution.responsiblePhone.replace(/\s+/g, "")}`}>{row.institution.responsiblePhone}</a> : <span>Telefon kiritilmagan</span>}</> : <span className="public-responsible-empty">Belgilanmagan</span>}</TableCell>{commissions.map((commission) => <TableCell key={commission.id} className="score-col">{row.excludedDirections.includes(commission.id) ? <strong>N/A</strong> : <><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></>}</TableCell>)}<TableCell className="total-col"><strong>{row.total}</strong><span>/100</span></TableCell><TableCell><span className={`status-pill ${status.className}`}>{status.label}</span></TableCell></TableRow>; })}</TableBody></Table>
      </section>

      <footer className="site-footer"><span>Umumiy Dashboard · 60 kunlik strategik dastur</span><span>Baholash, izoh va fayllar himoyalangan kabinetlarda</span></footer>
    </main>
  );
}
