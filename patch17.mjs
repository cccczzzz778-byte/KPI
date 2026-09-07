import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'components/institution-portal.tsx');
if (!fs.existsSync(target)) {
  throw new Error('PATCH17: components/institution-portal.tsx not found.');
}

let text = fs.readFileSync(target, 'utf8');
const original = text;

text = text.replace(/\n?import\s+\{\s*InstitutionFileHistory\s*\}\s+from\s+["']@\/components\/institution-file-history["'];?\n?/g, '\n');
text = text.replace(/\s*<InstitutionFileHistory\s*\/>\s*/g, '\n      ');

if (text !== original) {
  fs.writeFileSync(target, text, 'utf8');
  console.log('PATCH17: removed uploaded file history from institution portal.');
} else {
  console.log('PATCH17: institution file history was already absent.');
}
