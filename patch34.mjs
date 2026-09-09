import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'app/globals.css');
if (!fs.existsSync(cssPath)) throw new Error('PATCH34: app/globals.css not found');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* PATCH34_COMPACT_CRITERION_FILE_LIST */';

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.criterion-file-manager__list{max-height:410px;overflow-y:auto;overflow-x:hidden;padding-right:5px;scrollbar-gutter:stable}\n.criterion-file-manager__list::-webkit-scrollbar{width:7px}\n.criterion-file-manager__list::-webkit-scrollbar-track{background:#f3f7fa;border-radius:999px}\n.criterion-file-manager__list::-webkit-scrollbar-thumb{background:#bfd3e1;border-radius:999px}\n.criterion-file-manager__list::-webkit-scrollbar-thumb:hover{background:#9ebed3}\n@media(max-width:720px){.criterion-file-manager__list{max-height:360px;padding-right:3px}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH34: institution uploaded criterion files list is now compact and scrollable.');
} else {
  console.log('PATCH34: compact criterion file list style already present.');
}
