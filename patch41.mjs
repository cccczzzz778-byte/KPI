import fs from 'node:fs';

const deadlines = {"p01-01":"Dolzarb 60 kunlik doirasida","p01-02":"Dolzarb 60 kunlik doirasida","p01-03":"Dolzarb 60 kunlik doirasida","p01-04":"Dolzarb 60 kunlik doirasida","p01-05":"Dolzarb 60 kunlik doirasida","p02-01":"Dolzarb 60 kunlik doirasida","p02-02":"1 hafta muddatda","p02-03":"Doimiy ravishda","p02-04":"Muntazam ravishda","p03-01":"Muntazam ravishda","p03-02":"1 hafta muddatda","p03-03":"Doimiy ravishda","p03-04":"Muntazam ravishda","p04-01":"Doimiy ravishda","p04-02":"10 kunda","p04-03":"Muntazam ravishda","p04-04":"Doimiy","p04-05":"Har oyda","p05-01":"Doimiy ravishda","p05-02":"Muntazam ravishda","p05-03":"10 kunda","p06-01":"10 kunda","p06-02":"1 oy muddatda","p06-03":"60 kunlikda","p07-01":"1 haftada","p07-02":"Doimiy ravishda","p07-03":"Muntazam ravishda","p08-01":"1 haftada","p08-02":"Doimiy ravishda","p08-03":"Muntazam ravishda","p08-04":"10 kun muddatda","p09-01":"10 kunda","p09-02":"60 kunlikda","p09-03":"1 oyda","p09-04":"60 kunlikda","p09-05":"60 kunlikda","p10-01":"10 kunda","p10-02":"60 kunlikda","p10-03":"Doimiy ravishda","p10-04":"Muntazam","p11-01":"10 kunda","p11-02":"60 kunlikda","p11-03":"60 kunlik davomida","p11-04":"60 kunlik davomida","p12-01":"10 kunda","p12-02":"60 kunlikda","p12-03":"60 kunlik davomida","p14-01":"10 kunda","p15-01":"1 kun muddatda","p15-02":"Haftada 1 marta","p15-03":"Har oyda 1 marta","p16-01":"Doimiy","p16-02":"Doimiy","p17-01":"Belgilangan muddatda","p17-02":"Ikkinchi yarim yillik","p17-03":"Ikkinchi yarim yillik","p18-01":"Dolzarb 60 kunlik doirasida","p18-02":"Dolzarb 60 kunlik doirasida","p18-03":"Dolzarb 60 kunlik doirasida","p18-04":"Dolzarb 60 kunlik doirasida","p19-01":"10 kun muddatda","p19-02":"Haftada 1 marta","p19-03":"Har oyda 1 marta","p20-01":"Dolzarb 60 kunlik doirasida","p20-02":"Dolzarb 60 kunlik doirasida","p20-03":"Dolzarb 60 kunlik doirasida","digital-mother-child-registry":"Har kuni (doimiy)","digital-camera-monitoring":"Har kuni (doimiy)"};

function mustFile(relative) {
  if (!fs.existsSync(relative)) throw new Error(`PATCH41: ${relative} not found`);
  return fs.readFileSync(relative, 'utf8');
}

function write(relative, source) {
  fs.writeFileSync(relative, source, 'utf8');
  console.log(`PATCH41: patched ${relative}`);
}

// Apply the uploaded PDF's Ijro muddati to all 68 active criteria.
{
  const file = 'lib/kpi-data.ts';
  let source = mustFile(file);
  const startMarker = 'export const criteria: Criterion[] = ';
  const endMarker = ';\n\nexport const scoreLabels = [';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('PATCH41: criteria JSON block not found');
  const list = JSON.parse(source.slice(start + startMarker.length, end));
  if (list.length !== 68) throw new Error(`PATCH41: expected 68 active criteria, got ${list.length}`);
  for (const item of list) {
    if (!(item.id in deadlines)) throw new Error(`PATCH41: deadline missing for ${item.id}`);
    item.deadline = deadlines[item.id];
  }
  if (Object.keys(deadlines).length !== list.length) throw new Error('PATCH41: deadline map size mismatch');
  source = source.slice(0, start) + startMarker + JSON.stringify(list, null, 2) + source.slice(end);
  write(file, source);
}

// Re-open institution uploads that patch37 temporarily blocked. Keep institution deletion blocked.
const uploadBlock = '\n    /* PATCH37_INSTITUTION_UPLOAD_BLOCK */\n    if (String(session.role) === "institution") {\n      return Response.json({ error: "Muassasalar uchun fayl yuklash bloklangan." }, { status: 403, headers: { "cache-control": "no-store" } });\n    }';
for (const file of ['app/api/uploads/prepare/route.ts','app/api/uploads/blob/route.ts','app/api/uploads/complete/route.ts']) {
  let source = mustFile(file);
  if (!source.includes('PATCH37_INSTITUTION_UPLOAD_BLOCK')) throw new Error(`PATCH41: upload lock marker missing in ${file}`);
  source = source.replace(uploadBlock, '');
  if (source.includes('PATCH37_INSTITUTION_UPLOAD_BLOCK')) throw new Error(`PATCH41: failed to remove upload lock in ${file}`);
  write(file, source);
}

// Enforce criterion-specific upload recurrence on the server.
{
  const file = 'app/api/uploads/prepare/route.ts';
  let source = mustFile(file);
  const anchor = '    const uploadId = crypto.randomUUID();';
  if (!source.includes(anchor)) throw new Error('PATCH41: upload prepare anchor not found');
  const code = [
    '    /* PATCH41_PDF_UPLOAD_RECURRENCE */',
    '    if (kind === "institution_criterion") {',
    '      const recurrenceCriterionId = String(body.criterionId ?? "").trim();',
    '      const recurrenceInstitutionId = String(session.institutionId ?? "").trim();',
    '      const recurrenceCriterion = criteria.find((item) => item.id === recurrenceCriterionId);',
    '      if (!recurrenceCriterion || !recurrenceInstitutionId) {',
    '        return Response.json({ error: "Muassasa yoki mezon topilmadi." }, { status: 400 });',
    '      }',
    '',
    '      const deadline = String(recurrenceCriterion.deadline || "").toLocaleLowerCase("uz");',
    '      let intervalDays: number | null = null;',
    '      if (deadline.includes("har kuni") || deadline.includes("doimiy") || deadline.includes("muntazam") || deadline.includes("1 kun")) intervalDays = 1;',
    '      else if (deadline.includes("1 hafta") || deadline.includes("haftada 1 marta")) intervalDays = 7;',
    '      else if (deadline.includes("10 kun")) intervalDays = 10;',
    '      else if (deadline.includes("1 oy") || deadline.includes("har oyda")) intervalDays = 30;',
    '      else if (deadline.includes("60 kun")) intervalDays = 60;',
    '      else if (deadline.includes("ikkinchi yarim yillik")) intervalDays = 180;',
    '',
    '      if (intervalDays) {',
    '        const recurrenceDb = getKpiDatabase();',
    '        const recentResult = await recurrenceDb.pool.query(',
    '          "SELECT created_at AS \\"createdAt\\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN (\'institution\', \'institution_submission\') ORDER BY created_at DESC LIMIT 1",',
    '          [recurrenceInstitutionId, recurrenceCriterionId],',
    '        );',
    '        const lastCreatedAt = recentResult.rows[0]?.createdAt ? new Date(recentResult.rows[0].createdAt).getTime() : 0;',
    '        const nextAt = lastCreatedAt ? lastCreatedAt + intervalDays * 24 * 60 * 60 * 1000 : 0;',
    '        if (nextAt && Date.now() < nextAt) {',
    '          const nextDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nextAt));',
    '          return Response.json({ error: "Bu mezon uchun fayl " + recurrenceCriterion.deadline + " bo‘yicha qabul qilinadi. Keyingi yuklash: " + nextDate + ".", nextUploadDate: nextDate, deadline: recurrenceCriterion.deadline }, { status: 409, headers: { "cache-control": "no-store" } });',
    '        }',
    '      }',
    '    }',
    '',
  ].join('\n');
  source = source.replace(anchor, code + anchor);
  write(file, source);
}

// Remove temporary lock notice and unhide upload controls.
{
  const file = 'components/institution-portal.tsx';
  let source = mustFile(file);
  source = source.replace('<div className="institution-upload-locked-notice" role="status"><strong>Fayl yuklash bloklangan</strong><span>Muassasa kabinetidan yangi fayl yuklash va mavjud faylni almashtirish vaqtincha yopilgan. Avval yuklangan fayllar saqlanadi va ko‘rish uchun ochiq.</span></div>\n      ', '');
  write(file, source);
}

{
  const file = 'app/globals.css';
  let source = mustFile(file);
  const marker = '/* PATCH41_PDF_RECURRENCE_UPLOAD_UI */';
  if (!source.includes(marker)) {
    source += `\n\n${marker}\n.institution-file-picker{display:block!important}\n.institution-file-picker+button{display:inline-flex!important}\n`;
    write(file, source);
  }
}

// Show the persisted current score to the institution until the evaluator changes it.
{
  const file = 'app/api/institution/feedback/route.ts';
  let source = mustFile(file);
  if (!source.includes("'  FROM daily_evaluations',")) throw new Error('PATCH41: daily feedback FROM anchor not found');
  source = source.replace("TO_CHAR(evaluation_date, 'YYYY-MM-DD')", "TO_CHAR(updated_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')");
  source = source.replace("      '  FROM daily_evaluations',", "      '  FROM evaluations',");
  source = source.replace('      "   AND evaluation_date = (NOW() AT TIME ZONE \'Asia/Tashkent\')::date",\n', '');
  write(file, source);
}

{
  const file = 'components/institution-daily-feedback.tsx';
  let source = mustFile(file);
  source = source
    .replace('Bugungi baholovchi fikrlari', 'Amaldagi baholovchi ballari')
    .replace('Bu bo‘lim faqat bugungi baholar va baholovchi yozgan izohlarni ko‘rsatadi. Kun almashganda yangi kun uchun qaytadan boshlanadi.', 'Qo‘yilgan ball va baholovchi izohi keyingi baholash o‘zgartirilguniga qadar saqlanadi.')
    .replace('Bugun baholangan:', 'Amaldagi baholar:')
    .replace('Bugun hali baholovchi tomonidan ball yoki fikr yuborilmagan.', 'Hali baholovchi tomonidan ball yoki fikr yuborilmagan.');
  write(file, source);
}

console.log('PATCH41: PDF execution periods applied to 68 criteria.');
console.log('PATCH41: institution criterion uploads reopened with recurrence enforcement.');
console.log('PATCH41: digital-mother-child-registry and digital-camera-monitoring = Har kuni (doimiy).');
console.log('PATCH41: evaluator score persists in evaluations until changed; evidence files are preserved.');
