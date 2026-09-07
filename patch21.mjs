import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'app/globals.css');
if (!fs.existsSync(cssPath)) throw new Error('PATCH21: app/globals.css not found');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* PATCH21_INSTITUTION_SUBMISSION_LAYOUT_FIX */';

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.institution-submission-manager{grid-column:1/-1!important;width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important;flex:1 1 100%!important;align-self:stretch!important;overflow:hidden}\n.institution-submission-manager>*{min-width:0}\n.institution-submission-list{width:100%;min-width:0}\n.institution-submission-row{width:100%;min-width:0;box-sizing:border-box;grid-template-columns:42px minmax(220px,1fr) auto!important}\n.institution-submission-main{min-width:220px!important;max-width:none!important}\n.institution-submission-main strong,.institution-submission-main span,.institution-submission-main small{word-break:normal!important;overflow-wrap:break-word!important;white-space:normal!important}\n.institution-submission-actions{min-width:max-content;max-width:340px}\n@media(max-width:1050px){.institution-submission-row{grid-template-columns:42px minmax(0,1fr)!important}.institution-submission-main{min-width:0!important}.institution-submission-actions{grid-column:1/-1;justify-content:flex-end;min-width:0;max-width:none;width:100%}}\n@media(max-width:760px){.institution-submission-manager{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;overflow:visible}.institution-submission-row{grid-template-columns:38px minmax(0,1fr)!important}.institution-submission-actions{justify-content:stretch}.institution-submission-actions a,.institution-submission-actions button{flex:1 1 160px;white-space:normal!important;text-align:center}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH21: institution submission manager full-width layout fixed.');
} else {
  console.log('PATCH21: layout fix already applied.');
}
