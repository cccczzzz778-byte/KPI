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

copyTemplate('patch13.evaluator-archive-route.ts.txt', 'app/api/evaluator/archive/route.ts');
copyTemplate('patch13.evaluator-reference-panel.tsx.txt', 'components/evaluator-reference-panel.tsx');

patchFile('components/kpi-app.tsx', (text) => {
  const importLine = 'import { EvaluatorReferencePanel } from "@/components/evaluator-reference-panel";';
  if (!text.includes(importLine)) {
    if (text.includes('"use client";')) text = text.replace('"use client";', `"use client";\n\n${importLine}`);
    else if (text.includes("'use client';")) text = text.replace("'use client';", `'use client';\n\n${importLine}`);
    else throw new Error('kpi-app use client anchor not found');
  }

  if (text.includes('<EvaluatorReferencePanel')) return text;

  const candidates = ['EvaluatorPanel', 'EvaluatorDashboard', 'EvaluatorView'];
  let replaced = false;
  for (const name of candidates) {
    const anchor = `<${name}`;
    if (!text.includes(anchor)) continue;
    text = text.replace(anchor, '<EvaluatorReferencePanel');
    replaced = true;
    break;
  }
  if (!replaced) throw new Error('Evaluator panel invocation not found');
  return text;
});

const cssMarker = '/* PATCH13_EVALUATOR_REFERENCE_PANEL */';
patchFile('app/globals.css', (text) => {
  if (text.includes(cssMarker)) return text + '\n';
  const css = fs.readFileSync(path.join(process.cwd(), 'patch13.evaluator-reference.css.txt'), 'utf8');
  return `${text}\n\n${css}\n`;
});

console.log('PATCH13: evaluator panel redesigned from supplied reference while preserving evaluation callbacks.');
