import fs from 'node:fs';
import path from 'node:path';

function copyTemplate(template, relative) {
  const source = path.join(process.cwd(), template);
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
  console.log(`Created ${relative}`);
}

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`Patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`Patched ${relative}`);
}

copyTemplate('patch6.admin-route.ts.txt', 'app/api/admin/institutions/route.ts');
copyTemplate('patch6.admin-manager.tsx.txt', 'components/admin-institution-manager.tsx');

patchFile('components/kpi-app.tsx', (text) => {
  if (!text.includes('AdminInstitutionManager')) {
    const importLine = 'import { AdminInstitutionManager } from "@/components/admin-institution-manager";';
    if (text.includes('"use client";')) {
      text = text.replace('"use client";', '"use client";\n\n' + importLine);
    } else if (text.includes("'use client';")) {
      text = text.replace("'use client';", "'use client';\n\n" + importLine);
    } else if (text.includes('"use client"')) {
      text = text.replace('"use client"', '"use client"\n\n' + importLine);
    } else if (text.includes("'use client'")) {
      text = text.replace("'use client'", "'use client'\n\n" + importLine);
    } else {
      throw new Error('kpi-app use client anchor not found');
    }
  }

  if (!text.includes('<AdminInstitutionManager onChanged={onRefresh} />')) {
    const anchor = '<TabsContent value="institutions" className="panel-content">';
    if (!text.includes(anchor)) throw new Error('institutions tab anchor not found');
    text = text.replace(anchor, anchor + '<AdminInstitutionManager onChanged={onRefresh} />');
  }
  return text;
});

console.log('Admin institution/login/password manager patch applied.');

function inspectFile(relative, needles) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) {
    console.log(`INSPECT MISSING ${relative}`);
    return;
  }
  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);
  const wanted = new Set();
  lines.forEach((line, index) => {
    if (needles.some((needle) => line.toLowerCase().includes(needle.toLowerCase()))) {
      for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i += 1) wanted.add(i);
    }
  });
  console.log(`--- INSPECT ${relative} ---`);
  [...wanted].sort((a, b) => a - b).forEach((i) => console.log(`${i + 1}: ${lines[i]}`));
  console.log(`--- END INSPECT ${relative} ---`);
}

inspectFile('components/institution-portal.tsx', ['ACCEPT', 'MAX_FILE_BYTES', 'responsible-card', 'uploadFileToNetlify', 'criteria', 'attachments', 'type="file"', 'PDF, JPEG']);
inspectFile('app/api/uploads/prepare/route.ts', ['allowed', 'accept', 'mime', 'contentType', 'filename', 'extension', '.xlsx', 'fayl turi']);
inspectFile('app/api/uploads/complete/route.ts', ['allowed', 'mime', 'contentType', 'filename', 'extension', '.xlsx', 'attachments']);
inspectFile('app/api/institution/route.ts', ['criteria', 'attachments', 'orderResult', 'Response.json', 'SELECT', 'submission_date']);
