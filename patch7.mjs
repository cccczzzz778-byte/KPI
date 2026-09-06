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

copyTemplate('patch7.admin-files-route.ts.txt', 'app/api/admin/files/route.ts');
copyTemplate('patch7.admin-file-archive.tsx.txt', 'components/admin-file-archive.tsx');

patchFile('components/kpi-app.tsx', (text) => {
  if (!text.includes('AdminFileArchive')) {
    const importLine = 'import { AdminFileArchive } from "@/components/admin-file-archive";';
    if (text.includes('"use client";')) text = text.replace('"use client";', '"use client";\n\n' + importLine);
    else if (text.includes("'use client';")) text = text.replace("'use client';", "'use client';\n\n" + importLine);
    else throw new Error('kpi-app use client anchor not found');
  }

  const tabAnchor = '<TabsTrigger value="orders"><Paperclip /> Yuklangan BUYRUQLAR</TabsTrigger><TabsTrigger value="evaluations"><ClipboardCheck /> Baholar va asoslar</TabsTrigger>';
  if (!text.includes(tabAnchor)) throw new Error('admin file tab trigger anchor not found');
  text = text.replace(tabAnchor, '<TabsTrigger value="orders"><Paperclip /> Yuklangan BUYRUQLAR</TabsTrigger><TabsTrigger value="files">📂 Yuklangan fayllar</TabsTrigger><TabsTrigger value="evaluations"><ClipboardCheck /> Baholar va asoslar</TabsTrigger>');

  const contentAnchor = '</TabsContent><TabsContent value="evaluations" className="panel-content"><Table>';
  if (!text.includes(contentAnchor)) throw new Error('admin file content anchor not found');
  text = text.replace(contentAnchor, '</TabsContent><TabsContent value="files" className="panel-content"><AdminFileArchive /></TabsContent><TabsContent value="evaluations" className="panel-content"><Table>');
  return text;
});

patchFile('lib/r2.ts', (text) => {
  const oldSignature = 'export async function createR2DownloadUrl(input: { key: string; filename?: string; contentType?: string; expiresIn?: number }) {';
  const newSignature = 'export async function createR2DownloadUrl(input: { key: string; filename?: string; contentType?: string; download?: boolean; expiresIn?: number }) {';
  if (!text.includes(oldSignature)) throw new Error('r2 download signature anchor not found');
  text = text.replace(oldSignature, newSignature);

  const oldDisposition = `"attachment; filename=\\\"" + asciiName + "\\\"; filename*=UTF-8''" + encodeURIComponent(input.filename)`;
  const newDisposition = `(input.download === false ? "inline" : "attachment") + "; filename=\\\"" + asciiName + "\\\"; filename*=UTF-8''" + encodeURIComponent(input.filename)`;
  if (!text.includes(oldDisposition)) throw new Error('r2 disposition anchor not found');
  text = text.replace(oldDisposition, newDisposition);
  return text;
});

patchFile('app/api/files/route.ts', (text) => {
  const oldLine = '    const signedUrl = await createR2DownloadUrl({ key: row.objectKey, filename: row.filename, contentType: row.contentType, expiresIn: 5 * 60 });';
  const newLine = '    const viewInline = new URL(request.url).searchParams.get("view") === "1";\n    const signedUrl = await createR2DownloadUrl({ key: row.objectKey, filename: row.filename, contentType: row.contentType, download: !viewInline, expiresIn: 5 * 60 });';
  if (!text.includes(oldLine)) throw new Error('files inline preview anchor not found');
  return text.replace(oldLine, newLine);
});

const responsiveCss = `
/* PATCH7_RESPONSIVE_ADMIN_FILES */
html, body { max-width: 100%; overflow-x: hidden; }
img, video, canvas, iframe { max-width: 100%; }
input, select, textarea, button { max-width: 100%; }
.panel-content, .responsible-card { min-width: 0; }
.wrap-cell, .institution-cell { overflow-wrap: anywhere; word-break: break-word; }
.admin-file-archive { min-width: 0; width: 100%; }
.admin-file-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.admin-file-header h3 { margin: 0 0 4px; font-size: 20px; }
.admin-file-header p { margin: 0; opacity: .72; }
.admin-file-count { flex: 0 0 auto; font-weight: 800; padding: 7px 10px; border: 1px solid var(--border); border-radius: 999px; }
.admin-file-filters { display: grid; grid-template-columns: minmax(220px, 1.6fr) minmax(180px, 1.2fr) minmax(150px, .8fr) minmax(160px, .9fr) auto; gap: 10px; margin-bottom: 16px; align-items: stretch; }
.admin-file-filters input, .admin-file-filters select, .admin-file-clear { width: 100%; min-height: 42px; border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; background: var(--background); color: inherit; }
.admin-file-search { display: flex; align-items: center; gap: 8px; min-width: 0; border: 1px solid var(--border); border-radius: 10px; padding: 0 10px; background: var(--background); }
.admin-file-search input { border: 0; outline: 0; padding-left: 0; min-width: 0; }
.admin-file-clear { display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-weight: 700; }
.admin-file-state { padding: 26px 14px; text-align: center; border: 1px dashed var(--border); border-radius: 12px; }
.admin-file-error { color: #b42318; }
.admin-file-desktop-table { width: 100%; overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
.admin-file-desktop-table table { width: 100%; min-width: 980px; border-collapse: collapse; }
.admin-file-desktop-table th, .admin-file-desktop-table td { text-align: left; vertical-align: middle; padding: 10px 11px; border-bottom: 1px solid var(--border); }
.admin-file-desktop-table tbody tr:last-child td { border-bottom: 0; }
.admin-file-desktop-table th { font-size: 12px; opacity: .72; text-transform: uppercase; letter-spacing: .03em; }
.admin-file-institution { display: block; max-width: 260px; line-height: 1.35; }
.admin-file-criterion { display: -webkit-box; max-width: 300px; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35; }
.admin-file-desktop-table small, .admin-file-card small { display: block; margin-top: 4px; opacity: .68; }
.admin-file-name-wrap { display: flex; align-items: flex-start; gap: 7px; min-width: 0; max-width: 320px; }
.admin-file-icon { flex: 0 0 auto; margin-top: 2px; opacity: .7; }
.admin-file-name { display: -webkit-box; min-width: 0; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; word-break: break-word; line-height: 1.35; }
.admin-file-size, .admin-file-date { white-space: nowrap; }
.admin-file-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.admin-file-actions button, .admin-file-actions a, .admin-file-preview-foot a { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--background); color: inherit; text-decoration: none; font-weight: 700; cursor: pointer; white-space: nowrap; }
.admin-file-mobile-list { display: none; }
.admin-file-pagination { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; }
.admin-file-pagination > div { display: flex; align-items: center; gap: 9px; }
.admin-file-pagination button { min-height: 38px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--background); color: inherit; cursor: pointer; }
.admin-file-pagination button:disabled { opacity: .45; cursor: default; }
.admin-file-preview-backdrop { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0,0,0,.62); }
.admin-file-preview-modal { width: min(1180px, 96vw); height: min(900px, 92vh); display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; background: var(--background); color: inherit; border-radius: 14px; box-shadow: 0 20px 70px rgba(0,0,0,.32); }
.admin-file-preview-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.admin-file-preview-head > div { min-width: 0; }
.admin-file-preview-head strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 980px; }
.admin-file-preview-head span { display: block; margin-top: 3px; font-size: 12px; opacity: .7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-file-preview-head button { flex: 0 0 auto; width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 9px; background: transparent; color: inherit; cursor: pointer; }
.admin-file-preview-modal iframe { width: 100%; height: 100%; border: 0; background: #fff; }
.admin-file-preview-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); }
@media (max-width: 980px) {
  [role="tablist"] { max-width: 100%; overflow-x: auto; overflow-y: hidden; flex-wrap: nowrap !important; justify-content: flex-start !important; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
  [role="tab"] { flex: 0 0 auto !important; white-space: nowrap; }
  .panel-content { min-width: 0; overflow-x: auto; }
  .admin-file-filters { grid-template-columns: 1fr 1fr; }
  .admin-file-search { grid-column: 1 / -1; }
  .admin-file-clear { width: auto; }
}
@media (max-width: 700px) {
  input, select, textarea { font-size: 16px !important; }
  .panel-content { padding-left: 8px !important; padding-right: 8px !important; }
  .responsible-card { padding: 12px !important; }
  .admin-file-header { align-items: stretch; flex-direction: column; gap: 10px; }
  .admin-file-header h3 { font-size: 18px; }
  .admin-file-count { align-self: flex-start; }
  .admin-file-filters { grid-template-columns: 1fr; gap: 8px; }
  .admin-file-search { grid-column: auto; }
  .admin-file-desktop-table { display: none; }
  .admin-file-mobile-list { display: grid; gap: 10px; }
  .admin-file-card { min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--background); }
  .admin-file-card-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-size: 12px; opacity: .72; }
  .admin-file-card-institution { display: block; line-height: 1.35; margin-bottom: 7px; overflow-wrap: anywhere; }
  .admin-file-card-criterion { line-height: 1.4; margin-bottom: 2px; }
  .admin-file-card .admin-file-name-wrap { max-width: 100%; margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--border); }
  .admin-file-actions-mobile { margin-top: 11px; }
  .admin-file-actions-mobile > * { flex: 1 1 140px; min-height: 42px !important; }
  .admin-file-pagination { align-items: stretch; flex-direction: column; }
  .admin-file-pagination > div { width: 100%; justify-content: space-between; }
  .admin-file-pagination button { flex: 1; }
  .admin-file-preview-backdrop { padding: 0; }
  .admin-file-preview-modal { width: 100vw; height: 100dvh; max-width: none; max-height: none; border-radius: 0; }
  .admin-file-preview-head { padding: 10px; }
  .admin-file-preview-head strong { max-width: calc(100vw - 70px); }
  .admin-file-preview-head span { max-width: calc(100vw - 70px); }
  .admin-file-preview-foot { padding: 8px 10px; }
  .admin-file-preview-foot a { flex: 1; min-height: 42px; }
  [role="dialog"] { max-width: calc(100vw - 10px) !important; max-height: 96dvh !important; }
}
`;

const cssCandidates = ['app/globals.css', 'styles/globals.css'];
const cssPath = cssCandidates.find((relative) => fs.existsSync(path.join(process.cwd(), relative)));
if (cssPath) {
  const target = path.join(process.cwd(), cssPath);
  const text = fs.readFileSync(target, 'utf8');
  if (!text.includes('PATCH7_RESPONSIVE_ADMIN_FILES')) {
    fs.writeFileSync(target, text + responsiveCss, 'utf8');
    console.log(`Patched ${cssPath}`);
  }
}

console.log('Admin file archive, online preview and responsive layout patch applied.');
