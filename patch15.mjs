import fs from 'node:fs';
import path from 'node:path';

function copyTemplate(template, relative) {
  const source = path.join(process.cwd(), template);
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
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

copyTemplate('patch15.evaluator-archive-route.ts.txt', 'app/api/evaluator/archive/route.ts');

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
const archivePanel = fs.readFileSync(path.join(process.cwd(), 'patch15.archive-panel.txt'), 'utf8');
component = component.slice(0, start) + archivePanel + component.slice(end);
fs.writeFileSync(componentPath, component, 'utf8');
console.log('PATCH15: evaluator institution upload history now loads per selected institution.');

const cssPath = path.join(process.cwd(), 'app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');
const cssMarker = '/* PATCH15_INSTITUTION_UPLOAD_HISTORY */';
if (!css.includes(cssMarker)) {
  css += '\n\n' + fs.readFileSync(path.join(process.cwd(), 'patch15.history.css.txt'), 'utf8') + '\n';
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH15: history CSS added.');
}
