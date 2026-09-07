import fs from 'node:fs';
import path from 'node:path';

// Keep institution portal clean: file history is available to evaluators, not institution users.
const institutionPortal = path.join(process.cwd(), 'components/institution-portal.tsx');
if (!fs.existsSync(institutionPortal)) {
  throw new Error('PATCH17: components/institution-portal.tsx not found.');
}

let institutionText = fs.readFileSync(institutionPortal, 'utf8');
const institutionOriginal = institutionText;
institutionText = institutionText.replace(/\n?import\s+\{\s*InstitutionFileHistory\s*\}\s+from\s+["']@\/components\/institution-file-history["'];?\n?/g, '\n');
institutionText = institutionText.replace(/\s*<InstitutionFileHistory\s*\/>\s*/g, '\n      ');
if (institutionText !== institutionOriginal) {
  fs.writeFileSync(institutionPortal, institutionText, 'utf8');
  console.log('PATCH17: removed uploaded file history from institution portal.');
} else {
  console.log('PATCH17: institution file history was already absent.');
}

// Show only uploaded-criterion counts for the logged-in evaluator's own direction in each institution row.
const evaluatorPath = path.join(process.cwd(), 'components/evaluator-reference-panel.tsx');
if (!fs.existsSync(evaluatorPath)) {
  throw new Error('PATCH17: components/evaluator-reference-panel.tsx not found.');
}

let evaluator = fs.readFileSync(evaluatorPath, 'utf8');
if (!evaluator.includes('evaluator-ref-file-count')) {
  const evaluationsAnchor = '  const evaluations = Array.isArray(data.evaluations) ? data.evaluations : [];';
  if (!evaluator.includes(evaluationsAnchor)) {
    throw new Error('PATCH17: evaluator evaluations anchor not found.');
  }

  const fileCountLogic = `${evaluationsAnchor}\n  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});\n\n  useEffect(() => {\n    const controller = new AbortController();\n    fetch(\`/api/evaluator/archive?mode=counts&roundDay=\${encodeURIComponent(String(roundDay))}\`, {\n      cache: \"no-store\",\n      signal: controller.signal,\n    })\n      .then(async (response) => {\n        const payload = await response.json() as { counts?: Record<string, number> };\n        if (!response.ok) throw new Error(\"Yuklangan mezonlar sonini yuklab bo‘lmadi.\");\n        return payload.counts || {};\n      })\n      .then((counts) => { if (!controller.signal.aborted) setFileCounts(counts); })\n      .catch(() => { if (!controller.signal.aborted) setFileCounts({}); });\n    return () => controller.abort();\n  }, [roundDay, session.commission]);`;
  evaluator = evaluator.replace(evaluationsAnchor, fileCountLogic);

  const statusAnchor = '            <div className="evaluator-ref-status">';
  if (!evaluator.includes(statusAnchor)) {
    throw new Error('PATCH17: evaluator institution status anchor not found.');
  }
  evaluator = evaluator.replace(
    statusAnchor,
    `            <div className="evaluator-ref-file-count"><FileText size={18} /><span><small>Yuklangan mezon</small><strong>{fileCounts[String(institution.id)] ?? 0} ta</strong></span></div>\n${statusAnchor}`,
  );

  fs.writeFileSync(evaluatorPath, evaluator, 'utf8');
  console.log('PATCH17: evaluator institution rows now show uploaded-criterion counts only.');
} else {
  evaluator = evaluator.replaceAll('Yuklangan fayllar', 'Yuklangan mezon').replaceAll('Mezon fayllari', 'Yuklangan mezon');
  fs.writeFileSync(evaluatorPath, evaluator, 'utf8');
  console.log('PATCH17: evaluator uploaded-criterion count UI already present and label refreshed.');
}

const cssPath = path.join(process.cwd(), 'app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');
const cssMarker = '/* PATCH17_EVALUATOR_FILE_COUNTS */';
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.evaluator-ref-institution{grid-template-columns:48px minmax(230px,1.7fr) 80px minmax(160px,.75fr) 150px minmax(165px,.8fr) 150px}\n.evaluator-ref-file-count{min-height:46px;display:flex;align-items:center;gap:9px;padding:7px 11px;border:1px solid #dbeaf2;border-radius:10px;background:linear-gradient(135deg,#f4faff 0%,#eaf5ff 100%);color:#1577c8}\n.evaluator-ref-file-count>svg{flex:0 0 auto;color:#1679cf}\n.evaluator-ref-file-count>span{display:flex;flex-direction:column;gap:1px;min-width:0}\n.evaluator-ref-file-count small{font-size:9px;line-height:1.15;color:#7890aa;white-space:nowrap}\n.evaluator-ref-file-count strong{font-size:14px;line-height:1.2;color:#203f61}\n@media(max-width:1180px){.evaluator-ref-institution{grid-template-columns:44px minmax(200px,1.5fr) 70px minmax(140px,.75fr) 135px 140px}.evaluator-ref-file-count{min-height:42px;padding:6px 9px}}\n@media(max-width:900px){.evaluator-ref-file-count{grid-column:auto;min-width:118px}.evaluator-ref-file-count small{font-size:8px}.evaluator-ref-file-count strong{font-size:13px}}\n@media(max-width:580px){.evaluator-ref-file-count{min-width:106px;padding:6px 8px}.evaluator-ref-file-count>svg{width:16px;height:16px}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH17: evaluator uploaded-criterion count styling added.');
}
