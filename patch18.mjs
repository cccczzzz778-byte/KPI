import fs from 'node:fs';
import path from 'node:path';

const archiveSource = fs.readFileSync(path.join(process.cwd(), 'patch18.evaluator-archive-route.ts.txt'), 'utf8');
const archiveTarget = path.join(process.cwd(), 'app/api/evaluator/archive/route.ts');
fs.mkdirSync(path.dirname(archiveTarget), { recursive: true });
fs.writeFileSync(archiveTarget, archiveSource, 'utf8');
console.log('PATCH18: evaluator archive route rewritten with robust commission matching and real upload counts.');

const helper = `function commissionKey(value: unknown) {\n  const raw = String(value || \"\").trim().toLocaleLowerCase(\"uz\");\n  const normalized = raw\n    .replace(/[ʻʼ’‘\\\`´']/g, \"\")\n    .replace(/[^a-z0-9а-яёқғҳў]+/gi, \" \" )\n    .replace(/\\s+/g, \" \" )\n    .trim();\n  if (!normalized) return \"\";\n  if (normalized === \"infra\" || normalized.includes(\"raqam\") || normalized.includes(\"digital\") || normalized.includes(\"it infratuz\")) return \"digital\";\n  if (normalized === \"moliya\" || normalized.includes(\"moliya\") || normalized.includes(\"finance\") || normalized.includes(\"xojal\") || normalized.includes(\"xo jal\")) return \"finance\";\n  if (normalized === \"sifat\" || normalized.includes(\"statsionar\") || normalized.includes(\"stotsionar\") || normalized.includes(\"stationar\")) return \"stationary\";\n  if (normalized === \"profil\" || normalized.includes(\"birlamchi\") || normalized.includes(\"primary\")) return \"primary\";\n  if (normalized === \"ijro\" || normalized.includes(\"ijro\") || normalized.includes(\"kadr\") || normalized.includes(\"murojaat\")) return \"exec\";\n  return normalized.replace(/\\s+/g, \"\");\n}\n`;

function ensureHelper(file) {
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes('function commissionKey(value: unknown)')) {
    const anchor = 'export const runtime = "nodejs";';
    if (text.includes(anchor)) {
      text = text.replace(anchor, `${anchor}\n\n${helper}`);
      fs.writeFileSync(file, text, 'utf8');
    }
  }
}

const panelPath = path.join(process.cwd(), 'components/evaluator-reference-panel.tsx');
if (fs.existsSync(panelPath)) {
  let panel = fs.readFileSync(panelPath, 'utf8');
  if (!panel.includes('function commissionKey(value: unknown)')) {
    const anchor = 'function ArchivePanel({ roundDay }: { roundDay: number }) {';
    if (!panel.includes(anchor)) throw new Error('PATCH18: evaluator ArchivePanel anchor not found.');
    panel = panel.replace(anchor, `${helper}\n${anchor}`);
  }
  panel = panel.replace(
    'const criteria = useMemo(() => allCriteria.filter((item: AnyRecord) => !session.commission || item.commission === session.commission), [session.commission]);',
    'const criteria = useMemo(() => { const key = commissionKey(session.commission); return allCriteria.filter((item: AnyRecord) => !key || commissionKey(item.commission) === key); }, [session.commission]);',
  );
  fs.writeFileSync(panelPath, panel, 'utf8');
  console.log('PATCH18: evaluator panel commission matching normalized.');
}

for (const relative of ['app/api/files/route.ts', 'app/api/files/raw/route.ts', 'app/api/evaluator/files/route.ts']) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) continue;
  ensureHelper(target);
  let text = fs.readFileSync(target, 'utf8');
  const before = text;
  text = text.replaceAll('criterion?.commission !== session.commission', 'commissionKey(criterion?.commission) !== commissionKey(session.commission)');
  text = text.replaceAll('criterion.commission !== session.commission', 'commissionKey(criterion.commission) !== commissionKey(session.commission)');
  if (text !== before) fs.writeFileSync(target, text, 'utf8');
  console.log(`PATCH18: checked ${relative} evaluator commission access.`);
}

console.log('PATCH18: institution-upload visibility fix applied.');
