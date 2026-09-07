import fs from 'node:fs';
import path from 'node:path';

function copyTemplate(template, relative) {
  const source = path.join(process.cwd(), template);
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
  console.log(`Created ${relative}`);
}

function patchFile(relative, patcher, allowUnchanged = false) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) {
    if (allowUnchanged) {
      console.warn(`PATCH13: ${relative} was left unchanged.`);
      return;
    }
    throw new Error(`Patch did not change ${relative}`);
  }
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`Patched ${relative}`);
}

copyTemplate('patch13.evaluator-archive-route.ts.txt', 'app/api/evaluator/archive/route.ts');
copyTemplate('patch13.evaluator-reference-panel.tsx.txt', 'components/evaluator-reference-panel.tsx');

patchFile('components/kpi-app.tsx', (original) => {
  if (original.includes('<EvaluatorReferencePanel')) return original;

  let targetName = '';
  const candidates = ['EvaluatorPanel', 'EvaluatorDashboard', 'EvaluatorView'];
  for (const name of candidates) {
    if (original.includes(`<${name}`)) {
      targetName = name;
      break;
    }
  }

  if (!targetName) {
    const roleMatch = original.match(/session\.role\s*===\s*["']evaluator["'][\s\S]{0,1400}?<([A-Z][A-Za-z0-9_]*)\b/);
    const detected = roleMatch?.[1] || '';
    if (/Evaluator|Bahol|Assessment|Scoring/i.test(detected)) targetName = detected;
  }

  if (!targetName) {
    console.warn('PATCH13: evaluator panel invocation was not detected safely; current evaluator panel is preserved.');
    return original;
  }

  let text = original;
  const importLine = 'import { EvaluatorReferencePanel } from "@/components/evaluator-reference-panel";';
  if (!text.includes(importLine)) {
    if (text.includes('"use client";')) text = text.replace('"use client";', `"use client";\n\n${importLine}`);
    else if (text.includes("'use client';")) text = text.replace("'use client';", `'use client';\n\n${importLine}`);
    else {
      console.warn('PATCH13: kpi-app client directive was not found; current evaluator panel is preserved.');
      return original;
    }
  }

  text = text.replace(`<${targetName}`, '<EvaluatorReferencePanel');
  if (text.includes(`</${targetName}>`)) text = text.replace(`</${targetName}>`, '</EvaluatorReferencePanel>');
  console.log(`PATCH13: evaluator target detected as ${targetName}.`);
  return text;
}, true);

const cssMarker = '/* PATCH13_EVALUATOR_REFERENCE_PANEL */';
patchFile('app/globals.css', (text) => {
  if (text.includes(cssMarker)) return text + '\n';
  const css = fs.readFileSync(path.join(process.cwd(), 'patch13.evaluator-reference.css.txt'), 'utf8');
  return `${text}\n\n${css}\n`;
});

console.log('PATCH13: evaluator reference design assets prepared without risking the existing panel if its invocation cannot be identified safely.');
