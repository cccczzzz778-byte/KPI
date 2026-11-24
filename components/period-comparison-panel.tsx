"use client";

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

  const topRows = useMemo(() => data?.rows ?? [], [data]);

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
