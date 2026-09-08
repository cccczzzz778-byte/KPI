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

function dumpFile(file, patterns = []) {
  if (!fs.existsSync(file)) {
    console.log(`PATCH28-DASH-DIAG: missing ${file}`);
    return;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  console.log(`PATCH28-DASH-DIAG-BEGIN ${file}`);
  if (lines.length <= 260) {
    lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));
  } else {
    const hits = new Set();
    for (let i = 0; i < lines.length; i++) {
      if (patterns.some((p) => lines[i].toLowerCase().includes(p.toLowerCase()))) {
        for (let j = Math.max(0, i - 10); j <= Math.min(lines.length - 1, i + 26); j++) hits.add(j);
      }
    }
    [...hits].sort((a,b)=>a-b).forEach((i) => console.log(`${i + 1}: ${lines[i]}`));
  }
  console.log(`PATCH28-DASH-DIAG-END ${file}`);
}

dumpFile('app/api/dashboard/route.ts', ['evaluation', 'score', 'institution', 'round', 'daily', 'month']);
dumpFile('components/kpi-app.tsx', ['dashboard', '/api/dashboard', 'DashboardPanel', 'totalScore', 'jami kpi', 'monitoring']);
dumpFile('app/page.tsx', ['dashboard', 'KpiApp']);
console.log('PATCH28-DASH-DIAG: dashboard daily/monthly investigation complete.');
