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

copyTemplate('patch9.evaluator-files-route.ts.txt', 'app/api/evaluator/files/route.ts');
copyTemplate('patch9.evaluator-file-history.tsx.txt', 'components/evaluator-institution-file-history.tsx');

patchFile('components/kpi-app.tsx', (text) => {
  const importLine = 'import { EvaluatorInstitutionFileHistory } from "@/components/evaluator-institution-file-history";';
  if (!text.includes(importLine)) {
    if (text.includes('"use client";')) text = text.replace('"use client";', `"use client";\n\n${importLine}`);
    else text = `${importLine}\n${text}`;
  }

  const anchor = 'BUYRUQni ochish</a>}</div><div className="draft-total">';
  if (!text.includes(anchor)) throw new Error('Evaluator history dialog anchor not found');
  text = text.replace(
    anchor,
    'BUYRUQni ochish</a>}</div>{selectedInstitution && session.role === "evaluator" && <EvaluatorInstitutionFileHistory institutionId={selectedInstitution.id} />}<div className="draft-total">',
  );
  return text;
});

console.log('PATCH9: evaluator institution file history enabled.');
