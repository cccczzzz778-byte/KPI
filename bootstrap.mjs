import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const parts = fs.readdirSync(process.cwd())
  .filter((name) => /^source\.bundle\.\d+\.b64$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));
if (!parts.length) process.exit(0);
const packed = parts
  .map((name) => fs.readFileSync(path.join(process.cwd(), name), 'utf8').replace(/[^A-Za-z0-9+/=]/g, ''))
  .join('');
const data = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
for (const [relative, value] of Object.entries(data)) {
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (value && typeof value === 'object' && value.__base64__) fs.writeFileSync(target, Buffer.from(value.__base64__, 'base64'));
  else fs.writeFileSync(target, String(value), 'utf8');
}
console.log(`Restored ${Object.keys(data).length} source files.`);

function patchFile(relative, transform) {
  const target = path.join(process.cwd(), relative);
  const original = fs.readFileSync(target, 'utf8');
  const next = transform(original);
  if (next === original) throw new Error(`Required patch did not match: ${relative}`);
  fs.writeFileSync(target, next, 'utf8');
  console.log(`Patched ${relative}`);
}

// Evaluators must receive the institution's one-time BUYRUQ attachment together with
// the criterion attachments that belong to their own commission.
patchFile('app/api/kpi/route.ts', (text) => {
  const anchor = text.indexOf('attachmentsResult.rows');
  if (anchor < 0) return text;
  const candidates = [
    'allowedCriteria.has(String(item.criterionId))',
    'allowedCriteria.has(item.criterionId)',
    'allowedCriteria.has(String(item.criterion_id))',
    'allowedCriteria.has(item.criterion_id)',
  ];
  for (const candidate of candidates) {
    const local = text.slice(anchor).indexOf(candidate);
    if (local >= 0) {
      const pos = anchor + local;
      return text.slice(0, pos) + `(${candidate} || item.source === "institution_order")` + text.slice(pos + candidate.length);
    }
  }
  return text;
});

// BUYRUQ does not belong to a KPI criterion, so allow evaluators to open files whose
// criterion lookup is empty; ordinary criterion files remain commission-protected.
patchFile('app/api/files/route.ts', (text) => {
  const variants = [
    'if (session.role === "evaluator" && criterion?.commission !== session.commission)',
    "if (session.role === 'evaluator' && criterion?.commission !== session.commission)",
  ];
  for (const variant of variants) {
    if (text.includes(variant)) {
      const quote = variant.includes('"evaluator"') ? '"' : "'";
      return text.replace(
        variant,
        `if (session.role === ${quote}evaluator${quote} && criterion?.commission && criterion.commission !== session.commission)`,
      );
    }
  }
  return text;
});

patchFile('components/kpi-app.tsx', (text) => {
  let next = text;

  const sessionAnchor = '  const session = data.session;';
  if (!next.includes(sessionAnchor)) return text;
  next = next.replace(
    sessionAnchor,
    '  const selectedOrder = selectedInstitution\n' +
      '    ? data.attachments.find((attachment) => attachment.institutionId === selectedInstitution.id && attachment.source === "institution_order")\n' +
      '    : undefined;\n' +
      sessionAnchor,
  );

  const headerAnchor = ': <strong>Mas’ul shaxs belgilanmagan</strong>}</div></div><div className="draft-total">';
  if (!next.includes(headerAnchor)) return text;
  next = next.replace(
    headerAnchor,
    ': <strong>Mas’ul shaxs belgilanmagan</strong>}</div>{selectedOrder && <a className="login-button" href={`/api/files?id=${encodeURIComponent(selectedOrder.id)}`} target="_blank" rel="noreferrer"><Paperclip /> BUYRUQni ochish</a>}</div><div className="draft-total">',
  );

  const tabAnchor = '<TabsTrigger value="institutions"><Hospital /> Muassasalar</TabsTrigger><TabsTrigger value="evaluations">';
  if (!next.includes(tabAnchor)) return text;
  next = next.replace(
    tabAnchor,
    '<TabsTrigger value="institutions"><Hospital /> Muassasalar</TabsTrigger><TabsTrigger value="orders"><FileCheck2 /> Yuklangan BUYRUQLAR</TabsTrigger><TabsTrigger value="evaluations">',
  );

  const evaluationsAnchor = '<TabsContent value="evaluations" className="panel-content">';
  if (!next.includes(evaluationsAnchor)) return text;
  const ordersPanel = '<TabsContent value="orders" className="panel-content"><div className="table-actionbar"><p>Muassasalar yuklagan BUYRUQ (chora-tadbir) fayllari. Bu ro‘yxatda o‘chirish amali yo‘q.</p></div><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Muassasa</TableHead><TableHead>Mas’ul F.I.Sh.</TableHead><TableHead>Telefon</TableHead><TableHead>Yuklangan sana</TableHead><TableHead>Fayl</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.attachments.filter((item) => item.source === "institution_order").map((attachment, index) => { const institution = data.institutions.find((item) => item.id === attachment.institutionId); return <TableRow key={attachment.id}><TableCell>{index + 1}</TableCell><TableCell className="institution-cell"><strong>{institution?.name || attachment.institutionId}</strong></TableCell><TableCell>{attachment.responsibleName || "—"}</TableCell><TableCell>{attachment.responsiblePhone || "—"}</TableCell><TableCell>{attachment.submissionDate || new Date(attachment.createdAt).toLocaleDateString("uz-UZ")}</TableCell><TableCell className="wrap-cell"><Paperclip /> {attachment.filename}</TableCell><TableCell className="action-col"><a className="login-button" href={`/api/files?id=${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer"><Eye /> Ochish</a></TableCell></TableRow>; })}</TableBody></Table></TabsContent>';
  next = next.replace(evaluationsAnchor, ordersPanel + evaluationsAnchor);

  return next;
});
