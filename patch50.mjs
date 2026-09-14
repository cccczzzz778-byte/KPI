import fs from 'node:fs';

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`PATCH50: ${file} not found`);
  return fs.readFileSync(file, 'utf8');
}
function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
  console.log(`PATCH50: patched ${file}`);
}

// Align institution-facing upload times to 08:00-19:00.
for (const file of ['app/api/uploads/prepare/route.ts', 'app/api/institution/route.ts', 'components/institution-portal.tsx']) {
  let source = read(file);
  source = source.replaceAll('08:00–18:00', '08:00–19:00');
  source = source.replaceAll('08:00-18:00', '08:00-19:00');
  source = source.replaceAll('"18:00"', '"19:00"');
  write(file, source);
}

const helper = String.raw`function institutionUploadWindowOpen() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  return minutes >= 8 * 60 && minutes < 19 * 60;
}

`;

{
  const file = 'app/api/uploads/prepare/route.ts';
  let source = read(file);
  if (!source.includes('function institutionUploadWindowOpen()')) {
    const anchor = 'export async function POST(';
    if (!source.includes(anchor)) throw new Error('PATCH50: prepare POST anchor not found');
    source = source.replace(anchor, helper + anchor);
  }
  const criterionAnchor = '    if (kind === "institution_criterion") {';
  if (!source.includes(criterionAnchor)) throw new Error('PATCH50: prepare institution criterion anchor not found');
  if (!source.includes('PATCH50_INSTITUTION_UPLOAD_HOURS_PREPARE')) {
    source = source.replace(criterionAnchor, criterionAnchor + String.raw`
      /* PATCH50_INSTITUTION_UPLOAD_HOURS_PREPARE */
      if (!institutionUploadWindowOpen()) {
        return Response.json(
          { error: "Muassasalar faylni faqat soat 08:00 dan 19:00 gacha (O‘zbekiston vaqti) yuklay oladi.", uploadWindow: "08:00-19:00" },
          { status: 403, headers: { "cache-control": "no-store" } },
        );
      }`);
  }
  write(file, source);
}

{
  const file = 'app/api/uploads/complete/route.ts';
  let source = read(file);
  if (!source.includes('function institutionUploadWindowOpen()')) {
    const anchor = 'export async function POST(';
    if (!source.includes(anchor)) throw new Error('PATCH50: complete POST anchor not found');
    source = source.replace(anchor, helper + anchor);
  }
  const criterionAnchor = '    if (intent.kind === "institution_criterion") {';
  if (!source.includes(criterionAnchor)) throw new Error('PATCH50: complete institution criterion anchor not found');
  if (!source.includes('PATCH50_INSTITUTION_UPLOAD_HOURS_COMPLETE')) {
    source = source.replace(criterionAnchor, criterionAnchor + String.raw`
      /* PATCH50_INSTITUTION_UPLOAD_HOURS_COMPLETE */
      if (!institutionUploadWindowOpen()) {
        await cleanUp(uploadId, intent);
        intent = null;
        return Response.json(
          { error: "Fayl qabul qilish vaqti tugagan. Muassasalar uchun yuklash har kuni 08:00–19:00 (O‘zbekiston vaqti).", uploadWindow: "08:00-19:00" },
          { status: 403, headers: { "cache-control": "no-store" } },
        );
      }`);
  }
  write(file, source);
}

// Re-enable the institution's built-in removal action for its own uploaded criterion files.
{
  const file = 'app/api/institution/submissions/route.ts';
  let source = read(file);
  const marker = '/* PATCH37_INSTITUTION_DELETE_BLOCK */';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('PATCH50: institution remove lock marker not found');
  const lineStart = source.lastIndexOf('\n', start);
  const returnEnd = source.indexOf(';', start);
  if (lineStart < 0 || returnEnd < 0) throw new Error('PATCH50: institution remove lock block malformed');
  source = source.slice(0, lineStart) + source.slice(returnEnd + 1);
  write(file, source);
}

// The original manager already has the red removal button; patch37 only hid it.
{
  const file = 'app/globals.css';
  let source = read(file);
  const marker = '/* PATCH50_INSTITUTION_REMOVE_UI */';
  if (!source.includes(marker)) {
    source += `\n\n${marker}\n.criterion-file-manager__delete{display:inline-flex!important;align-items:center;justify-content:center;gap:6px}\n`;
  }
  write(file, source);
}

console.log('PATCH50: institution upload window = 08:00-19:00 Asia/Tashkent.');
console.log('PATCH50: institution can remove its own uploaded criterion files from the existing manager.');
console.log('PATCH50: recurrence rules remain active; BUYRUQ lock remains unchanged.');
