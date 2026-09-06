import fs from 'node:fs';
import path from 'node:path';

function copyTemplate(template, relative) {
  const source = path.join(process.cwd(), template);
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
  console.log(`Created ${relative}`);
}

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`Patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`Patched ${relative}`);
}

copyTemplate('patch8.file-preview-modal.tsx.txt', 'components/file-preview-modal.tsx');
copyTemplate('patch8.admin-files-route.ts.txt', 'app/api/admin/files/route.ts');
copyTemplate('patch8.admin-file-archive.tsx.txt', 'components/admin-file-archive.tsx');
copyTemplate('patch8.institution-file-history.tsx.txt', 'components/institution-file-history.tsx');
copyTemplate('patch8.files-raw-route.ts.txt', 'app/api/files/raw/route.ts');

patchFile('lib/r2.ts', (text) => {
  if (text.includes('export async function getR2Object(key: string)')) return text;
  const anchor = 'export async function headR2Object(key: string) {';
  if (!text.includes(anchor)) throw new Error('r2 get object anchor not found');
  return text.replace(anchor, `export async function getR2Object(key: string) {\n  return getR2Client().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }));\n}\n\n${anchor}`);
});

const cssMarker = '/* PATCH8_MOBILE_PDF_AND_UX */';
patchFile('app/globals.css', (text) => {
  if (text.includes(cssMarker)) return text + '\n';
  return text + `

${cssMarker}
/* Universal file/name protection */
.wrap-cell, .institution-cell, .evaluation-order-link, .institution-submitted a { overflow-wrap: anywhere; word-break: break-word; }
.institution-file-picker { min-width: 0; }
.institution-file-picker > div { min-width: 0; max-width: 100%; }
.institution-file-picker strong { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.institution-submitted a { max-width: 100%; }

/* Admin archive v2 */
.admin-file-refresh, .institution-history-refresh { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--background); color: inherit; font-weight: 700; cursor: pointer; }
.admin-file-refresh:disabled, .institution-history-refresh:disabled { opacity: .55; cursor: default; }
.admin-file-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0 16px; }
.admin-file-stats > div { min-width: 0; padding: 13px 14px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--background) 95%, currentColor 5%); }
.admin-file-stats span { display: block; font-size: 12px; opacity: .7; margin-bottom: 5px; }
.admin-file-stats strong { display: block; font-size: 19px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-file-filters-v2 { display: grid; grid-template-columns: minmax(260px, 1.6fr) minmax(190px, 1fr) minmax(190px, 1fr) minmax(155px, .8fr); gap: 9px; align-items: stretch; }
.admin-file-filters-v2 .admin-file-search { grid-column: span 2; }
.admin-file-date-field { display: flex; align-items: center; gap: 7px; min-width: 0; border: 1px solid var(--border); border-radius: 10px; padding: 0 9px; background: var(--background); }
.admin-file-date-field span { flex: 0 0 auto; font-size: 12px; opacity: .65; }
.admin-file-date-field input { flex: 1 1 auto; min-width: 0; border: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }
.admin-file-active-filter { margin: -5px 0 12px; padding: 8px 10px; border-left: 3px solid currentColor; background: color-mix(in srgb, var(--background) 94%, currentColor 6%); border-radius: 0 8px 8px 0; font-size: 13px; }
.admin-file-filecell { display: flex; align-items: center; gap: 7px; min-width: 0; }
.admin-file-ext { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; min-width: 42px; min-height: 25px; padding: 3px 6px; border: 1px solid var(--border); border-radius: 7px; font-size: 10px; font-weight: 800; letter-spacing: .03em; opacity: .78; }
.admin-file-state { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
.admin-file-state > span { width: 100%; }
.admin-file-state button, .institution-history-state button { min-height: 38px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--background); color: inherit; font-weight: 700; cursor: pointer; }

/* In-site PDF / image viewer. This replaces Android's external PDF prompt. */
.kpi-file-preview-overlay { position: fixed; inset: 0; z-index: 12000; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(12, 15, 20, .76); backdrop-filter: blur(3px); }
.kpi-file-preview-modal { width: min(1180px, 97vw); height: min(900px, 94dvh); min-height: 420px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; border: 1px solid var(--border); border-radius: 15px; background: var(--background); color: inherit; box-shadow: 0 24px 80px rgba(0,0,0,.38); }
.kpi-file-preview-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-width: 0; padding: 11px 13px; border-bottom: 1px solid var(--border); }
.kpi-file-preview-title { min-width: 0; }
.kpi-file-preview-title strong, .kpi-file-preview-title span { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-file-preview-title strong { font-size: 16px; }
.kpi-file-preview-title span { margin-top: 3px; font-size: 12px; opacity: .68; }
.kpi-preview-close { flex: 0 0 auto; width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: inherit; cursor: pointer; }
.kpi-file-preview-body { min-width: 0; min-height: 0; overflow: hidden; background: #202226; }
.kpi-file-preview-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; padding: 9px 13px; border-top: 1px solid var(--border); }
.kpi-file-preview-foot a { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 9px; color: inherit; text-decoration: none; font-weight: 700; }
.kpi-preview-hint { min-width: 0; font-size: 12px; opacity: .65; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-pdf-viewer { width: 100%; height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.kpi-pdf-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: #2b2e33; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,.12); }
.kpi-pdf-page-controls, .kpi-pdf-zoom-controls { display: flex; align-items: center; gap: 7px; }
.kpi-pdf-toolbar button { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: rgba(255,255,255,.06); color: inherit; cursor: pointer; }
.kpi-pdf-toolbar button:disabled { opacity: .35; cursor: default; }
.kpi-pdf-toolbar strong, .kpi-pdf-toolbar span { min-width: 50px; text-align: center; font-size: 13px; }
.kpi-pdf-stage { position: relative; min-width: 0; min-height: 0; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 12px; background: #202226; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.kpi-pdf-canvas { display: block; flex: 0 0 auto; background: #fff; box-shadow: 0 4px 22px rgba(0,0,0,.35); }
.kpi-pdf-canvas.is-hidden { visibility: hidden; }
.kpi-preview-loading { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 9px; color: #e5e7eb; background: rgba(32,34,38,.72); }
.kpi-preview-error { width: min(520px, calc(100% - 28px)); margin: auto; align-self: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 22px; text-align: center; border: 1px solid rgba(255,255,255,.15); border-radius: 12px; color: #f8fafc; background: rgba(255,255,255,.05); }
.kpi-preview-error span { opacity: .78; font-size: 13px; overflow-wrap: anywhere; }
.kpi-preview-error button { min-height: 38px; padding: 7px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 9px; background: rgba(255,255,255,.08); color: inherit; font-weight: 700; cursor: pointer; }
.kpi-image-viewer { width: 100%; height: 100%; min-height: 0; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 14px; }
.kpi-image-viewer img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }

/* Institution file history */
.institution-history-card { margin-top: 16px; min-width: 0; }
.institution-history-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.institution-history-head > div { min-width: 0; }
.institution-history-head strong, .institution-history-head span { display: block; }
.institution-history-head strong { font-size: 16px; }
.institution-history-head span { margin-top: 4px; opacity: .72; font-size: 13px; }
.institution-history-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 13px 0; }
.institution-history-stats > div { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; }
.institution-history-stats span { display: block; font-size: 11px; opacity: .68; }
.institution-history-stats strong { display: block; margin-top: 3px; font-size: 18px; }
.institution-history-filters { display: grid; grid-template-columns: minmax(230px, 1.5fr) minmax(210px, 1fr) 165px auto; gap: 8px; margin-bottom: 13px; }
.institution-history-search { display: flex; align-items: center; gap: 7px; min-width: 0; border: 1px solid var(--border); border-radius: 10px; padding: 0 9px; }
.institution-history-search input { min-width: 0; width: 100%; border: 0 !important; outline: 0; background: transparent; }
.institution-history-filters select, .institution-history-filters > input, .institution-history-clear { min-height: 42px; width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--background); color: inherit; }
.institution-history-clear { display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-weight: 700; }
.institution-history-state { min-height: 86px; display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; text-align: center; border: 1px dashed var(--border); border-radius: 11px; padding: 16px; }
.institution-history-state > span { width: 100%; }
.institution-history-error { color: #b42318; }
.institution-history-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border); border-radius: 11px; }
.institution-history-table { width: 100%; min-width: 850px; border-collapse: collapse; }
.institution-history-table th, .institution-history-table td { padding: 10px 9px; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--border); }
.institution-history-table tr:last-child td { border-bottom: 0; }
.institution-history-table th { font-size: 11px; text-transform: uppercase; opacity: .68; }
.institution-history-criterion { display: -webkit-box; max-width: 330px; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
.institution-history-file { display: flex; align-items: flex-start; gap: 7px; min-width: 0; max-width: 300px; }
.institution-history-file svg { flex: 0 0 auto; margin-top: 1px; }
.institution-history-file span { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; line-height: 1.3; }
.institution-history-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.institution-history-actions button, .institution-history-actions a { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--background); color: inherit; text-decoration: none; font-weight: 700; cursor: pointer; }
.institution-history-mobile { display: none; }

@media (max-width: 1100px) {
  .admin-file-filters-v2 { grid-template-columns: 1fr 1fr; }
  .admin-file-filters-v2 .admin-file-search { grid-column: 1 / -1; }
  .institution-history-filters { grid-template-columns: 1fr 1fr; }
  .institution-history-search { grid-column: 1 / -1; }
}

@media (max-width: 760px) {
  [role="tablist"] { max-width: 100%; overflow-x: auto; overflow-y: hidden; flex-wrap: nowrap !important; justify-content: flex-start !important; -webkit-overflow-scrolling: touch; }
  [role="tab"] { flex: 0 0 auto !important; min-height: 42px; white-space: nowrap; }
  .admin-file-header, .institution-history-head { align-items: stretch; flex-direction: column; }
  .admin-file-refresh, .institution-history-refresh { width: 100%; }
  .admin-file-stats { grid-template-columns: 1fr 1fr; }
  .admin-file-filters-v2, .institution-history-filters { grid-template-columns: 1fr; }
  .admin-file-filters-v2 .admin-file-search, .institution-history-search { grid-column: auto; }
  .admin-file-date-field { min-height: 44px; }
  .admin-file-clear, .institution-history-clear { width: 100%; }
  .institution-history-stats { grid-template-columns: repeat(3, 1fr); }
  .institution-history-table-wrap { display: none; }
  .institution-history-mobile { display: grid; gap: 10px; }
  .institution-history-item { min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--background); }
  .institution-history-item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-size: 12px; opacity: .7; }
  .institution-history-item > strong { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; line-height: 1.35; }
  .institution-history-item > small { display: block; margin: 5px 0 9px; opacity: .68; }
  .institution-history-file { max-width: 100%; padding: 9px; border-radius: 9px; background: color-mix(in srgb, var(--background) 94%, currentColor 6%); }
  .institution-history-actions { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; }
  .institution-history-actions button, .institution-history-actions a { min-height: 44px; }

  .kpi-file-preview-overlay { padding: 0; align-items: stretch; }
  .kpi-file-preview-modal { width: 100vw; height: 100dvh; min-height: 100dvh; border: 0; border-radius: 0; }
  .kpi-file-preview-head { padding-top: max(9px, env(safe-area-inset-top)); }
  .kpi-file-preview-title strong { font-size: 14px; }
  .kpi-file-preview-foot { padding-bottom: max(9px, env(safe-area-inset-bottom)); }
  .kpi-preview-hint { display: none; }
  .kpi-file-preview-foot a { width: 100%; min-height: 46px; }
  .kpi-pdf-toolbar { flex-wrap: wrap; justify-content: center; padding: 6px; }
  .kpi-pdf-page-controls, .kpi-pdf-zoom-controls { flex: 1 1 auto; justify-content: center; }
  .kpi-pdf-toolbar button { width: 42px; height: 42px; }
  .kpi-pdf-stage { padding: 8px; }
}

@media (max-width: 460px) {
  .admin-file-stats { grid-template-columns: 1fr 1fr; gap: 7px; }
  .admin-file-stats > div { padding: 10px; }
  .admin-file-stats strong { font-size: 17px; }
  .institution-history-stats { gap: 6px; }
  .institution-history-stats > div { padding: 8px; }
  .institution-history-stats strong { font-size: 16px; }
  .institution-history-actions { grid-template-columns: 1fr; }
  .kpi-pdf-toolbar strong, .kpi-pdf-toolbar span { min-width: 42px; }
}
`;
});

console.log('PATCH8: mobile PDF viewer, admin archive UX and institution history improvements applied.');
