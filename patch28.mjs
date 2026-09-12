import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'app/globals.css');
if (!fs.existsSync(cssPath)) throw new Error('PATCH28: app/globals.css not found');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* PATCH28_INSTITUTION_PANELS_EQUAL_WIDTH */';

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.institution-shell > .upload-window-card,\n.institution-shell > .criterion-file-manager,\n.institution-shell > .responsible-card,\n.institution-shell > .institution-directions{\n  width:min(1080px,calc(100% - 32px))!important;\n  max-width:1080px!important;\n  min-width:0!important;\n  margin-left:auto!important;\n  margin-right:auto!important;\n  box-sizing:border-box!important;\n}\n\n/* PATCH22 manager had full-viewport width; keep its own vertical spacing but align it to the other institution cards. */\n.institution-shell > .criterion-file-manager{\n  margin-top:18px!important;\n  margin-bottom:18px!important;\n}\n\n@media(max-width:720px){\n  .institution-shell > .upload-window-card,\n  .institution-shell > .criterion-file-manager,\n  .institution-shell > .responsible-card,\n  .institution-shell > .institution-directions{\n    width:calc(100% - 20px)!important;\n    max-width:none!important;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH28: institution portal panels now share the same centered 1080px width.');
} else {
  console.log('PATCH28: institution panel equal-width CSS already present.');
}
