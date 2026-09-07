import fs from 'node:fs';
import path from 'node:path';

function copyTemplate(template, relative) {
  const source = path.join(process.cwd(), template);
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
  console.log(`PATCH20: created ${relative}`);
}

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH20: patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH20: patched ${relative}`);
}

copyTemplate('patch20.institution-submissions-route.ts.txt', 'app/api/institution/submissions/route.ts');
copyTemplate('patch20.institution-submission-manager.tsx.txt', 'components/institution-submission-manager.tsx');

patchFile('lib/r2.ts', (text) => {
  let updated = text;
  if (!updated.includes('DeleteObjectCommand')) {
    const importPattern = /import\s*\{([\s\S]*?)\}\s*from\s*["']@aws-sdk\/client-s3["'];?/m;
    const match = updated.match(importPattern);
    if (!match) throw new Error('PATCH20: @aws-sdk/client-s3 import not found in lib/r2.ts');
    const names = match[1].split(',').map((item) => item.trim()).filter(Boolean);
    if (!names.includes('DeleteObjectCommand')) names.push('DeleteObjectCommand');
    updated = updated.replace(importPattern, `import { ${names.join(', ')} } from "@aws-sdk/client-s3";`);
  }

  if (!updated.includes('export async function deleteR2Object')) {
    updated += '\n\nexport async function deleteR2Object(key: string) {\n  return getR2Client().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));\n}\n';
  }
  return updated;
});

patchFile('components/institution-portal.tsx', (text) => {
  let updated = text;
  if (!updated.includes('InstitutionSubmissionManager')) {
    const importLine = 'import { InstitutionSubmissionManager } from "@/components/institution-submission-manager";';
    if (updated.includes('"use client";')) updated = updated.replace('"use client";', '"use client";\n\n' + importLine);
    else if (updated.includes("'use client';")) updated = updated.replace("'use client';", "'use client';\n\n" + importLine);
    else throw new Error('PATCH20: institution portal use client anchor not found');
  }

  if (!updated.includes('<InstitutionSubmissionManager />')) {
    const anchor = '<section className="responsible-card">';
    if (!updated.includes(anchor)) throw new Error('PATCH20: institution portal responsible-card anchor not found');
    updated = updated.replace(anchor, '<InstitutionSubmissionManager />\n      ' + anchor);
  }
  return updated;
});

const cssPath = path.join(process.cwd(), 'app/globals.css');
if (!fs.existsSync(cssPath)) throw new Error('PATCH20: app/globals.css not found');
let css = fs.readFileSync(cssPath, 'utf8');
const cssMarker = '/* PATCH20_INSTITUTION_SUBMISSION_MANAGER */';
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.institution-submission-manager{margin-bottom:16px;border:1px solid #d7e7f2!important;background:#fff!important;box-shadow:0 8px 26px rgba(45,92,126,.07)!important}\n.institution-submission-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}\n.institution-submission-title{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:850;color:#123b5d}\n.institution-submission-head p{margin:6px 0 0;max-width:900px;color:#647f96;font-size:13px;line-height:1.5}\n.institution-submission-refresh{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:8px 12px;border:1px solid #cae0ee;border-radius:10px;background:#f6fbff;color:#126ca7;font-weight:800;cursor:pointer}\n.institution-submission-refresh:disabled{opacity:.55;cursor:default}\n.institution-submission-refresh .spin{animation:institutionSubmissionSpin .8s linear infinite}\n@keyframes institutionSubmissionSpin{to{transform:rotate(360deg)}}\n.institution-submission-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap}\n.institution-submission-toolbar input{flex:1 1 320px;min-height:40px;padding:9px 11px;border:1px solid #d7e4ed;border-radius:10px;background:#fbfdff;color:#173851;outline:none}\n.institution-submission-toolbar input:focus{border-color:#72b7df;box-shadow:0 0 0 3px rgba(52,153,211,.10)}\n.institution-submission-toolbar span{flex:0 0 auto;padding:7px 10px;border-radius:999px;background:#eef8ff;color:#2b6f99;font-size:12px;font-weight:800}\n.institution-submission-state,.institution-submission-error{margin-top:12px;padding:14px;border:1px dashed #ccdde8;border-radius:11px;background:#fbfdff;color:#617b91;text-align:center}\n.institution-submission-error{border-style:solid;border-color:#f1c4c4;background:#fff7f7;color:#a12c2c;text-align:left}\n.institution-submission-list{display:grid;gap:9px;margin-top:12px}\n.institution-submission-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:11px;padding:11px;border:1px solid #e0ebf2;border-radius:12px;background:linear-gradient(135deg,#fff 0%,#f9fcff 100%)}\n.institution-submission-icon{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:#eaf6ff;color:#177dbb}\n.institution-submission-main{min-width:0;display:flex;flex-direction:column;gap:3px}\n.institution-submission-main strong{font-size:13px;line-height:1.35;color:#173d59}\n.institution-submission-main span{font-size:12px;color:#526f83;overflow-wrap:anywhere}\n.institution-submission-main small{font-size:11px;color:#8298aa}\n.institution-submission-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}\n.institution-submission-actions a,.institution-submission-actions button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:7px 10px;border-radius:9px;border:1px solid #d1e2ed;background:#fff;color:#24678f;text-decoration:none;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap}\n.institution-submission-actions .institution-submission-delete{border-color:#efc7c7;background:#fff7f7;color:#b33636}\n.institution-submission-actions button:disabled{opacity:.55;cursor:default}\n@media(max-width:760px){.institution-submission-row{grid-template-columns:38px minmax(0,1fr)}.institution-submission-icon{width:36px;height:36px}.institution-submission-actions{grid-column:1/-1;justify-content:stretch}.institution-submission-actions a,.institution-submission-actions button{flex:1 1 160px;min-height:40px}.institution-submission-toolbar input{flex-basis:100%}}\n@media(max-width:480px){.institution-submission-manager{padding:12px!important}.institution-submission-title{font-size:15px}.institution-submission-head p{font-size:12px}.institution-submission-row{padding:9px}.institution-submission-actions a,.institution-submission-actions button{flex-basis:100%}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH20: institution criterion delete/re-upload styling added.');
}

console.log('PATCH20: institution criterion files can now be deleted and re-uploaded. BUYRUQ files are protected.');
