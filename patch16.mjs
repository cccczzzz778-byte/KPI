import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH16 did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH16: patched ${relative}`);
}

patchFile('components/evaluator-reference-panel.tsx', (original) => {
  const start = original.indexOf('function ArchivePanel(');
  const end = original.indexOf('\nexport function EvaluatorReferencePanel', start);
  if (start < 0 || end < 0) throw new Error('PATCH16: ArchivePanel boundaries were not found.');

  const replacement = String.raw`function ArchivePanel({ roundDay }: { roundDay: number }) {
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
`;

  return original.slice(0, start) + replacement + original.slice(end);
});

const cssMarker = '/* PATCH16_EVALUATOR_MODERN_HISTORY */';
patchFile('app/globals.css', (original) => {
  if (original.includes(cssMarker)) return original + '\n';
  const css = String.raw`
/* PATCH16_EVALUATOR_MODERN_HISTORY */
.evaluator-reference-root{position:relative;overflow:hidden;border-radius:28px;padding:20px;background:radial-gradient(circle at 88% 2%,rgba(56,189,248,.18),transparent 28%),radial-gradient(circle at 4% 78%,rgba(59,130,246,.10),transparent 26%),linear-gradient(145deg,#f8fcff 0%,#edf7ff 48%,#f8fbff 100%)}
.evaluator-reference-root:before,.evaluator-reference-root:after{content:"";position:absolute;pointer-events:none;border-radius:999px;opacity:.65}.evaluator-reference-root:before{width:260px;height:260px;right:-120px;top:120px;background:linear-gradient(135deg,rgba(125,211,252,.26),rgba(167,243,208,.18))}.evaluator-reference-root:after{width:180px;height:180px;left:-100px;bottom:60px;background:linear-gradient(135deg,rgba(147,197,253,.18),rgba(196,181,253,.16))}
.evaluator-ref-banner,.evaluator-ref-main-card{position:relative;z-index:1}.evaluator-ref-banner{border:1px solid #d8e9f6!important;background:linear-gradient(100deg,rgba(255,255,255,.96),rgba(238,248,255,.95))!important;box-shadow:0 16px 38px rgba(30,64,175,.08)!important;border-radius:22px!important}.evaluator-ref-main-card{background:rgba(255,255,255,.74)!important;border:1px solid rgba(203,223,238,.9)!important;box-shadow:0 20px 50px rgba(15,71,116,.08)!important;border-radius:24px!important;backdrop-filter:blur(12px)}
.evaluator-modern-history{margin:16px;position:relative;z-index:2}.evaluator-modern-history-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 22px;border:1px solid #d7e9f6;border-radius:20px;background:linear-gradient(105deg,#fff 0%,#f2f9ff 58%,#e6f4ff 100%);box-shadow:0 12px 30px rgba(30,98,150,.08);overflow:hidden;position:relative}.evaluator-modern-history-hero:after{content:"";position:absolute;width:190px;height:190px;right:85px;top:-120px;border-radius:44px;transform:rotate(35deg);background:linear-gradient(135deg,rgba(96,165,250,.16),rgba(34,211,238,.05))}.evaluator-modern-history-title{display:flex;align-items:center;gap:14px;min-width:0;position:relative;z-index:1}.evaluator-modern-history-title>span{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(145deg,#d9efff,#edf7ff);color:#1477d4}.evaluator-modern-history-title div{display:grid;gap:4px}.evaluator-modern-history-title strong{font-size:24px;color:#0f2f5a;letter-spacing:-.02em}.evaluator-modern-history-title small{color:#6f86a2;font-size:13px}.evaluator-modern-round{color:#47739a;font-size:12px;font-weight:700;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.84);border:1px solid #d7e6f2;white-space:nowrap;position:relative;z-index:1}
.evaluator-modern-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0}.evaluator-modern-stats article{min-height:104px;border-radius:18px;border:1px solid #dceaf4;background:rgba(255,255,255,.95);display:flex;align-items:center;gap:14px;padding:17px 18px;box-shadow:0 10px 26px rgba(15,71,116,.06)}.evaluator-modern-stats article>span{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;flex:0 0 auto}.evaluator-modern-stats article>span svg{width:23px;height:23px}.evaluator-modern-stats article div{display:grid;gap:1px;min-width:0}.evaluator-modern-stats small{color:#66809b;font-size:12px}.evaluator-modern-stats strong{color:#0e2f5b;font-size:25px;line-height:1.1}.evaluator-modern-stats em{color:#93a5b8;font-size:10px;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.evaluator-modern-stats .is-blue>span{color:#1774e5;background:linear-gradient(145deg,#dbeafe,#eff6ff)}.evaluator-modern-stats .is-green>span{color:#0f9f66;background:linear-gradient(145deg,#d9fbe8,#effdf5)}.evaluator-modern-stats .is-violet>span{color:#7c3aed;background:linear-gradient(145deg,#ede9fe,#f7f5ff)}.evaluator-modern-stats .is-orange>span{color:#ea6a0a;background:linear-gradient(145deg,#ffead7,#fff5eb)}
.evaluator-modern-filterbar{display:grid;grid-template-columns:minmax(250px,1.25fr) minmax(190px,.8fr) minmax(170px,.7fr) auto;gap:12px;align-items:end;padding:16px;border:1px solid #dce9f3;border-radius:18px;background:rgba(255,255,255,.93);box-shadow:0 8px 24px rgba(15,71,116,.05);position:relative;z-index:5}.evaluator-modern-filter-group{display:grid;gap:6px;min-width:0;position:relative}.evaluator-modern-filter-group>label{color:#17385f;font-size:11px;font-weight:800}.evaluator-modern-searchbox,.evaluator-modern-date,.evaluator-modern-subfilter label{height:42px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:11px;border:1px solid #d5e4ef;background:#fbfdff;color:#6e89a5}.evaluator-modern-searchbox input,.evaluator-modern-date input,.evaluator-modern-subfilter input{width:100%;border:0;outline:0;background:transparent;color:#17385f;font:inherit;min-width:0}.evaluator-modern-filter-group select{height:42px;border-radius:11px;border:1px solid #d5e4ef;background:#fbfdff;color:#17385f;padding:0 11px;outline:0;width:100%}.evaluator-modern-filter-group select:disabled,.evaluator-modern-date input:disabled{opacity:.55;cursor:not-allowed}.evaluator-modern-suggestions{position:absolute;top:70px;left:0;right:0;padding:6px;border:1px solid #d5e4ef;border-radius:13px;background:#fff;box-shadow:0 18px 45px rgba(15,71,116,.16);max-height:300px;overflow:auto;z-index:30}.evaluator-modern-suggestions button{width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border:0;background:transparent;border-radius:9px;text-align:left;color:#17385f;cursor:pointer}.evaluator-modern-suggestions button:hover{background:#eff7ff;color:#0b6ed2}.evaluator-modern-filter-actions{display:flex;gap:8px}.evaluator-modern-filter-actions button,.evaluator-modern-detail-actions button,.evaluator-modern-detail-actions a{min-height:42px;border-radius:11px;border:1px solid #d3e2ee;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;color:#17385f;font-weight:800;text-decoration:none;cursor:pointer;white-space:nowrap}.evaluator-modern-filter-actions .is-primary,.evaluator-modern-detail-actions .is-primary{border-color:#147ee8;background:linear-gradient(135deg,#1d8df2,#136fdb);color:#fff;box-shadow:0 9px 20px rgba(37,120,225,.20)}.evaluator-modern-filter-actions button:disabled{opacity:.6;cursor:not-allowed}
.evaluator-modern-state,.evaluator-modern-empty{margin-top:14px;min-height:120px;border:1px dashed #cfe0ec;border-radius:17px;background:rgba(255,255,255,.78);display:flex;align-items:center;justify-content:center;gap:12px;color:#6b8198;text-align:left;padding:22px}.evaluator-modern-state.is-error{color:#a43b3b;border-color:#f3caca;background:#fff8f8}.evaluator-modern-empty>span{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;color:#1a7de0;background:#eaf5ff}.evaluator-modern-empty strong{color:#17385f;display:block;margin-bottom:3px}.evaluator-modern-empty p{margin:0;font-size:12px;max-width:580px}
.evaluator-modern-subfilter{margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid #dce9f3;border-radius:14px;background:rgba(255,255,255,.9)}.evaluator-modern-subfilter>div{min-width:0;display:grid;gap:2px}.evaluator-modern-subfilter strong{color:#17385f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.evaluator-modern-subfilter span{color:#7b91a8;font-size:11px}.evaluator-modern-subfilter label{width:min(330px,42vw)}.evaluator-modern-content-grid{display:grid;grid-template-columns:minmax(0,1.72fr) minmax(300px,.78fr);gap:14px;margin-top:12px}.evaluator-modern-list-card,.evaluator-modern-detail-card{min-width:0;border:1px solid #dbe9f3;border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 10px 28px rgba(15,71,116,.06);overflow:hidden}.evaluator-modern-card-head{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #e2edf5;background:linear-gradient(180deg,#fff,#f9fcff)}.evaluator-modern-card-head>div{display:flex;align-items:center;gap:8px;color:#123964}.evaluator-modern-card-head>div>span{font-size:10px;color:#1477d4;background:#e7f3ff;padding:4px 7px;border-radius:999px}.evaluator-modern-success{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;color:#0d8b58;background:#e8fbf2;border:1px solid #cef2df;padding:5px 8px;border-radius:999px}
.evaluator-modern-table-wrap{overflow:auto}.evaluator-modern-table-wrap table{width:100%;border-collapse:collapse;min-width:820px}.evaluator-modern-table-wrap th{padding:10px 11px;text-align:left;color:#6c839b;font-size:9px;letter-spacing:.02em;background:#f6faff;border-bottom:1px solid #e2edf5}.evaluator-modern-table-wrap td{padding:11px;color:#36536f;font-size:11px;border-bottom:1px solid #edf3f7;vertical-align:middle}.evaluator-modern-table-wrap tbody tr{cursor:pointer;transition:.15s ease}.evaluator-modern-table-wrap tbody tr:hover{background:#f5faff}.evaluator-modern-table-wrap tbody tr.is-selected{background:linear-gradient(90deg,#eaf5ff,#f5faff);box-shadow:inset 3px 0 0 #1682e8}.evaluator-modern-table-wrap td strong{color:#183b62}.evaluator-modern-file-name{display:inline-flex;align-items:center;gap:7px;color:#126fce;font-weight:700;max-width:210px}.evaluator-modern-pagination{display:flex;justify-content:center;gap:5px;padding:11px}.evaluator-modern-pagination button{width:29px;height:29px;border-radius:8px;border:1px solid #d4e3ef;background:#fff;color:#54718e;cursor:pointer}.evaluator-modern-pagination button.is-active{color:#fff;border-color:#1682e8;background:#1682e8}.evaluator-modern-pagination button:disabled{opacity:.4;cursor:not-allowed}
.evaluator-modern-detail-body{padding:15px}.evaluator-modern-file-hero{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid #e0ebf4;border-radius:13px;background:#fbfdff}.evaluator-modern-file-hero>span{width:47px;height:47px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#fee2e2,#fff1f1);color:#ef4444}.evaluator-modern-file-hero div{min-width:0;display:grid;gap:3px}.evaluator-modern-file-hero strong{color:#17385f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.evaluator-modern-file-hero small{color:#7990a7}.evaluator-modern-detail-body dl{display:grid;gap:0;margin:14px 0}.evaluator-modern-detail-body dl>div{display:grid;grid-template-columns:135px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px dashed #e5eef5}.evaluator-modern-detail-body dt{display:flex;align-items:center;gap:7px;color:#5c7590;font-size:11px}.evaluator-modern-detail-body dd{margin:0;color:#17385f;font-size:11px;font-weight:700;overflow-wrap:anywhere}.evaluator-modern-status-pill{display:inline-flex;padding:4px 8px;border-radius:999px;background:#e5faef;color:#078653;font-weight:800}.evaluator-modern-detail-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.evaluator-modern-detail-empty{min-height:260px;display:grid;place-items:center;color:#7d92a8;font-size:12px;padding:20px;text-align:center}.evaluator-ref-institutions{margin-top:18px!important}.evaluator-ref-institution{border-color:#dbe8f2!important;background:rgba(255,255,255,.92)!important;border-radius:16px!important;box-shadow:0 7px 18px rgba(15,71,116,.04)}
@media(max-width:1200px){.evaluator-modern-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.evaluator-modern-filterbar{grid-template-columns:1fr 1fr}.evaluator-modern-content-grid{grid-template-columns:1fr}}
@media(max-width:760px){.evaluator-reference-root{padding:10px;border-radius:18px}.evaluator-modern-history{margin:8px}.evaluator-modern-history-hero{padding:15px;align-items:flex-start}.evaluator-modern-history-title strong{font-size:18px}.evaluator-modern-history-title>span{width:44px;height:44px}.evaluator-modern-round{display:none}.evaluator-modern-stats{grid-template-columns:1fr 1fr;gap:8px}.evaluator-modern-stats article{min-height:86px;padding:12px;gap:9px}.evaluator-modern-stats article>span{width:40px;height:40px}.evaluator-modern-stats strong{font-size:20px}.evaluator-modern-filterbar{grid-template-columns:1fr;padding:12px}.evaluator-modern-filter-actions{display:grid;grid-template-columns:1fr 1fr}.evaluator-modern-subfilter{align-items:stretch;flex-direction:column}.evaluator-modern-subfilter label{width:100%}.evaluator-modern-detail-actions{grid-template-columns:1fr}.evaluator-modern-detail-body dl>div{grid-template-columns:1fr;gap:4px}}
@media(max-width:460px){.evaluator-modern-stats{grid-template-columns:1fr}}
`;
  return original + '\n\n' + css + '\n';
});

console.log('PATCH16: evaluator uploaded file history redesigned in the approved light-blue Buxoro style.');
