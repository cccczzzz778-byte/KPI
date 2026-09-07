import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'components/kpi-app.tsx');
let text = fs.readFileSync(target, 'utf8');

const importLine = 'import { EvaluatorInstitutionFileHistory } from "@/components/evaluator-institution-file-history";';
const historyBlock = '{selectedInstitution && session.role === "evaluator" && <EvaluatorInstitutionFileHistory institutionId={selectedInstitution.id} />}';

if (!text.includes(historyBlock)) {
  throw new Error('Evaluator uploaded file history block not found');
}

text = text.replace(historyBlock, '');
text = text.replace(`${importLine}\n\n`, '');
text = text.replace(`${importLine}\n`, '');
text = text.replace(importLine, '');

fs.writeFileSync(target, text, 'utf8');
console.log('PATCH12: evaluator uploaded file history removed from panel.');
