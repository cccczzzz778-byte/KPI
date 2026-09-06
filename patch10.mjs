import fs from 'node:fs';
import path from 'node:path';

function copyTemplate(template, relative) {
  const source = path.join(process.cwd(), template);
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
  console.log(`SECURITY: created ${relative}`);
}

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`Security patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`SECURITY: patched ${relative}`);
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Security patch anchor not found: ${label}`);
  return text.replace(from, to);
}

copyTemplate('patch10.server-auth.ts.txt', 'lib/server-auth.ts');
copyTemplate('patch10.login-route.ts.txt', 'app/api/auth/login/route.ts');
copyTemplate('patch10.logout-route.ts.txt', 'app/api/auth/logout/route.ts');
copyTemplate('patch10.upload-blob-route.ts.txt', 'app/api/uploads/blob/route.ts');
copyTemplate('patch10.proxy.ts.txt', 'proxy.ts');
copyTemplate('patch10.next-config.ts.txt', 'next.config.ts');
copyTemplate('patch10.security-migration.sql.txt', 'db/migrations/012_security_hardening/migration.sql');

// Harden upload preparation: whitelist evaluator files, hash the upload secret in DB,
// and send the raw secret only in a request header (never in a URL/query string).
patchFile('app/api/uploads/prepare/route.ts', (text) => {
  text = replaceOnce(
    text,
    'import { criteria, rounds } from "@/lib/kpi-data";',
    'import { createHash } from "node:crypto";\nimport { criteria, rounds } from "@/lib/kpi-data";',
    'prepare-crypto-import',
  );
  text = replaceOnce(text, '  token: string;\n  kind: UploadKind;', '  tokenHash: string;\n  kind: UploadKind;', 'prepare-intent-token');
  text = replaceOnce(
    text,
    'function makeToken() { return `${crypto.randomUUID()}-${crypto.randomUUID()}`; }',
    'function makeToken() { return `${crypto.randomUUID()}-${crypto.randomUUID()}`; }\nfunction tokenDigest(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }',
    'prepare-token-digest',
  );
  text = replaceOnce(
    text,
    '      if (!criterion) return Response.json({ error: "Mezon topilmadi." }, { status: 400 });\n      institutionId = String(body.institutionId ?? "").trim();',
    '      if (!criterion) return Response.json({ error: "Mezon topilmadi." }, { status: 400 });\n      if (!INSTITUTION_EXTENSIONS.has(extension(filename))) return Response.json({ error: "Faqat PDF, JPEG, Word, Excel, ZIP yoki RAR fayl yuklash mumkin." }, { status: 400 });\n      institutionId = String(body.institutionId ?? "").trim();',
    'prepare-evaluator-extension',
  );
  text = replaceOnce(
    text,
    '    const uploadId = crypto.randomUUID();\n    const uploadToken = makeToken();\n    const intent: UploadIntent = {\n      version: 3,\n      token: uploadToken,',
    '    const uploadId = crypto.randomUUID();\n    const uploadToken = makeToken();\n    const uploadTokenHash = tokenDigest(uploadToken);\n    const intent: UploadIntent = {\n      version: 3,\n      tokenHash: uploadTokenHash,',
    'prepare-token-hash',
  );
  text = replaceOnce(
    text,
    '[uploadId, uploadToken, JSON.stringify(intent), new Date(intent.expiresAt)],',
    '[uploadId, uploadTokenHash, JSON.stringify(intent), new Date(intent.expiresAt)],',
    'prepare-store-token-hash',
  );
  text = replaceOnce(
    text,
    '    const uploadUrl = `/api/uploads/blob?uploadId=${encodeURIComponent(uploadId)}&uploadToken=${encodeURIComponent(uploadToken)}`;',
    '    const uploadUrl = `/api/uploads/blob?uploadId=${encodeURIComponent(uploadId)}`;',
    'prepare-no-token-url',
  );
  text = replaceOnce(
    text,
    '      uploadHeaders: { "content-type": contentType },',
    '      uploadHeaders: { "content-type": contentType, "x-kpi-upload-token": uploadToken },',
    'prepare-token-header',
  );
  return text;
});

// Harden upload completion: active authenticated uploader only, hashed secret, one-use upload,
// and generic internal errors so implementation details are not leaked to the browser.
patchFile('app/api/uploads/complete/route.ts', (text) => {
  text = replaceOnce(
    text,
    'import { getKpiDatabase } from "@/lib/netlify-db";',
    'import { createHash } from "node:crypto";\nimport { getKpiDatabase } from "@/lib/netlify-db";\nimport { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";',
    'complete-security-imports',
  );
  text = replaceOnce(text, '  token: string;\n  kind:', '  tokenHash?: string;\n  uploadedAt?: number;\n  kind:', 'complete-intent-token');
  text = replaceOnce(
    text,
    'async function cleanUp(uploadId: string, intent?: UploadIntent | null) {',
    'function tokenDigest(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }\n\nasync function cleanUp(uploadId: string, intent?: UploadIntent | null) {',
    'complete-token-digest',
  );
  text = replaceOnce(
    text,
    '  try {\n    const body = (await request.json()) as Record<string, unknown>;',
    '  try {\n    const session = await requireAppUser(request);\n    const body = (await request.json()) as Record<string, unknown>;',
    'complete-require-session',
  );
  text = replaceOnce(
    text,
    '    const uploadToken = String(body.uploadToken ?? "").trim();\n    if (!uploadId || !uploadToken) return Response.json({ error: "Yuklash tokeni yetishmaydi." }, { status: 400 });',
    '    const uploadToken = String(body.uploadToken ?? "").trim();\n    if (!uploadId || !uploadToken || uploadToken.length > 256) return Response.json({ error: "Yuklash tokeni yetishmaydi." }, { status: 400 });\n    const uploadTokenHash = tokenDigest(uploadToken);',
    'complete-token-hash-var',
  );
  text = replaceOnce(text, '[uploadId, uploadToken],', '[uploadId, uploadTokenHash],', 'complete-query-token-hash');
  text = replaceOnce(
    text,
    '    if (!intent) return Response.json({ error: "Yuklash tokeni noto‘g‘ri yoki eskirgan." }, { status: 403 });\n\n    await verifyStored(intent);',
    '    if (!intent) return Response.json({ error: "Yuklash tokeni noto‘g‘ri yoki eskirgan." }, { status: 403 });\n    if (intent.uploadedBy !== session.email) { intent = null; throw new AccessError("Bu yuklash boshqa foydalanuvchiga tegishli.", 403); }\n    if (!intent.uploadedAt) { intent = null; throw new AccessError("Fayl xavfsiz yuklash bosqichidan o‘tmagan.", 409); }\n\n    await verifyStored(intent);',
    'complete-uploader-check',
  );
  text = replaceOnce(
    text,
    '  } catch (error) {\n    if (intent && uploadId) await cleanUp(uploadId, intent);\n    console.error("upload complete failed", error);\n    return Response.json({ error: error instanceof Error ? error.message : "Fayl yozuvini saqlashda xatolik." }, { status: 500 });\n  }',
    '  } catch (error) {\n    if (error instanceof AccessError) return accessErrorResponse(error);\n    if (intent && uploadId) await cleanUp(uploadId, intent);\n    console.error("upload complete failed", error);\n    return Response.json({ error: "Fayl yozuvini saqlashda server xatoligi yuz berdi." }, { status: 500, headers: { "cache-control": "no-store" } });\n  }',
    'complete-generic-error',
  );
  return text;
});

// New and reset institution passwords must be meaningfully strong. Existing passwords remain valid.
patchFile('app/api/admin/institutions/route.ts', (text) => {
  text = replaceOnce(
    text,
    'function validatePassword(password: string) {\n  if (password.length < 8) throw new AccessError("Parol kamida 8 ta belgidan iborat bo‘lsin.");\n}',
    'function validatePassword(password: string) {\n  if (password.length < 12 || password.length > 128) throw new AccessError("Parol 12–128 ta belgidan iborat bo‘lsin.");\n  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new AccessError("Parolda kamida bitta harf va bitta raqam bo‘lsin.");\n  const weak = password.toLowerCase().replace(/[^a-z0-9]/g, "");\n  if (["123456789012", "password1234", "admin123456", "qwerty123456"].includes(weak)) throw new AccessError("Bu parol juda oddiy. Murakkabroq parol tanlang.");\n}',
    'admin-strong-password',
  );
  return text;
});

patchFile('components/admin-institution-manager.tsx', (text) => {
  text = text.replace('"Kamida 8 belgi"', '"Kamida 12 belgi, harf + raqam"');
  if (!text.includes('Kamida 12 belgi, harf + raqam')) throw new Error('Admin password UI patch failed');
  return text;
});

console.log('SECURITY HARDENING V2: sessions, brute-force protection, CSRF, headers, upload validation and password policy enabled.');
