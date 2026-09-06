import fs from 'node:fs';
import path from 'node:path';

const candidates = [
  path.join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
  path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
];
const source = candidates.find((item) => fs.existsSync(item));
if (!source) {
  throw new Error('pdfjs-dist worker topilmadi. pdfjs-dist dependency o‘rnatilganini tekshiring.');
}
const target = path.join(process.cwd(), 'public/pdf.worker.min.mjs');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('PDF.js worker copied to public/pdf.worker.min.mjs');
