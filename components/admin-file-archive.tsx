"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileArchive, FileText, RefreshCw, Search, X } from "lucide-react";
import { FilePreviewModal, type PreviewFile } from "@/components/file-preview-modal";

type FileItem = PreviewFile & {
  institutionId: string;
  criterionId?: string;
  roundDay?: number | null;
  sizeBytes?: number;
  source: string;
  sourceLabel: string;
  submissionDate?: string;
  createdAt?: string;
  extension?: string;
};

type InstitutionOption = { id: string; name: string };
type CriterionOption = { id: string; title: string; commission?: string };
type Stats = { total: number; institutions: number; bytes: number; today: number };
type Payload = {
  items?: FileItem[];
  total?: number;
  institutions?: InstitutionOption[];
  criteria?: CriterionOption[];
  stats?: Stats;
  error?: string;
};

const PAGE_SIZE = 50;

function cleanFilename(value: string) {
  return String(value || "Fayl").replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

function formatBytes(bytes?: number) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(item: FileItem) {
  const raw = item.submissionDate || item.createdAt || "";
  if (!raw) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}.${month}.${year}`;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("uz-UZ");
}

function canPreview(item: FileItem) {
  const type = String(item.contentType || "").toLowerCase();
  const name = String(item.filename || "").toLowerCase();
  return type === "application/pdf" || type.startsWith("image/") || /\.(pdf|jpe?g|png|webp|gif)$/i.test(name);
}

function FileName({ item }: { item: FileItem }) {
  const name = cleanFilename(item.filename);
  const archive = /\.(zip|rar)$/i.test(name);
  return <div className="admin-file-name-wrap" title={name}>
    <span className="admin-file-icon" aria-hidden="true">{archive ? <FileArchive size={18} /> : <FileText size={18} />}</span>
    <span className="admin-file-name">{name}</span>
  </div>;
}

export function AdminFileArchive() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [criteria, setCriteria] = useState<CriterionOption[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, institutions: 0, bytes: 0, today: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => setPage(0), [query, institutionId, criterionId, from, to, kind, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE), sort });
    if (query) params.set("q", query);
    if (institutionId) params.set("institutionId", institutionId);
    if (criterionId) params.set("criterionId", criterionId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (kind) params.set("kind", kind);
    setLoading(true);
    setError("");

    fetch(`/api/admin/files?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as Payload;
        if (!response.ok) throw new Error(payload.error || "Fayllarni yuklab bo‘lmadi.");
        return payload;
      })
      .then((payload) => {
        setItems(payload.items || []);
        setTotal(Number(payload.total || 0));
        if (payload.institutions) setInstitutions(payload.institutions);
        if (payload.criteria) setCriteria(payload.criteria);
        if (payload.stats) setStats(payload.stats);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Xatolik yuz berdi.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [query, institutionId, criterionId, from, to, kind, sort, page, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleFrom = total ? page * PAGE_SIZE + 1 : 0;
  const visibleTo = Math.min(total, (page + 1) * PAGE_SIZE);
  const hasFilters = Boolean(queryInput || institutionId || criterionId || from || to || kind || sort !== "newest");
  const selectedCriterion = useMemo(() => criteria.find((item) => item.id === criterionId), [criteria, criterionId]);

  function clearFilters() {
    setQueryInput("");
    setQuery("");
    setInstitutionId("");
    setCriterionId("");
    setFrom("");
    setTo("");
    setKind("");
    setSort("newest");
    setPage(0);
  }

  return <section className="admin-file-archive">
    <div className="admin-file-header">
      <div>
        <h3>Yuklangan fayllar arxivi</h3>
        <p>Muassasa, mezon va sana kesimida barcha fayllarni topish, onlayn ko‘rish va yuklab olish mumkin.</p>
      </div>
      <button type="button" className="admin-file-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Yangilash</button>
    </div>

    <div className="admin-file-stats">
      <div><span>Topilgan fayllar</span><strong>{stats.total.toLocaleString("uz-UZ")}</strong></div>
      <div><span>Muassasalar</span><strong>{stats.institutions.toLocaleString("uz-UZ")}</strong></div>
      <div><span>Jami hajm</span><strong>{formatBytes(stats.bytes)}</strong></div>
      <div><span>Bugun yuklangan</span><strong>{stats.today.toLocaleString("uz-UZ")}</strong></div>
    </div>

    <div className="admin-file-filters admin-file-filters-v2">
      <label className="admin-file-search">
        <Search size={17} aria-hidden="true" />
        <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Fayl, muassasa yoki mezon qidiring..." />
      </label>
      <select value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} aria-label="Muassasa">
        <option value="">Barcha muassasalar</option>
        {institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} aria-label="Mezon">
        <option value="">Barcha mezonlar</option>
        {criteria.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Fayl turi">
        <option value="">Barcha fayllar</option>
        <option value="criterion">Mezon fayllari</option>
        <option value="order">BUYRUQ fayllari</option>
        <option value="other">Baholash asoslari</option>
      </select>
      <label className="admin-file-date-field"><span>Dan</span><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="admin-file-date-field"><span>Gacha</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Saralash">
        <option value="newest">Yangi → eski</option>
        <option value="oldest">Eski → yangi</option>
      </select>
      {hasFilters && <button type="button" className="admin-file-clear" onClick={clearFilters}><X size={16} /> Tozalash</button>}
    </div>

    {selectedCriterion && <div className="admin-file-active-filter"><strong>Mezon:</strong> {selectedCriterion.title}</div>}

    {loading ? <div className="admin-file-state"><RefreshCw className="animate-spin" size={20} /> Fayllar yuklanmoqda...</div> : error ? <div className="admin-file-state admin-file-error"><strong>Ma’lumot yuklanmadi</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Qayta urinish</button></div> : items.length === 0 ? <div className="admin-file-state">Tanlangan filtr bo‘yicha fayl topilmadi.</div> : <>
      <div className="admin-file-desktop-table">
        <table>
          <thead><tr><th>Sana</th><th>Muassasa</th><th>Mezon</th><th>Fayl</th><th>Hajm</th><th>Amal</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}>
            <td className="admin-file-date">{formatDate(item)}</td>
            <td><strong className="admin-file-institution">{item.institutionName}</strong></td>
            <td><span className="admin-file-criterion">{item.criterionTitle}</span><small>{item.sourceLabel}{item.roundDay ? ` · ${item.roundDay}-kunlik` : ""}</small></td>
            <td><div className="admin-file-filecell"><span className="admin-file-ext">{item.extension || "FAYL"}</span><FileName item={item} /></div></td>
            <td className="admin-file-size">{formatBytes(item.sizeBytes)}</td>
            <td><div className="admin-file-actions">
              {canPreview(item) && <button type="button" onClick={() => setPreview(item)}><Eye size={16} /> Ko‘rish</button>}
              <a href={`/api/files?id=${encodeURIComponent(item.id)}`}><Download size={16} /> Yuklash</a>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>

      <div className="admin-file-mobile-list">
        {items.map((item) => <article className="admin-file-card" key={item.id}>
          <div className="admin-file-card-top"><span>{formatDate(item)}</span><span>{formatBytes(item.sizeBytes)}</span></div>
          <strong className="admin-file-card-institution">{item.institutionName}</strong>
          <div className="admin-file-card-criterion">{item.criterionTitle}</div>
          <small>{item.sourceLabel}{item.roundDay ? ` · ${item.roundDay}-kunlik` : ""}</small>
          <div className="admin-file-filecell"><span className="admin-file-ext">{item.extension || "FAYL"}</span><FileName item={item} /></div>
          <div className="admin-file-actions admin-file-actions-mobile">
            {canPreview(item) && <button type="button" onClick={() => setPreview(item)}><Eye size={16} /> Online ko‘rish</button>}
            <a href={`/api/files?id=${encodeURIComponent(item.id)}`}><Download size={16} /> Yuklab olish</a>
          </div>
        </article>)}
      </div>

      <div className="admin-file-pagination">
        <span>{visibleFrom}–{visibleTo} / {total}</span>
        <div><button type="button" disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Oldingi</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Keyingi</button></div>
      </div>
    </>}

    {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
  </section>;
}
