import fs from 'node:fs';
import path from 'node:path';

function writeSource(relative, content) {
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  console.log(`PATCH15: wrote ${relative}`);
}

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH15 did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH15: patched ${relative}`);
}

// Evaluator history: load institution list first; fetch file history only for the selected institution.
writeSource('app/api/evaluator/archive/route.ts', String.raw`import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (session.role !== "evaluator") throw new AccessError("Bu bo‘lim faqat baholovchi uchun.", 403);

    const db = getKpiDatabase();
    const url = new URL(request.url);
    const institutionId = String(url.searchParams.get("institutionId") || "").trim();

    if (!institutionId) {
      const result = await db.pool.query(
        `SELECT DISTINCT i.id, i.name
           FROM institutions i
           JOIN attachments a ON a.institution_id = i.id
          WHERE i.active = 1
            AND a.source IN ('institution_submission', 'institution_order')
          ORDER BY i.name ASC`,
      );
      return Response.json({ institutions: result.rows }, { headers: { "cache-control": "no-store" } });
    }

    const institutionResult = await db.pool.query(
      `SELECT id, name FROM institutions WHERE id=$1 AND active=1 LIMIT 1`,
      [institutionId],
    );
    const institution = institutionResult.rows[0];
    if (!institution) throw new AccessError("Muassasa topilmadi.", 404);

    const result = await db.pool.query(
      `SELECT a.id,
              a.institution_id AS "institutionId",
              i.name AS "institutionName",
              a.criterion_id AS "criterionId",
              a.round_day AS "roundDay",
              a.filename,
              a.content_type AS "contentType",
              a.size_bytes AS "sizeBytes",
              a.source,
              TO_CHAR(a.submission_date, 'YYYY-MM-DD') AS "submissionDate",
              a.created_at AS "createdAt"
         FROM attachments a
         JOIN institutions i ON i.id = a.institution_id
        WHERE a.institution_id = $1
          AND i.active = 1
          AND a.source IN ('institution_submission', 'institution_order')
        ORDER BY a.created_at DESC
        LIMIT 5000`,
      [institutionId],
    );

    const items = result.rows.flatMap((row) => {
      if (row.source === "institution_order") {
        return [{ ...row, criterionTitle: "BUYRUQ (chora-tadbir)", sourceLabel: "BUYRUQ" }];
      }
      const criterion = criteria.find((item) => item.id === row.criterionId);
      if (!criterion || criterion.commission !== session.commission) return [];
      return [{ ...row, criterionTitle: criterion.title, sourceLabel: "Muassasa mezon fayli" }];
    });

    return Response.json({ institution, items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
`);

// Institution's own history must contain only files uploaded by that institution, not evaluator/admin attachments.
patchFile('app/api/institution/history/route.ts', (text) => {
  const anchor = '        WHERE institution_id = $1\n        ORDER BY created_at DESC`,';
  if (!text.includes(anchor)) throw new Error('PATCH15 institution history WHERE anchor not found');
  return text.replace(
    anchor,
    '        WHERE institution_id = $1\n          AND source IN (\'institution_submission\', \'institution_order\')\n        ORDER BY created_at DESC\n        LIMIT 5000`,',
  );
});

const componentPath = path.join(process.cwd(), 'components/evaluator-reference-panel.tsx');
let component = fs.readFileSync(componentPath, 'utf8');
const startMarker = 'function ArchivePanel({ roundDay }: { roundDay: number }) {';
const endMarker = 'export function EvaluatorReferencePanel';
const start = component.indexOf(startMarker);
const end = component.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) throw new Error('PATCH15 ArchivePanel boundaries not found');

const archivePanel = String.raw`function ArchivePanel({ roundDay }: { roundDay: number }) {
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [date, setDate] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<ArchiveItem | null>(null);

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

  const matchingInstitutions = useMemo(() => {
    const needle = institutionQuery.trim().toLocaleLowerCase("uz");
    if (!needle) return institutions.slice(0, 12);
    return institutions.filter((item) => item.name.toLocaleLowerCase("uz").includes(needle)).slice(0, 12);
  }, [institutions, institutionQuery]);

  const selectedInstitution = useMemo(
    () => institutions.find((item) => item.id === selectedInstitutionId) || null,
    [institutions, selectedInstitutionId],
  );

  useEffect(() => {
    if (!selectedInstitutionId) {
      setItems([]);
      setCriterionId("");
      setDate("");
      return;
    }
    const controller = new AbortController();
    setLoadingFiles(true);
    setError("");
    fetch("/api/evaluator/archive?institutionId=" + encodeURIComponent(selectedInstitutionId), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { items?: ArchiveItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Fayllar tarixini yuklab bo‘lmadi.");
        return payload.items || [];
      })
      .then(setItems)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Fayllarni yuklashda xatolik.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingFiles(false); });
    return () => controller.abort();
  }, [selectedInstitutionId, reloadKey]);

  const criteria = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (item.source !== "institution_order" && item.criterionId) map.set(item.criterionId, item.criterionTitle);
    });
    return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, "uz"));
  }, [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (criterionId && item.criterionId !== criterionId) return false;
    if (date && normalizeDate(item) !== date) return false;
    return true;
  }), [items, criterionId, date]);

  const selectInstitution = (item: { id: string; name: string }) => {
    setSelectedInstitutionId(item.id);
    setInstitutionQuery(item.name);
    setCriterionId("");
    setDate("");
  };

  const clearInstitution = () => {
    setSelectedInstitutionId("");
    setInstitutionQuery("");
    setItems([]);
    setCriterionId("");
    setDate("");
  };

  return <div className="evaluator-ref-archive evaluator-ref-archive-compact">
    <div className="evaluator-ref-section-head evaluator-ref-section-head-compact">
      <div className="evaluator-ref-title-with-icon"><FolderOpen size={20} /><div><strong>Muassasalar fayl yuklash tarixi</strong><span>Muassasani qidiring — tarix faqat tanlangandan keyin yuklanadi</span></div></div>
      <span className="evaluator-ref-round">{roundDay}-kunlik nazorat</span>
    </div>

    <div className="evaluator-ref-history-picker evaluator-ref-history-picker-v2">
      <div className="evaluator-ref-history-autocomplete">
        <label className="evaluator-ref-search evaluator-ref-history-search"><Search size={17} /><input value={institutionQuery} onChange={(event) => { setInstitutionQuery(event.target.value); if (selectedInstitution && event.target.value !== selectedInstitution.name) setSelectedInstitutionId(""); }} placeholder="Muassasa nomini yozing..." /></label>
        {!selectedInstitutionId && institutionQuery.trim() && <div className="evaluator-ref-history-suggestions">{matchingInstitutions.length ? matchingInstitutions.map((item) => <button type="button" key={item.id} onClick={() => selectInstitution(item)}><Building2 size={15} /><span>{item.name}</span></button>) : <div>Muassasa topilmadi.</div>}</div>}
      </div>
      {institutionQuery && <button type="button" className="evaluator-ref-history-clear" onClick={clearInstitution}>Tozalash</button>}
      <button type="button" className="evaluator-ref-refresh evaluator-ref-history-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={loadingInstitutions || loadingFiles} title="Tarixni yangilash"><RefreshCw size={17} className={loadingInstitutions || loadingFiles ? "animate-spin" : ""} /><span>Yangilash</span></button>
    </div>

    {loadingInstitutions ? <div className="evaluator-ref-history-empty"><RefreshCw className="animate-spin" size={18} /> Muassasalar yuklanmoqda...</div>
      : error && !selectedInstitutionId ? <div className="evaluator-ref-state is-error evaluator-ref-history-error"><strong>Tarix yuklanmadi</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Qayta urinish</button></div>
      : !selectedInstitution ? <div className="evaluator-ref-history-empty"><Building2 size={18} /><span>Muassasa nomini yozing va chiqadigan ro‘yxatdan tanlang.</span></div>
      : loadingFiles ? <div className="evaluator-ref-history-empty"><RefreshCw className="animate-spin" size={18} /> {selectedInstitution.name} fayllari yuklanmoqda...</div>
      : error ? <div className="evaluator-ref-state is-error evaluator-ref-history-error"><strong>Fayllar tarixi yuklanmadi</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Qayta urinish</button></div>
      : <>
        <div className="evaluator-ref-history-selected">
          <div><Building2 size={18} /><span><strong>{selectedInstitution.name}</strong><small>{items.length} ta yuklangan fayl</small></span></div>
          <div className="evaluator-ref-history-controls">
            <select value={criterionId} onChange={(event) => setCriterionId(event.target.value)} aria-label="Mezon filtri"><option value="">Barcha mezonlar</option>{criteria.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            <label className="evaluator-ref-date"><CalendarDays size={16} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          </div>
        </div>
        {filtered.length === 0 ? <div className="evaluator-ref-history-empty">Tanlangan muassasada fayl topilmadi.</div>
          : <>
            <div className="evaluator-ref-table-wrap evaluator-ref-history-table-wrap"><table className="evaluator-ref-table"><thead><tr><th>Sana</th><th>Mezon</th><th>Nazorat</th><th>Fayl</th><th>Hajm</th><th>Amal</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{formatDate(item)}</td><td><strong>{item.criterionTitle}</strong></td><td><span className={item.source === "institution_order" ? "evaluator-ref-chip is-order" : "evaluator-ref-chip"}>{item.roundDay ? String(item.roundDay) + "-kunlik" : item.source === "institution_order" ? "BUYRUQ" : "—"}</span></td><td><div className="evaluator-ref-file"><FileText size={17} />{cleanFilename(item.filename)}</div></td><td>{formatBytes(Number(item.sizeBytes))}</td><td><div className="evaluator-ref-actions">{canPreview(item) && <button type="button" onClick={() => setPreview(item)}><Eye size={16} /> Ko‘rish</button>}<a href={"/api/files?id=" + encodeURIComponent(item.id)}><Download size={16} /> Yuklash</a></div></td></tr>)}</tbody></table></div>
            <div className="evaluator-ref-mobile-files evaluator-ref-history-mobile-files">{filtered.map((item) => <article key={item.id}><div><strong>{item.criterionTitle}</strong></div><div className="evaluator-ref-file"><FileText size={16} />{cleanFilename(item.filename)}</div><small>{formatDate(item)} · {item.roundDay ? String(item.roundDay) + "-kunlik" : item.source === "institution_order" ? "BUYRUQ" : "—"} · {formatBytes(Number(item.sizeBytes))}</small><div className="evaluator-ref-actions">{canPreview(item) && <button type="button" onClick={() => setPreview(item)}><Eye size={16} /> Ko‘rish</button>}<a href={"/api/files?id=" + encodeURIComponent(item.id)}><Download size={16} /> Yuklash</a></div></article>)}</div>
          </>}
      </>}
    {preview && <FilePreviewModal file={preview as any} onClose={() => setPreview(null)} />}
  </div>;
}

`;

component = component.slice(0, start) + archivePanel + component.slice(end);
fs.writeFileSync(componentPath, component, 'utf8');
console.log('PATCH15: evaluator institution upload history now loads per selected institution.');

const cssPath = path.join(process.cwd(), 'app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');
const cssMarker = '/* PATCH15_INSTITUTION_UPLOAD_HISTORY */';
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.evaluator-ref-history-autocomplete{position:relative;min-width:0}\n.evaluator-ref-history-suggestions{position:absolute;left:0;right:0;top:44px;z-index:30;max-height:280px;overflow:auto;border:1px solid #d7e3e9;border-radius:10px;background:#fff;box-shadow:0 12px 30px rgba(42,72,96,.16);padding:5px}\n.evaluator-ref-history-suggestions button{width:100%;display:flex;align-items:center;gap:8px;border:0;border-radius:7px;background:transparent;padding:9px 10px;text-align:left;color:#425a73;cursor:pointer;font-size:12px}\n.evaluator-ref-history-suggestions button:hover{background:#eef8fb;color:#058aa8}\n.evaluator-ref-history-suggestions button span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.evaluator-ref-history-suggestions>div{padding:10px;color:#7c8da1;font-size:12px;text-align:center}\n.institution-history-table-wrap{max-height:360px;overflow:auto}\n.institution-history-table th{position:sticky;top:0;z-index:1;background:var(--background)}\n@media(max-width:900px){.evaluator-ref-history-picker-v2{grid-template-columns:1fr auto}.evaluator-ref-history-autocomplete{grid-column:1/-1}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH15: history CSS added.');
}
