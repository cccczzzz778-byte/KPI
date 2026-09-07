import fs from 'node:fs';
import path from 'node:path';

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) throw new Error(`PATCH24: ${relative} not found.`);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH24: no changes applied to ${relative}.`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH24: patched ${relative}`);
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`PATCH24 anchor not found: ${label}`);
  return text.replace(from, to);
}

const OPTIONAL_CRITERION_ID = 'digital-daily-task-timeliness';

patchFile('lib/kpi-data.ts', (source) => {
  source = replaceOnce(
    source,
    `  source: string;\n};`,
    `  source: string;\n  requiresInstitutionFile?: boolean;\n};`,
    'criterion-file-flag-type',
  );

  const moliyaAnchor = `  {\n    "id": "p01-02",\n    "commission": "moliya",`;
  const newCriterion = `  {\n    "id": "${OPTIONAL_CRITERION_ID}",\n    "commission": "raqam",\n    "title": "Kunlik berilgan vazifalarni o‘z vaqtida bajarish",\n    "detail": "Raqamlashtirish yo‘nalishi bo‘yicha kun davomida berilgan topshiriq va vazifalarni belgilangan muddatlarda sifatli bajarish, kechikishlarga yo‘l qo‘ymaslik hamda bajarilish holatini tezkor nazorat qilib borish.",\n    "deadline": "Har kuni / belgilangan muddatda",\n    "source": "Qo‘shimcha raqamlashtirish mezoni",\n    "requiresInstitutionFile": false\n  },\n`;
  source = replaceOnce(source, moliyaAnchor, `${newCriterion}${moliyaAnchor}`, 'insert-daily-digital-criterion');
  return source;
});

patchFile('components/institution-portal.tsx', (source) => {
  source = replaceOnce(
    source,
    'Har bir mezonga har kuni 1 ta fayl yuklash mumkin (08:00–18:00).',
    'Fayl talab qilinadigan mezonlarga har kuni 1 ta fayl yuklash mumkin (08:00–18:00).',
    'institution-upload-help-copy',
  );

  source = replaceOnce(
    source,
    `{submitted ? <div className="institution-submitted"><div><CheckCircle2 /><strong>Bugun yuklangan</strong></div>`,
    `{criterion.requiresInstitutionFile === false ? <div className="institution-submitted"><div><CheckCircle2 /><strong>Fayl biriktirish shart emas</strong></div><p>Ushbu mezon baholovchi tomonidan kunlik topshiriqlarning o‘z vaqtida bajarilishiga ko‘ra baholanadi.</p></div> : submitted ? <div className="institution-submitted"><div><CheckCircle2 /><strong>Bugun yuklangan</strong></div>`,
    'no-file-required-criterion-ui',
  );

  return source;
});

console.log('PATCH24: digital daily-task timeliness criterion added; institution file upload is not required for it.');
