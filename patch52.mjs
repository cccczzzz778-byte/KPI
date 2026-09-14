import fs from 'node:fs';

const file = 'components/kpi-app.tsx';
if (!fs.existsSync(file)) throw new Error('PATCH52 missing '+file);
let s = fs.readFileSync(file, 'utf8');

const widget = '<AdminDashboardOverview />';
const institutionTab = '<TabsContent value="institutions" className="panel-content">';

if (!s.includes('AdminDashboardOverview')) throw new Error('PATCH52 AdminDashboardOverview import missing');
if (!s.includes(institutionTab)) throw new Error('PATCH52 institutions tab anchor missing');

// PATCH51 accidentally mounted the new overview inside the Institutions tab only.
// Remove all mounted copies, then place one as a direct Tabs child so it stays
// visible for Users / Institutions / Orders / Files / Scores / Activity tabs.
s = s.split(widget).join('');
s = s.replace(institutionTab, widget+'\n'+institutionTab);

fs.writeFileSync(file, s, 'utf8');
console.log('PATCH52: AdminDashboardOverview moved outside tab content and is visible across every admin section.');

const cssFile = 'app/globals.css';
let css = fs.readFileSync(cssFile, 'utf8');
const marker = '/* PATCH52_ADMIN_VISIBILITY */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.admin-v1{margin-top:16px;margin-bottom:16px}.admin-v1+.panel-content{margin-top:0}\n`;
  fs.writeFileSync(cssFile, css, 'utf8');
}
console.log('PATCH52: admin visibility styles active.');
