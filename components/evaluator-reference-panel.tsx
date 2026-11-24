"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  UploadCloud,
} from "lucide-react";
import { criteria as allCriteria } from "@/lib/kpi-data";
import { FilePreviewModal } from "@/components/file-preview-modal";

type AnyRecord = Record<string, any>;

type ArchiveItem = {
  id: string;
  institutionId: string;
  institutionName: string;
  criterionId: string;
  criterionTitle: string;
  roundDay: number | null;
  filename: string;
  contentType?: string;
  sizeBytes: number;
  source: string;
  sourceLabel: string;
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

function formatDate(item: ArchiveItem) {
  const raw = item.createdAt || item.submissionDate || "";
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeDate(item: ArchiveItem) {
  const raw = item.createdAt || item.submissionDate || "";
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function canPreview(item: ArchiveItem) {
  const type = String(item.contentType || "").toLowerCase();
  const name = String(item.filename || "").toLowerCase();
  return type === "application/pdf" || type.startsWith("image/") || /\.(pdf|jpe?g|png|webp|gif)$/i.test(name);
}

function commissionLabel(value: string) {
  const normalized = String(value || "").toLocaleLowerCase("uz");
  if (normalized.includes("raqam") || normalized.includes("digital") || normalized.includes("it")) return "Raqamlashtirish va IT infratuzilmasi";
  if (normalized.includes("moliya") || normalized.includes("xo‘jal") || normalized.includes("xojal")) return "Moliya-xo‘jalik va infratuzilma";
  if (normalized.includes("statsionar") || normalized.includes("stotsionar")) return "Stotsionar xizmat";
  if (normalized.includes("birlamchi")) return "Birlamchi xizmat";
  if (normalized.includes("ijro") || normalized.includes("kadr")) return "Ijro-intizom, murojaatlar va kadrlar";
  return value || "Baholash yo‘nalishi";
}

function shortDirection(value: string) {
  const full = commissionLabel(value);
  if (full.startsWith("Raqamlashtirish")) return "Raqamlashtirish";
  if (full.startsWith("Moliya")) return "Moliya va infratuzilma";
  if (full.startsWith("Stotsionar")) return "Stotsionar";
  if (full.startsWith("Birlamchi")) return "Birlamchi";
  if (full.startsWith("Ijro")) return "Ijro-intizom";
  return full;
}

function commissionKey(value: unknown) {
  const raw = String(value || "").trim().toLocaleLowerCase("uz");
  const normalized = raw
    .replace(/[ʻʼ’‘\`´']/g, "")
    .replace(/[^a-z0-9а-яёқғҳў]+/gi, " " )
    .replace(/\s+/g, " " )
    .trim();
  if (!normalized) return "";
  if (normalized === "infra" || normalized.includes("raqam") || normalized.includes("digital") || normalized.includes("it infratuz")) return "digital";
  if (normalized === "moliya" || normalized.includes("moliya") || normalized.includes("finance") || normalized.includes("xojal") || normalized.includes("xo jal")) return "finance";
  if (normalized === "sifat" || normalized.includes("statsionar") || normalized.includes("stotsionar") || normalized.includes("stationar")) return "stationary";
  if (normalized === "profil" || normalized.includes("birlamchi") || normalized.includes("primary")) return "primary";
  if (normalized === "ijro" || normalized.includes("ijro") || normalized.includes("kadr") || normalized.includes("murojaat")) return "exec";
  return normalized.replace(/\s+/g, "");
}

function ArchivePanel({ roundDay }: { roundDay: number }) {
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [selectedInstitutionName, setSelectedInstitutionName] = useState("");
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [date, setDate] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<ArchiveItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<ArchiveItem | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    const controller = new AbortController();
    setLoadingInstitutions(true);
    setError("");
    fetch("/api/evaluator/archive", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { institutions?: Array<{ id: string; name: string }>; error?: string };
        if (!response.ok) throw new Error(payload.error || "Muassasalar ro‘yxatini yuklab bo‘lmadi.");
        return payload.institutions || [];
      })
      .then(setInstitutions)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Muassasalarni yuklashda xatolik.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingInstitutions(false); });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedInstitutionId) {
      setItems([]);
      setSelectedFile(null);
      setPage(1);
      return;
    }
    const controller = new AbortController();
    setLoadingFiles(true);
    setError("");
    fetch("/api/evaluator/archive?institutionId=" + encodeURIComponent(selectedInstitutionId), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { institution?: { id: string; name: string }; items?: ArchiveItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Fayllar tarixini yuklab bo‘lmadi.");
        return payload;
      })
      .then((payload) => {
        const rows = payload.items || [];
        setItems(rows);
        if (payload.institution?.name) {
          setSelectedInstitutionName(payload.institution.name);
          setInstitutionQuery(payload.institution.name);
        }
        setSelectedFile(rows[0] || null);
        setPage(1);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Fayllarni yuklashda xatolik.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingFiles(false); });
    return () => controller.abort();
  }, [selectedInstitutionId, reloadKey]);

  const institutionSuggestions = useMemo(() => {
    const needle = institutionQuery.trim().toLocaleLowerCase("uz");
    if (!needle || selectedInstitutionId) return [];
    return institutions.filter((item) => item.name.toLocaleLowerCase("uz").includes(needle)).slice(0, 8);
  }, [institutions, institutionQuery, selectedInstitutionId]);

  const criteria = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      const key = item.source === "institution_order" ? "__order__" : String(item.criterionId || "");
      if (key) map.set(key, item.source === "institution_order" ? "BUYRUQ (chora-tadbir)" : item.criterionTitle);
    });
    return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, "uz"));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uz");
    return items.filter((item) => {
      const itemCriterion = item.source === "institution_order" ? "__order__" : String(item.criterionId || "");
      if (criterionId && itemCriterion !== criterionId) return false;
      if (date && normalizeDate(item) !== date) return false;
      if (!needle) return true;
      return item.criterionTitle.toLocaleLowerCase("uz").includes(needle)
        || cleanFilename(item.filename).toLocaleLowerCase("uz").includes(needle)
        || formatDate(item).includes(needle);
    });
  }, [items, query, criterionId, date]);

  useEffect(() => {
    setPage(1);
    if (filtered.length && (!selectedFile || !filtered.some((item) => item.id === selectedFile.id))) setSelectedFile(filtered[0]);
    if (!filtered.length) setSelectedFile(null);
  }, [query, criterionId, date, filtered.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const now = new Date();
  const today = String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const todayCount = items.filter((item) => normalizeDate(item) === today).length;
  const uniqueCriteria = new Set(items.map((item) => item.source === "institution_order" ? "BUYRUQ" : String(item.criterionId || item.criterionTitle))).size;

  function selectInstitution(item: { id: string; name: string }) {
    setSelectedInstitutionId(String(item.id));
    setSelectedInstitutionName(item.name);
    setInstitutionQuery(item.name);
    setCriterionId("");
    setDate("");
    setQuery("");
  }

  function clearSelection() {
    setSelectedInstitutionId("");
    setSelectedInstitutionName("");
    setInstitutionQuery("");
    setItems([]);
    setSelectedFile(null);
    setCriterionId("");
    setDate("");
    setQuery("");
    setPage(1);
  }

  function prettyDate(item: ArchiveItem) {
    const raw = item.createdAt || item.submissionDate || "";
    if (!raw) return "—";
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return String(parsed.getDate()).padStart(2, "0") + "." + String(parsed.getMonth() + 1).padStart(2, "0") + "." + String(parsed.getFullYear()) + " " + String(parsed.getHours()).padStart(2, "0") + ":" + String(parsed.getMinutes()).padStart(2, "0");
  }

  return <div className="evaluator-modern-history">
    <div className="evaluator-modern-history-hero">
      <div className="evaluator-modern-history-title"><span><FileText size={25} /></span><div><strong>Yuklangan fayllar tarixi</strong><small>Muassasalar tomonidan yuklangan fayllarni mezon, sana va yo‘nalish kesimida ko‘rish mumkin.</small></div></div>
      <span className="evaluator-modern-round">{roundDay}-kunlik nazorat</span>
    </div>

    <div className="evaluator-modern-stats">
      <article className="is-blue"><span><FileText /></span><div><small>Jami fayl</small><strong>{selectedInstitutionId ? items.length : "—"}</strong><em>{selectedInstitutionId ? "tanlangan muassasa" : "muassasa tanlang"}</em></div></article>
      <article className="is-green"><span><CalendarDays /></span><div><small>Bugun</small><strong>{selectedInstitutionId ? todayCount : "—"}</strong><em>bugun yuklangan</em></div></article>
      <article className="is-violet"><span><FolderOpen /></span><div><small>Mezonlar</small><strong>{selectedInstitutionId ? uniqueCriteria : "—"}</strong><em>faol mezonlar</em></div></article>
      <article className="is-orange"><span><Building2 /></span><div><small>Muassasalar</small><strong>{institutions.length}</strong><em>fayl yuklagan</em></div></article>
    </div>

    <div className="evaluator-modern-filterbar">
      <div className="evaluator-modern-filter-group evaluator-modern-institution-search">
        <label>Muassasa</label>
        <div className="evaluator-modern-searchbox"><Search size={18} /><input value={institutionQuery} onChange={(event) => { setInstitutionQuery(event.target.value); if (selectedInstitutionId) { setSelectedInstitutionId(""); setSelectedInstitutionName(""); setItems([]); setSelectedFile(null); } }} placeholder="Muassasa nomini kiriting..." /></div>
        {institutionSuggestions.length > 0 && <div className="evaluator-modern-suggestions">{institutionSuggestions.map((item) => <button key={item.id} type="button" onClick={() => selectInstitution(item)}><Building2 size={17} /><span>{item.name}</span></button>)}</div>}
      </div>
      <div className="evaluator-modern-filter-group"><label>Mezon</label><select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} disabled={!selectedInstitutionId}><option value="">Barcha mezonlar</option>{criteria.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
      <div className="evaluator-modern-filter-group"><label>Sana</label><div className="evaluator-modern-date"><CalendarDays size={17} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={!selectedInstitutionId} /></div></div>
      <div className="evaluator-modern-filter-actions"><button type="button" className="is-primary" onClick={() => setReloadKey((value) => value + 1)} disabled={loadingInstitutions || loadingFiles}><RefreshCw size={17} className={(loadingInstitutions || loadingFiles) ? "animate-spin" : ""} /> Yangilash</button><button type="button" onClick={clearSelection}>Tozalash</button></div>
    </div>

    {error && <div className="evaluator-modern-state is-error"><strong>Ma’lumotni yuklashda xatolik</strong><span>{error}</span></div>}
    {!error && !selectedInstitutionId && <div className="evaluator-modern-empty"><span><Search size={24} /></span><div><strong>Muassasani qidiring va tanlang</strong><p>Fayllar tarixi faqat tanlangan muassasa bo‘yicha ochiladi. Shu sabab sahifa ortiqcha uzun bo‘lib ketmaydi.</p></div></div>}
    {!error && selectedInstitutionId && loadingFiles && <div className="evaluator-modern-state"><RefreshCw className="animate-spin" size={20} /> {selectedInstitutionName || "Muassasa"} fayllari yuklanmoqda...</div>}
    {!error && selectedInstitutionId && !loadingFiles && <>
      <div className="evaluator-modern-subfilter"><div><strong>{selectedInstitutionName}</strong><span>{filtered.length} ta fayl topildi</span></div><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fayl yoki mezon nomi..." /></label></div>
      {filtered.length === 0 ? <div className="evaluator-modern-empty"><span><FolderOpen size={24} /></span><div><strong>Fayl topilmadi</strong><p>Tanlangan filtrlar bo‘yicha yuklangan fayl mavjud emas.</p></div></div> : <div className="evaluator-modern-content-grid">
        <section className="evaluator-modern-list-card">
          <div className="evaluator-modern-card-head"><div><FileText size={20} /><strong>Fayllar ro‘yxati</strong><span>{filtered.length} ta</span></div></div>
          <div className="evaluator-modern-table-wrap"><table><thead><tr><th>#</th><th>Sana</th><th>Muassasa</th><th>Mezon</th><th>Fayl nomi</th><th>Hajmi</th></tr></thead><tbody>{paged.map((item, index) => <tr key={item.id} className={selectedFile?.id === item.id ? "is-selected" : ""} onClick={() => setSelectedFile(item)}><td>{(page - 1) * pageSize + index + 1}</td><td>{prettyDate(item)}</td><td>{item.institutionName}</td><td><strong>{item.criterionTitle}</strong></td><td><span className="evaluator-modern-file-name"><FileText size={16} />{cleanFilename(item.filename)}</span></td><td>{formatBytes(Number(item.sizeBytes))}</td></tr>)}</tbody></table></div>
          {totalPages > 1 && <div className="evaluator-modern-pagination"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map((value) => <button type="button" key={value} className={page === value ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button>)}<button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>›</button></div>}
        </section>

        <aside className="evaluator-modern-detail-card">
          <div className="evaluator-modern-card-head"><div><FileText size={20} /><strong>Fayl ma’lumotlari</strong></div>{selectedFile && <span className="evaluator-modern-success"><CheckCircle2 size={15} /> Yuklangan</span>}</div>
          {selectedFile ? <div className="evaluator-modern-detail-body">
            <div className="evaluator-modern-file-hero"><span><FileText size={28} /></span><div><strong>{cleanFilename(selectedFile.filename)}</strong><small>{formatBytes(Number(selectedFile.sizeBytes))} · {selectedFile.contentType || "Fayl"}</small></div></div>
            <dl><div><dt><Building2 size={16} /> Muassasa:</dt><dd>{selectedFile.institutionName}</dd></div><div><dt><FolderOpen size={16} /> Mezon:</dt><dd>{selectedFile.criterionTitle}</dd></div><div><dt><CalendarDays size={16} /> Yuklangan sana:</dt><dd>{prettyDate(selectedFile)}</dd></div><div><dt><FileText size={16} /> Turi:</dt><dd>{selectedFile.source === "institution_order" ? "BUYRUQ (chora-tadbir)" : "Mezon fayli"}</dd></div><div><dt><CheckCircle2 size={16} /> Holat:</dt><dd><span className="evaluator-modern-status-pill">Yuklangan</span></dd></div></dl>
            <div className="evaluator-modern-detail-actions">{canPreview(selectedFile) && <button type="button" className="is-primary" onClick={() => setPreview(selectedFile)}><Eye size={17} /> Ko‘rish</button>}<a href={"/api/files?id=" + encodeURIComponent(selectedFile.id)}><Download size={17} /> Yuklab olish</a></div>
          </div> : <div className="evaluator-modern-detail-empty">Ko‘rish uchun jadvaldan faylni tanlang.</div>}
        </aside>
      </div>}
    </>}
    {preview && <FilePreviewModal file={preview as any} onClose={() => setPreview(null)} />}
  </div>;
}

export function EvaluatorReferencePanel(props: AnyRecord) {
  const data = props.data ?? props.dashboardData ?? props.dashboard ?? {};
  const session = data.session ?? {};
  /* PATCH80C_EVALUATOR */
  const [excludedInstitutionIds,setExcludedInstitutionIds]=useState<string[]>([]);
  useEffect(()=>{let alive=true;fetch("/api/applicability",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"x");if(alive)setExcludedInstitutionIds(Array.isArray(j.excludedInstitutionIds)?j.excludedInstitutionIds.map(String):[])}).catch(()=>{if(alive)setExcludedInstitutionIds([])});return()=>{alive=false}},[session.commission]);
  const roundDay = Number(props.selectedRound ?? props.roundDay ?? props.round ?? 10) || 10;
  const openEvaluation = props.onOpenEvaluation ?? props.openEvaluation ?? props.onEvaluate;
  const refresh = props.onRefresh ?? props.refresh;
  const direction = commissionLabel(String(session.commission || ""));
  const criteria = useMemo(() => { const key = commissionKey(session.commission); return allCriteria.filter((item: AnyRecord) => !key || commissionKey(item.commission) === key); }, [session.commission]);
  const criterionIds = useMemo(() => new Set(criteria.map((item: AnyRecord) => String(item.id))), [criteria]);
  const institutions = useMemo(() => (Array.isArray(data.institutions) ? data.institutions : []).filter((item: AnyRecord) => item.active !== false && item.active !== 0)
    .filter((item: AnyRecord) => !excludedInstitutionIds.includes(String(item.id))).slice().sort((a: AnyRecord, b: AnyRecord) => String(a.name).localeCompare(String(b.name), "uz")), [data.institutions]);
  const evaluations = Array.isArray(data.evaluations) ? data.evaluations : [];
  const dailyEvaluations = Array.isArray(data.dailyEvaluations) ? data.dailyEvaluations : [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;

    const loadFileCounts = async () => {
      try {
        const response = await fetch(`/api/evaluator/archive?mode=counts&roundDay=${encodeURIComponent(String(roundDay))}&_ts=${Date.now()}`, {
          cache: "no-store",
        });
        const payload = await response.json() as { counts?: Record<string, number> };
        if (!response.ok) throw new Error("Yuklangan mezonlar sonini yuklab bo‘lmadi.");
        if (active) setFileCounts(payload.counts || {});
      } catch {
        // Old values are kept on a temporary network error so visible counts do not jump to zero.
      }
    };

    void loadFileCounts();
    const timer = window.setInterval(() => { void loadFileCounts(); }, 5000);
    const onFocus = () => { void loadFileCounts(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void loadFileCounts(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roundDay, session.commission]);

  function institutionProgress(institutionId: string) {
    const rows = dailyEvaluations.filter((item: AnyRecord) => String(item.institutionId) === String(institutionId)
      && String(item.evaluationDate || "") === today
      && criterionIds.has(String(item.criterionId)));
    const done = new Set(rows.map((item: AnyRecord) => String(item.criterionId))).size;
    const total = criteria.length;
    return { done, total, percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0 };
  }

  return <div className="evaluator-reference-root">
    <section className="evaluator-ref-banner">
      <div><ClipboardCheck size={25} /><div><h2>Baholovchi ({direction})</h2><p>Faqat shu yo‘nalishdagi barcha baholash mezonlari ko‘rinadi <b>· 20 ball</b> <b>· Har bir mezon uchun majburiy izoh</b></p></div></div>
      <div className="evaluator-ref-upload-limit"><UploadCloud size={23} /><span><strong>30 MB</strong><small>har bir fayl uchun</small></span></div>
    </section>

    <section className="evaluator-ref-main-card">
      <div className="evaluator-ref-main-head"><div><ClipboardCheck size={21} /><strong>Baholash uchun muassasalar ({shortDirection(String(session.commission || ""))})</strong></div><div className="evaluator-ref-head-actions"><span>{roundDay}-kunlik nazorat</span>{typeof refresh === "function" && <button type="button" onClick={() => refresh()} title="Ma’lumotlarni yangilash"><RefreshCw size={16} /></button>}</div></div>
      <ArchivePanel roundDay={roundDay} />

      <div className="evaluator-ref-institutions">
        {institutions.length === 0 ? <div className="evaluator-ref-state">Baholash uchun faol muassasa topilmadi.</div> : institutions.map((institution: AnyRecord) => {
          const progress = institutionProgress(String(institution.id));
          return <article className="evaluator-ref-institution" key={institution.id}>
            <div className="evaluator-ref-building"><Building2 size={22} /></div>
            <div className="evaluator-ref-inst-name"><strong>{institution.name}</strong><span>{institution.district || institution.type || "Tibbiyot muassasasi"}</span></div>
            <div className="evaluator-ref-score"><strong>{progress.done} / {progress.total || criteria.length}</strong><span>Mezonlar</span></div>
            <div className="evaluator-ref-progress"><div><span style={{ width: `${progress.percent}%` }} /></div><small>{progress.percent}%</small></div>
            <div className="evaluator-ref-file-count"><FileText size={18} /><span><small>Yuklangan mezon</small><strong>{fileCounts[String(institution.id)] ?? 0} ta</strong></span></div>
            <div className="evaluator-ref-status">{progress.percent === 100 ? <CheckCircle2 size={18} /> : <CalendarDays size={18} />}<span><strong>{progress.percent === 100 ? "Baholash yakunlangan" : `Bugungi baholash`}</strong><small>{progress.percent === 100 ? "Barcha mezonlar" : "Baholash jarayoni"}</small></span></div>
            <button type="button" className="evaluator-ref-evaluate" onClick={() => { if (typeof openEvaluation === "function") openEvaluation(institution); }} disabled={typeof openEvaluation !== "function"}><ClipboardCheck size={17} /> Baholash <ArrowRight size={17} /></button>
          </article>;
        })}
      </div>
    </section>
  </div>;
}
