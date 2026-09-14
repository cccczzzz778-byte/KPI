import fs from 'node:fs';

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`PATCH50: ${file} not found`);
  return fs.readFileSync(file, 'utf8');
}
function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
  console.log(`PATCH50: patched ${file}`);
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

// First gate: do not even create an institution criterion upload intent outside 08:00-19:00 Uzbekistan time.
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

// Final gate: repeat the time-window check at completion so an upload started before 19:00 cannot be committed after closing time.
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

console.log('PATCH50: institution criterion uploads allowed only 08:00-19:00 Asia/Tashkent; recurrence rules remain in force.');
console.log('PATCH50: evaluator/admin upload behavior is unchanged.');
