"use client";

import { Download } from "lucide-react";

export default function KpiExcelExport() {
  return <section className="kpi-export-only" aria-label="KPI Excel hisoboti">
    <div className="kpi-export-copy">
      <strong>Excel hisobot olish</strong>
      <span>Namunadagi kabi 6 listli Monitoring Excel hisoboti.</span>
    </div>
    <div className="kpi-export-actions">
      <a href="/api/reports/monitoring-scores" className="kpi-export-button">
        <Download size={16} />
        Monitoring Excel (6 list)
      </a>
      <form action="/api/reports/monitoring-scores" method="get" className="kpi-export-monthly">
        <label htmlFor="monitoring-month">Hisobot oyi</label>
        <input id="monitoring-month" name="month" type="month" defaultValue="2026-10" min="2026-09" />
        <button type="submit" className="kpi-export-button"><Download size={16} />Oylik Monitoring Excel (6 list)</button>
      </form>
    </div>
  </section>;
}
