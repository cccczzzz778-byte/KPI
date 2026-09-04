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
