import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`Patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`Patched ${relative}`);
}

// The evaluator history was inserted inside the evaluation dialog. The generic
// responsible-card class inherits layout rules intended for another screen and
// can squeeze/overflow the modal. Give evaluator history its own neutral card.
patchFile('components/evaluator-institution-file-history.tsx', (text) => {
  const oldClass = 'className="responsible-card institution-history-card evaluator-history-card"';
  const newClass = 'className="institution-history-card evaluator-history-card"';
  if (!text.includes(oldClass)) {
    if (text.includes(newClass)) return text + '\n';
    throw new Error('Evaluator history card class anchor not found');
  }
  return text.replace(oldClass, newClass);
});

const marker = '/* PATCH11_EVALUATOR_HISTORY_DIALOG_FIX */';
patchFile('app/globals.css', (text) => {
  if (text.includes(marker)) return text + '\n';
  return text + `\n\n${marker}\n/* Desktop + mobile: evaluator file history inside evaluation modal */\n.evaluator-history-card {\n  display: block !important;\n  position: relative !important;\n  inset: auto !important;\n  grid-column: 1 / -1 !important;\n  width: 100% !important;\n  min-width: 0 !important;\n  max-width: 100% !important;\n  height: auto !important;\n  min-height: 0 !important;\n  margin: 14px 0 !important;\n  padding: 14px !important;\n  box-sizing: border-box !important;\n  border: 1px solid var(--border) !important;\n  border-radius: 14px !important;\n  background: var(--background) !important;\n  color: var(--foreground) !important;\n  overflow: hidden !important;\n  align-self: stretch !important;\n  flex: 0 0 auto !important;\n}\n.evaluator-history-card *, .evaluator-history-card *::before, .evaluator-history-card *::after { box-sizing: border-box; }\n.evaluator-history-card .institution-history-head,\n.evaluator-history-card .institution-history-stats,\n.evaluator-history-card .institution-history-filters,\n.evaluator-history-card .institution-history-state,\n.evaluator-history-card .institution-history-table-wrap,\n.evaluator-history-card .institution-history-mobile {\n  position: static !important;\n  inset: auto !important;\n  transform: none !important;\n  max-width: 100% !important;\n}\n.evaluator-history-card .institution-history-head { width: 100%; }\n.evaluator-history-card .institution-history-head > div { flex: 1 1 auto; min-width: 0; }\n.evaluator-history-card .institution-history-head strong,\n.evaluator-history-card .institution-history-head span { overflow-wrap: anywhere; word-break: normal; }\n.evaluator-history-card .institution-history-refresh { flex: 0 0 auto; white-space: nowrap; }\n.evaluator-history-card .institution-history-stats { width: 100%; }\n.evaluator-history-card .institution-history-filters { width: 100%; }\n.evaluator-history-card .institution-history-search,\n.evaluator-history-card .institution-history-filters select,\n.evaluator-history-card .institution-history-filters input,\n.evaluator-history-card .institution-history-clear { min-width: 0 !important; max-width: 100% !important; }\n.evaluator-history-card .institution-history-table-wrap { width: 100% !important; overflow-x: auto !important; }\n.evaluator-history-card .institution-history-table { width: 100% !important; }\n\n@media (min-width: 761px) {\n  .evaluator-history-card { max-height: min(58vh, 620px) !important; overflow-y: auto !important; }\n  .evaluator-history-card .institution-history-mobile { display: none !important; }\n  .evaluator-history-card .institution-history-table-wrap { display: block !important; }\n}\n\n@media (max-width: 760px) {\n  .evaluator-history-card {\n    margin: 10px 0 !important;\n    padding: 10px !important;\n    border-radius: 11px !important;\n    max-height: 64dvh !important;\n    overflow-y: auto !important;\n  }\n  .evaluator-history-card .institution-history-head { gap: 8px !important; }\n  .evaluator-history-card .institution-history-head strong { font-size: 14px !important; }\n  .evaluator-history-card .institution-history-head span { font-size: 11px !important; line-height: 1.35 !important; }\n  .evaluator-history-card .institution-history-refresh { min-height: 36px !important; padding: 6px 8px !important; font-size: 12px !important; }\n  .evaluator-history-card .institution-history-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 5px !important; margin: 9px 0 !important; }\n  .evaluator-history-card .institution-history-stats > div { padding: 7px !important; }\n  .evaluator-history-card .institution-history-stats span { font-size: 9px !important; }\n  .evaluator-history-card .institution-history-stats strong { font-size: 15px !important; }\n  .evaluator-history-card .institution-history-filters { display: grid !important; grid-template-columns: 1fr !important; gap: 7px !important; }\n  .evaluator-history-card .institution-history-search { grid-column: 1 !important; min-height: 40px !important; }\n  .evaluator-history-card .institution-history-table-wrap { display: none !important; }\n  .evaluator-history-card .institution-history-mobile { display: grid !important; gap: 8px !important; }\n  .evaluator-history-card .institution-history-item { min-width: 0 !important; padding: 10px !important; }\n  .evaluator-history-card .institution-history-file { max-width: 100% !important; }\n  .evaluator-history-card .institution-history-actions { display: grid !important; grid-template-columns: 1fr 1fr !important; width: 100% !important; }\n  .evaluator-history-card .institution-history-actions > * { width: 100% !important; min-width: 0 !important; }\n}\n`;
});

console.log('PATCH11: evaluator history dialog layout fixed for desktop and mobile.');
