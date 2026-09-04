import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const parts = fs.readdirSync(process.cwd())
  .filter((name) => /^source\.bundle\.\d+\.b64$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
if (!parts.length) process.exit(0);
const packed = parts.map((name) => fs.readFileSync(path.join(process.cwd(), name), 'utf8').replace(/[^A-Za-z0-9+/=]/g, '')).join('');
const data = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
for (const [relative, value] of Object.entries(data)) {
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (value && typeof value === 'object' && value.__base64__) fs.writeFileSync(target, Buffer.from(value.__base64__, 'base64'));
  else fs.writeFileSync(target, String(value), 'utf8');
}
console.log(`Restored ${Object.keys(data).length} source files.`);

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`Patch did not change ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`Patched ${relative}`);
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Patch anchor not found: ${label}`);
  return text.replace(from, to);
}

// 1) Same-origin upload proxy + correct download filename.
patchFile('lib/r2.ts', (text) => {
  text = replaceOnce(
    text,
    'export async function createR2DownloadUrl(input: { key: string; expiresIn?: number }) {\n  return getSignedUrl(\n    getR2Client(),\n    new GetObjectCommand({ Bucket: getR2Bucket(), Key: input.key }),\n    { expiresIn: input.expiresIn ?? 5 * 60 },\n  );\n}',
    String.raw`export async function createR2DownloadUrl(input: { key: string; filename?: string; contentType?: string; expiresIn?: number }) {
  const asciiName = (input.filename || "file").replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const disposition = input.filename
    ? "attachment; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodeURIComponent(input.filename)
    : undefined;
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: input.key,
      ResponseContentDisposition: disposition,
      ResponseContentType: input.contentType || undefined,
    }),
    { expiresIn: input.expiresIn ?? 5 * 60 },
  );
}` ,
    'download-url',
  );
  text = replaceOnce(
    text,
    'export async function headR2Object(key: string) {',
    'export async function putR2Object(input: { key: string; body: Uint8Array; contentType: string }) {\n  return getR2Client().send(new PutObjectCommand({\n    Bucket: getR2Bucket(),\n    Key: input.key,\n    Body: input.body,\n    ContentType: input.contentType,\n  }));\n}\n\nexport async function headR2Object(key: string) {',
    'put-object',
  );
  return text;
});

patchFile('app/api/uploads/prepare/route.ts', (text) => {
  text = replaceOnce(
    text,
    'import { createR2UploadUrl, isR2Configured } from "@/lib/r2";',
    'import { isR2Configured } from "@/lib/r2";',
    'prepare-import',
  );
  text = replaceOnce(
    text,
    '    const uploadUrl = await createR2UploadUrl({ key: objectKey, contentType, expiresIn: 15 * 60 });',
    '    const uploadUrl = `/api/uploads/blob?uploadId=${encodeURIComponent(uploadId)}&uploadToken=${encodeURIComponent(uploadToken)}`;',
    'prepare-upload-url',
  );
  return text;
});

const blobRoute = String.raw`import { getKpiDatabase } from "@/lib/netlify-db";
import { putR2Object, isR2Configured } from "@/lib/r2";
import { accessErrorResponse, AccessError, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

type UploadIntent = {
  token: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  expiresAt: number;
};

export async function PUT(request: Request) {
  try {
    const session = await requireAppUser(request);
    if (!isR2Configured()) return Response.json({ error: "Railway Storage Bucket sozlanmagan." }, { status: 503 });

    const url = new URL(request.url);
    const uploadId = url.searchParams.get("uploadId")?.trim() || "";
    const uploadToken = url.searchParams.get("uploadToken")?.trim() || "";
    if (!uploadId || !uploadToken) return Response.json({ error: "Yuklash tokeni yetishmaydi." }, { status: 400 });

    const db = getKpiDatabase();
    const result = await db.pool.query(
      "SELECT payload FROM upload_intents WHERE id=$1 AND token=$2 AND expires_at>NOW() LIMIT 1",
      [uploadId, uploadToken],
    );
    const intent = (result.rows[0]?.payload as UploadIntent | undefined) ?? null;
    if (!intent) return Response.json({ error: "Yuklash tokeni noto'g'ri yoki eskirgan." }, { status: 403 });
    if (intent.uploadedBy !== session.email) throw new AccessError("Bu yuklash boshqa foydalanuvchiga tegishli.");

    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength !== Number(intent.sizeBytes)) {
      return Response.json({ error: "Fayl hajmi tayyorlangan yuklash hajmiga mos emas." }, { status: 400 });
    }
    if (body.byteLength <= 0 || body.byteLength > 30 * 1024 * 1024) {
      return Response.json({ error: "Fayl hajmi 30 MB dan oshmasligi kerak." }, { status: 400 });
    }

    await putR2Object({
      key: intent.objectKey,
      body,
      contentType: intent.contentType || request.headers.get("content-type") || "application/octet-stream",
    });
    return Response.json({ uploaded: true });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
`;
const blobTarget = path.join(process.cwd(), 'app/api/uploads/blob/route.ts');
fs.mkdirSync(path.dirname(blobTarget), { recursive: true });
fs.writeFileSync(blobTarget, blobRoute, 'utf8');
console.log('Created app/api/uploads/blob/route.ts');

// 2) Orders visible to admin/evaluators and downloadable.
patchFile('app/api/kpi/route.ts', (text) => replaceOnce(
  text,
  '    const attachments = attachmentRows.filter((row) =>\n      validCriteria.has(String(row.criterionId)) && allowedCriteria.has(String(row.criterionId)),\n    );',
  '    const attachments = attachmentRows.filter((row) =>\n      row.source === "institution_order" ||\n      (validCriteria.has(String(row.criterionId)) && allowedCriteria.has(String(row.criterionId))),\n    );',
  'kpi-order-filter',
));

patchFile('app/api/files/route.ts', (text) => {
  text = replaceOnce(
    text,
    '    if (session.role === "evaluator" && criterion?.commission !== session.commission) throw new AccessError("Bu faylni ko‘rish huquqi berilmagan.");',
    '    if (session.role === "evaluator" && row.source !== "institution_order" && criterion?.commission !== session.commission) throw new AccessError("Bu faylni ko‘rish huquqi berilmagan.");',
    'files-order-access',
  );
  text = replaceOnce(
    text,
    '    const signedUrl = await createR2DownloadUrl({ key: row.objectKey, expiresIn: 5 * 60 });',
    '    const signedUrl = await createR2DownloadUrl({ key: row.objectKey, filename: row.filename, contentType: row.contentType, expiresIn: 5 * 60 });',
    'files-download-name',
  );
  return text;
});

// 3) Admin gets a dedicated orders table; evaluator/admin see order in evaluation dialog.
patchFile('components/kpi-app.tsx', (text) => {
  text = replaceOnce(
    text,
    '    : undefined;\n  const session = data.session;',
    '    : undefined;\n  const selectedOrder = selectedInstitution\n    ? data.attachments.find((attachment) => attachment.institutionId === selectedInstitution.id && attachment.source === "institution_order")\n    : undefined;\n  const session = data.session;',
    'selected-order',
  );

  text = replaceOnce(
    text,
    ': <strong>Mas’ul shaxs belgilanmagan</strong>}</div></div><div className="draft-total">',
    ': <strong>Mas’ul shaxs belgilanmagan</strong>}</div>{selectedOrder && <a className="evaluation-order-link" href={`/api/files?id=${selectedOrder.id}`} target="_blank" rel="noreferrer"><Eye /> BUYRUQni ochish</a>}</div><div className="draft-total">',
    'evaluation-order-link',
  );

  text = replaceOnce(
    text,
    '<TabsTrigger value="institutions"><Hospital /> Muassasalar</TabsTrigger><TabsTrigger value="evaluations"><ClipboardCheck /> Baholar va asoslar</TabsTrigger>',
    '<TabsTrigger value="institutions"><Hospital /> Muassasalar</TabsTrigger><TabsTrigger value="orders"><Paperclip /> Yuklangan BUYRUQLAR</TabsTrigger><TabsTrigger value="evaluations"><ClipboardCheck /> Baholar va asoslar</TabsTrigger>',
    'admin-orders-tab',
  );

  text = replaceOnce(
    text,
    '</Table></TabsContent><TabsContent value="evaluations" className="panel-content"><Table>',
    '</Table></TabsContent><TabsContent value="orders" className="panel-content"><Table><TableHeader><TableRow><TableHead>Muassasa</TableHead><TableHead>Mas’ul F.I.Sh.</TableHead><TableHead>Telefon</TableHead><TableHead>Sana</TableHead><TableHead>Fayl</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.attachments.filter((item) => item.source === "institution_order").map((order) => { const institution = data.institutions.find((item) => item.id === order.institutionId); return <TableRow key={order.id}><TableCell className="institution-cell"><strong>{institution?.name || order.institutionId}</strong></TableCell><TableCell>{order.responsibleName || "—"}</TableCell><TableCell>{order.responsiblePhone || "—"}</TableCell><TableCell>{order.submissionDate || "—"}</TableCell><TableCell className="wrap-cell">{order.filename}</TableCell><TableCell className="action-col"><a href={`/api/files?id=${order.id}`} target="_blank" rel="noreferrer"><Eye /> Ochish / yuklab olish</a></TableCell></TableRow>; })}</TableBody></Table></TabsContent><TabsContent value="evaluations" className="panel-content"><Table>',
    'admin-orders-content',
  );

  return text;
});

console.log('KPI order visibility and same-origin upload proxy patch applied.');
