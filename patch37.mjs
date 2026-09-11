import fs from 'node:fs';
import path from 'node:path';

const BLOCK_MESSAGE = "Muassasalar uchun fayl yuklash bloklangan.";

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) throw new Error(`PATCH37: ${relative} not found`);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) {
    console.log(`PATCH37: ${relative} already compatible`);
    return;
  }
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH37: patched ${relative}`);
}

function blockInstitutionUploadRoute(relative) {
  patchFile(relative, (source) => {
    if (source.includes('PATCH37_INSTITUTION_UPLOAD_BLOCK')) return source;
    const needle = 'const session = await requireAppUser(request);';
    const index = source.indexOf(needle);
    if (index < 0) throw new Error(`PATCH37: session anchor not found in ${relative}`);
    const replacement = `${needle}\n    /* PATCH37_INSTITUTION_UPLOAD_BLOCK */\n    if (session.role === "institution") {\n      return Response.json({ error: "${BLOCK_MESSAGE}" }, { status: 403, headers: { "cache-control": "no-store" } });\n    }`;
    return source.slice(0, index) + source.slice(index).replace(needle, replacement);
  });
}

// Defense in depth: institutions cannot prepare, transfer, or complete a new upload.
blockInstitutionUploadRoute('app/api/uploads/prepare/route.ts');
blockInstitutionUploadRoute('app/api/uploads/blob/route.ts');
blockInstitutionUploadRoute('app/api/uploads/complete/route.ts');

// Existing institution files stay readable, but institutions cannot delete them while uploads are blocked.
patchFile('app/api/institution/submissions/route.ts', (source) => {
  if (source.includes('PATCH37_INSTITUTION_DELETE_BLOCK')) return source;
  const deleteStart = source.indexOf('export async function DELETE');
  if (deleteStart < 0) throw new Error('PATCH37: institution submissions DELETE handler not found');
  const needle = 'requireInstitution(session);';
  const anchor = source.indexOf(needle, deleteStart);
  if (anchor < 0) throw new Error('PATCH37: institution DELETE session anchor not found');
  const insertAt = anchor + needle.length;
  return source.slice(0, insertAt)
    + `\n    /* PATCH37_INSTITUTION_DELETE_BLOCK */\n    return Response.json({ error: "${BLOCK_MESSAGE} Mavjud fayllar saqlanadi." }, { status: 403, headers: { "cache-control": "no-store" } });`
    + source.slice(insertAt);
});

// Show a clear lock notice in the institution cabinet. Existing files remain visible.
patchFile('components/institution-portal.tsx', (source) => {
  if (source.includes('institution-upload-locked-notice')) return source;
  const anchor = '<InstitutionSubmissionManager />';
  if (!source.includes(anchor)) throw new Error('PATCH37: institution portal manager anchor not found');
  return source.replace(
    anchor,
    `<div className="institution-upload-locked-notice" role="status"><strong>Fayl yuklash bloklangan</strong><span>Muassasa kabinetidan yangi fayl yuklash va mavjud faylni almashtirish vaqtincha yopilgan. Avval yuklangan fayllar saqlanadi va ko‘rish uchun ochiq.</span></div>\n      ${anchor}`,
  );
});

// Hide institution-side file pickers and delete/re-upload controls so the UI matches the server rule.
patchFile('app/globals.css', (source) => {
  const marker = '/* PATCH37_INSTITUTION_UPLOAD_LOCK_UI */';
  if (source.includes(marker)) return source;
  return source + `\n\n${marker}\n.institution-upload-locked-notice{grid-column:1/-1;margin:0 0 16px;padding:14px 16px;border:1px solid #f0cf8b;border-radius:14px;background:#fff9e8;color:#72510b;display:flex;flex-direction:column;gap:4px;box-shadow:0 6px 18px rgba(111,78,8,.06)}\n.institution-upload-locked-notice strong{font-size:14px;font-weight:900}\n.institution-upload-locked-notice span{font-size:12.5px;line-height:1.45}\n.institution-file-picker{display:none!important}\n.institution-file-picker+button{display:none!important}\n.criterion-file-manager__delete{display:none!important}\n`;
});

console.log('PATCH37: institution uploads are blocked; existing files remain available.');
