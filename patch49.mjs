const componentPath = 'components/kpi-period-reports.tsx';
const cssPath = 'app/globals.css';

if (!fs.existsSync(componentPath)) throw new Error('PATCH49: kpi-period-reports component not found');
if (!fs.existsSync(cssPath)) throw new Error('PATCH49: globals.css not found');

const component = `"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Download } from "lucide-react";

type Period = "daily" | "weekly" | "monthly";

function tashkentToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

const labels: Record<Period, string> = {
  daily: "Kunlik Excel",
  weekly: "Haftalik Excel",
  monthly: "Oylik Excel",
};

export default function KpiPeriodReports() {
  const [date, setDate] = useState(() => tashkentToday());
  const links = useMemo(() => (["daily", "weekly", "monthly"] as Period[]).map((period) => ({
    period,
    href: "/api/reports/kpi-period?" + new URLSearchParams({ period, date, format: "xlsx" }).toString(),
  })), [date]);

  return <section className="kpi-export-only" aria-label="KPI Excel hisobotlari">
    <div className="kpi-export-copy">
      <strong>Baholarni Excelga yuklab olish</strong>
      <span>Admin va Monitoring — barcha yo‘nalishlar. Baholovchi — faqat o‘z yo‘nalishi.</span>
    </div>
    <div className="kpi-export-actions">
      <label className="kpi-export-date"><CalendarDays size={16} /><input type="date" value={date} max={tashkentToday()} onChange={(event) => setDate(event.target.value)} /></label>
      {links.map(({ period, href }) => <a key={period} href={href} className="kpi-export-button"><Download size={16} />{labels[period]}</a>)}
    </div>
  </section>;
}
`;
fs.writeFileSync(componentPath, component, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const p47 = css.indexOf('/* P47 */');
if (p47 >= 0) css = css.slice(0, p47).trimEnd() + '\n';
css += `\n/* PATCH49_EXCEL_EXPORT_ONLY */\n.compact-round-control{display:none!important}\n.kpi-export-only{margin:0 0 16px;padding:14px 16px;border:1px solid #cfe9e6;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:14px}.kpi-export-copy{display:grid;gap:3px}.kpi-export-copy strong{font-size:15px;color:#155c57}.kpi-export-copy span{font-size:12px;color:#64748b}.kpi-export-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.kpi-export-date{height:38px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid #cfe2df;border-radius:9px;background:#fff;color:#155c57}.kpi-export-date input{border:0;outline:0;background:transparent;color:#334155;font-weight:700}.kpi-export-button{height:38px;display:inline-flex;align-items:center;gap:7px;padding:0 12px;border-radius:9px;background:#198178;color:#fff!important;text-decoration:none!important;font-size:13px;font-weight:800;white-space:nowrap}.kpi-export-button:hover{background:#156f68}@media(max-width:900px){.kpi-export-only{align-items:flex-start;flex-direction:column}.kpi-export-actions{justify-content:flex-start;width:100%}}\n`;
fs.writeFileSync(cssPath, css, 'utf8');

console.log('PATCH49: Excel-only report UI active; obsolete 10-day stage card hidden.');
