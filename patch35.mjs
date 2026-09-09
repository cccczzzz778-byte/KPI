import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'app/globals.css');
if (!fs.existsSync(cssPath)) throw new Error('PATCH35: app/globals.css not found');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* PATCH35_COMPACT_DAILY_FEEDBACK_LIST */';

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.institution-daily-feedback__list{max-height:430px;overflow-y:auto;overflow-x:hidden;padding-right:5px;scrollbar-gutter:stable}\n.institution-daily-feedback__list::-webkit-scrollbar{width:7px}\n.institution-daily-feedback__list::-webkit-scrollbar-track{background:#f3f7fa;border-radius:999px}\n.institution-daily-feedback__list::-webkit-scrollbar-thumb{background:#bfd3e1;border-radius:999px}\n.institution-daily-feedback__list::-webkit-scrollbar-thumb:hover{background:#9ebed3}\n@media(max-width:720px){.institution-daily-feedback__list{max-height:360px;padding-right:3px}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH35: institution daily feedback list is now compact and scrollable.');
} else {
  console.log('PATCH35: compact daily feedback list style already present.');
}
