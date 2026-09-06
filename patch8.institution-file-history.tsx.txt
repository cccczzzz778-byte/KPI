"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileArchive, FileText, RefreshCw, Search, X } from "lucide-react";
import { FilePreviewModal, type PreviewFile } from "@/components/file-preview-modal";

type HistoryItem = PreviewFile & {
  criterionId: string;
  criterionTitle: string;
  roundDay: number | null;
  sizeBytes: number;
  source: string;
  responsibleName?: string;
  responsiblePhone?: string;
  submissionDate?: string;
  createdAt?: string;
};

function cleanFilename(value: string) {
  return String(value || "Fayl").replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function rawDate(item: HistoryItem) {
  return item.submissionDate || item.createdAt || "";
}

function formatDate(item: HistoryItem) {
  const raw = rawDate(item);
  if (!raw) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}.${month}.${year}`;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("uz-UZ");
}

function canPreview(item: HistoryItem) {
  const type = String(item.contentType || "").toLowerCase();
  const name = String(item.filename || "").toLowerCase();
  return type === "application/pdf" || type.startsWith("image/") || /\.(pdf|jpe?g|png|webp|gif)$/i.test(name);
}

function FileName({ item }: { item: HistoryItem }) {
  const name = cleanFilename(item.filename);
  const archive = /\.(zip|rar)$/i.test(name);
  return <div className="institution-history-file" title={name}>
    {archive ? <FileArchive size={18} /> : <FileText size={18} />}
    <span>{name}</span>
  </div>;
}

export function InstitutionFileHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [date, setDate] = useState("");
  const [preview, setPreview] = useState<HistoryItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/institution/history", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { items?: HistoryItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Fayllar tarixini yuklab bo‘lmadi.");
        return payload.items || [];
      })
      .then((rows) => setItems(rows))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Xatolik yuz berdi.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reloadKey]);

  const criteria = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => { if (item.criterionId) map.set(item.criterionId, item.criterionTitle); });
    return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, "uz"));
  }, [items]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("uz");
    return items.filter((item) => {
      if (criterionId && item.criterionId !== criterionId) return false;
      if (date) {
        const raw = rawDate(item);
        const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : (() => {
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) return "";
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        })();
        if (normalized !== date) return false;
      }
      if (!value) return true;
      return cleanFilename(item.filename).toLocaleLowerCase("uz").includes(value) ||
        item.criterionTitle.toLocaleLowerCase("uz").includes(value) ||
        formatDate(item).includes(value);
    });
  }, [items, query, criterionId, date]);

  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    return items.filter((item) => item.submissionDate === key).length;
  }, [items]);

  const hasFilters = Boolean(query || criterionId || date);

  return <section className="responsible-card institution-history-card">
    <div className="institution-history-head">
      <div>
        <strong>YUKLANGAN FAYLLAR TARIXI</strong>
        <span>Qaysi mezonga, qachon va qaysi fayl yuklanganini shu yerda ko‘rasiz.</span>
      </div>
      <button type="button" className="institution-history-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Yangilash</button>
    </div>

    <div className="institution-history-stats">
      <div><span>Jami fayl</span><strong>{items.length}</strong></div>
      <div><span>Bugun</span><strong>{today}</strong></div>
      <div><span>Mezonlar</span><strong>{criteria.length}</strong></div>
    </div>

    <div className="institution-history-filters">
      <label className="institution-history-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mezon yoki fayl nomi..." /></label>
      <select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} aria-label="Mezon">
        <option value="">Barcha mezonlar</option>
        {criteria.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
      </select>
      <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Sana" />
      {hasFilters && <button type="button" className="institution-history-clear" onClick={() => { setQuery(""); setCriterionId(""); setDate(""); }}><X size={16} /> Tozalash</button>}
    </div>

    {loading ? <div className="institution-history-state"><RefreshCw className="animate-spin" size={20} /> Fayllar yuklanmoqda...</div> : error ? <div className="institution-history-state institution-history-error"><strong>Tarix yuklanmadi</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Qayta urinish</button></div> : filtered.length === 0 ? <div className="institution-history-state">Fayl topilmadi.</div> : <>
      <div className="institution-history-table-wrap">
        <table className="institution-history-table">
          <thead><tr><th>Sana</th><th>Mezon</th><th>Nazorat</th><th>Fayl</th><th>Hajm</th><th>Amal</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td>{formatDate(item)}</td>
            <td><strong className="institution-history-criterion">{item.criterionTitle}</strong></td>
            <td>{item.roundDay ? `${item.roundDay}-kunlik` : "—"}</td>
            <td><FileName item={item} /></td>
            <td>{formatBytes(Number(item.sizeBytes))}</td>
            <td><div className="institution-history-actions">{canPreview(item) && <button type="button" onClick={() => setPreview(item)}><Eye size={16} /> Ko‘rish</button>}<a href={`/api/files?id=${encodeURIComponent(item.id)}`}><Download size={16} /> Yuklash</a></div></td>
          </tr>)}</tbody>
        </table>
      </div>

      <div className="institution-history-mobile">
        {filtered.map((item) => <article key={item.id} className="institution-history-item">
          <div className="institution-history-item-top"><span>{formatDate(item)}</span><span>{formatBytes(Number(item.sizeBytes))}</span></div>
          <strong>{item.criterionTitle}</strong>
          <small>{item.roundDay ? `${item.roundDay}-kunlik nazorat` : item.source === "institution_order" ? "BUYRUQ" : "Mezon fayli"}</small>
          <FileName item={item} />
          <div className="institution-history-actions">{canPreview(item) && <button type="button" onClick={() => setPreview(item)}><Eye size={16} /> Online ko‘rish</button>}<a href={`/api/files?id=${encodeURIComponent(item.id)}`}><Download size={16} /> Yuklab olish</a></div>
        </article>)}
      </div>
    </>}

    {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
  </section>;
}
