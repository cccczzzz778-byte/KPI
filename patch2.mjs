import fs from 'node:fs';
import path from 'node:path';

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

// Preserve all existing records and only remove the old one-order unique restriction.
const migrationTarget = path.join(process.cwd(), 'netlify/database/migrations/009_allow-two-institution-orders/migration.sql');
fs.mkdirSync(path.dirname(migrationTarget), { recursive: true });
fs.writeFileSync(
  migrationTarget,
  `-- Existing BUYRUQ files are preserved. Only the old one-file unique index is removed.\nDROP INDEX IF EXISTS institution_order_once;\n`,
  'utf8',
);
console.log('Created migration 009_allow-two-institution-orders');

// Allow up to two BUYRUQ attachments per institution.
patchFile('app/api/uploads/prepare/route.ts', (text) => {
  text = replaceOnce(
    text,
    `db.pool.query("SELECT id FROM attachments WHERE institution_id = $1 AND source = 'institution_order' LIMIT 1", [institutionId]),`,
    `db.pool.query("SELECT id FROM attachments WHERE institution_id = $1 AND source = 'institution_order' LIMIT 2", [institutionId]),`,
    'prepare-order-limit-query',
  );
  text = replaceOnce(
    text,
    `if (existingResult.rowCount) return Response.json({ error: "BUYRUQ avval yuklangan. Qayta yuklash bloklangan." }, { status: 409 });`,
    `if ((existingResult.rowCount ?? 0) >= 2) return Response.json({ error: "BUYRUQ uchun 2 ta fayl allaqachon yuklangan." }, { status: 409 });`,
    'prepare-order-limit-check',
  );
  return text;
});

patchFile('app/api/uploads/complete/route.ts', (text) => {
  text = replaceOnce(
    text,
    `const existing = await db.pool.query("SELECT id FROM attachments WHERE institution_id = $1 AND source = 'institution_order' LIMIT 1", [intent.institutionId]);`,
    `const existing = await db.pool.query("SELECT id FROM attachments WHERE institution_id = $1 AND source = 'institution_order' LIMIT 2", [intent.institutionId]);`,
    'complete-order-limit-query',
  );
  text = replaceOnce(
    text,
    `if (existing.rowCount) {\n        await cleanUp(uploadId, intent);\n        return Response.json({ error: "BUYRUQ avval yuklangan. Qayta yuklash bloklangan." }, { status: 409 });\n      }`,
    `if ((existing.rowCount ?? 0) >= 2) {\n        await cleanUp(uploadId, intent);\n        return Response.json({ error: "BUYRUQ uchun 2 ta fayl allaqachon yuklangan." }, { status: 409 });\n      }`,
    'complete-order-limit-check',
  );
  return text;
});

// Return all existing BUYRUQ attachments without touching the old one.
patchFile('app/api/institution/route.ts', (text) => {
  text = replaceOnce(
    text,
    `db.pool.query(\`SELECT id, filename, size_bytes AS \\"sizeBytes\\", TO_CHAR(submission_date, 'YYYY-MM-DD') AS \\"submissionDate\\", created_at AS \\"createdAt\\" FROM attachments WHERE institution_id = $1 AND source = 'institution_order' LIMIT 1\`, [session.institutionId]),`,
    `db.pool.query(\`SELECT id, filename, size_bytes AS \\"sizeBytes\\", TO_CHAR(submission_date, 'YYYY-MM-DD') AS \\"submissionDate\\", created_at AS \\"createdAt\\" FROM attachments WHERE institution_id = $1 AND source = 'institution_order' ORDER BY created_at ASC\`, [session.institutionId]),`,
    'institution-orders-query',
  );
  text = replaceOnce(
    text,
    `order: orderResult.rows[0] ?? null,`,
    `order: orderResult.rows[0] ?? null,\n      orders: orderResult.rows,`,
    'institution-orders-response',
  );
  return text;
});

// Institution portal: keep old files visible and let one-time window accept up to 2 files.
patchFile('components/institution-portal.tsx', (text) => {
  text = replaceOnce(
    text,
    `order: { id: string; filename: string; sizeBytes: number; submissionDate: string; createdAt: string } | null;`,
    `order: { id: string; filename: string; sizeBytes: number; submissionDate: string; createdAt: string } | null;\n  orders: Array<{ id: string; filename: string; sizeBytes: number; submissionDate: string; createdAt: string }>;`,
    'portal-orders-type',
  );
  text = replaceOnce(
    text,
    `const [orderFile, setOrderFile] = useState<File | null>(null);`,
    `const [orderFiles, setOrderFiles] = useState<File[]>([]);`,
    'portal-order-files-state',
  );

  const oldUploadOrder = `  async function uploadOrder() {\n    if (!data?.orderIsOpen) { toast.error("BUYRUQ yuklash oynasi hozir yopiq."); return; }\n    if (data.order) { toast.error("BUYRUQ avval yuklangan va bloklangan."); return; }\n    if (!responsibleName.trim()) { toast.error("Mas’ul shaxs F.I.Sh.ni kiriting."); return; }\n    if (!responsiblePhone.trim()) { toast.error("Mas’ul shaxs telefon raqamini kiriting."); return; }\n    if (!orderFile) { toast.error("BUYRUQ (chora-tadbir) faylini tanlang."); return; }\n    if (orderFile.size > MAX_FILE_BYTES) { toast.error("Fayl hajmi 30 MB dan oshmasligi kerak."); return; }\n    setUploadingOrder(true);\n    try {\n      await uploadFileToNetlify({\n        kind: "institution_order",\n        file: orderFile,\n        responsibleName: responsibleName.trim(),\n        responsiblePhone: responsiblePhone.trim(),\n      });\n      setOrderFile(null);\n      toast.success("BUYRUQ yuklandi. Mas’ul shaxs barcha mezon fayllariga biriktirildi.");\n      await loadData();\n    } catch (error) {\n      toast.error(error instanceof Error ? error.message : "BUYRUQ yuklashda xatolik.");\n    } finally { setUploadingOrder(false); }\n  }`;

  const newUploadOrder = `  async function uploadOrder() {\n    if (!data?.orderIsOpen) { toast.error("BUYRUQ yuklash oynasi hozir yopiq."); return; }\n    const existingOrderCount = data.orders?.length ?? (data.order ? 1 : 0);\n    if (existingOrderCount >= 2) { toast.error("BUYRUQ uchun 2 ta fayl allaqachon yuklangan."); return; }\n    const uploadResponsibleName = data.responsible?.responsibleName?.trim() || responsibleName.trim();\n    const uploadResponsiblePhone = data.responsible?.responsiblePhone?.trim() || responsiblePhone.trim();\n    if (!uploadResponsibleName) { toast.error("Mas’ul shaxs F.I.Sh.ni kiriting."); return; }\n    if (!uploadResponsiblePhone) { toast.error("Mas’ul shaxs telefon raqamini kiriting."); return; }\n    if (!orderFiles.length) { toast.error("BUYRUQ (chora-tadbir) faylini tanlang."); return; }\n    if (existingOrderCount + orderFiles.length > 2) { toast.error("Jami 2 tagacha BUYRUQ fayli yuklash mumkin."); return; }\n    if (orderFiles.some((file) => file.size > MAX_FILE_BYTES)) { toast.error("Har bir fayl hajmi 30 MB dan oshmasligi kerak."); return; }\n    setUploadingOrder(true);\n    let uploadedCount = 0;\n    try {\n      for (const file of orderFiles) {\n        await uploadFileToNetlify({\n          kind: "institution_order",\n          file,\n          responsibleName: uploadResponsibleName,\n          responsiblePhone: uploadResponsiblePhone,\n        });\n        uploadedCount += 1;\n      }\n      setOrderFiles([]);\n      toast.success(uploadedCount === 2 ? "2 ta BUYRUQ fayli yuklandi." : "BUYRUQ fayli yuklandi.");\n      await loadData();\n    } catch (error) {\n      if (uploadedCount > 0) await loadData();\n      toast.error(error instanceof Error ? error.message : "BUYRUQ yuklashda xatolik.");\n    } finally { setUploadingOrder(false); }\n  }`;
  text = replaceOnce(text, oldUploadOrder, newUploadOrder, 'portal-upload-order-function');

  const oldCard = `      <section className="responsible-card">\n        <div className="responsible-title"><FileCheck2 /><div><strong>BUYRUQ (CHORA-TADBIR) — 1 MARTALIK</strong><span>Mas’ul shaxs shu yerda bir marta belgilanadi va barcha keyingi fayllarga avtomatik javobgar bo‘ladi.</span></div></div>\n        {data.order && data.responsible ? <div className="institution-submitted">\n          <div><CheckCircle2 /><strong>BUYRUQ yuklangan — qayta yuklash bloklangan</strong></div>\n          <a href={\`/api/files?id=\${encodeURIComponent(data.order.id)}\`}><Paperclip /> {data.order.filename} <small>{formatBytes(data.order.sizeBytes)}</small></a>\n          <p><b>Mas’ul:</b> {data.responsible.responsibleName} · {data.responsible.responsiblePhone}</p>\n        </div> : <>\n          <label>Mas’ul shaxs F.I.Sh.<Input value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} placeholder="Masalan: Aliyev Ali Valiyevich" /></label>\n          <label>Telefon raqami<div className="phone-field"><Phone /><Input value={responsiblePhone} onChange={(event) => setResponsiblePhone(event.target.value)} placeholder="+998 90 123 45 67" /></div></label>\n          <label className="institution-file-picker"><FileUp /><div><strong>{orderFile?.name || "BUYRUQ (chora-tadbir) faylini tanlash"}</strong><span>PDF, JPEG, Word, Excel · 30 MB gacha</span></div><input type="file" accept={ACCEPT} disabled={!data.orderIsOpen} onChange={(event) => setOrderFile(event.target.files?.[0] ?? null)} /></label>\n          <Button disabled={!data.orderIsOpen || !orderFile || uploadingOrder} onClick={() => void uploadOrder()}>{uploadingOrder ? <Loader2 className="animate-spin" /> : <FileUp />} BUYRUQni bir marta yuklash</Button>\n        </>}\n      </section>`;

  const newCard = `      <section className="responsible-card">\n        <div className="responsible-title"><FileCheck2 /><div><strong>BUYRUQ (CHORA-TADBIR) — 2 TAGACHA FAYL</strong><span>Mas’ul shaxs bir marta belgilanadi. Oldin yuklangan BUYRUQ fayllari saqlanadi va jami 2 tagacha fayl yuklash mumkin.</span></div></div>\n        {(data.orders?.length ?? 0) > 0 && data.responsible && <div className="institution-submitted">\n          <div><CheckCircle2 /><strong>{data.orders.length} ta BUYRUQ fayli yuklangan</strong></div>\n          {data.orders.map((order, index) => <a key={order.id} href={\`/api/files?id=\${encodeURIComponent(order.id)}\`}><Paperclip /> BUYRUQ {index + 1}: {order.filename} <small>{formatBytes(order.sizeBytes)}</small></a>)}\n          <p><b>Mas’ul:</b> {data.responsible.responsibleName} · {data.responsible.responsiblePhone}</p>\n        </div>}\n        {(data.orders?.length ?? 0) < 2 && <>\n          {!data.responsible && <>\n            <label>Mas’ul shaxs F.I.Sh.<Input value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} placeholder="Masalan: Aliyev Ali Valiyevich" /></label>\n            <label>Telefon raqami<div className="phone-field"><Phone /><Input value={responsiblePhone} onChange={(event) => setResponsiblePhone(event.target.value)} placeholder="+998 90 123 45 67" /></div></label>\n          </>}\n          <label className="institution-file-picker"><FileUp /><div><strong>{orderFiles.length ? orderFiles.map((file) => file.name).join(", ") : (data.orders?.length ?? 0) === 1 ? "2-BUYRUQ faylini tanlash" : "1 yoki 2 ta BUYRUQ faylini tanlash"}</strong><span>PDF, JPEG, Word, Excel · 2 tagacha · har biri 30 MB gacha</span></div><input type="file" accept={ACCEPT} multiple disabled={!data.orderIsOpen} onChange={(event) => { const selected = Array.from(event.target.files ?? []); if (selected.length + (data.orders?.length ?? 0) > 2) { toast.error("Jami 2 tagacha BUYRUQ fayli tanlash mumkin."); event.currentTarget.value = ""; setOrderFiles([]); return; } setOrderFiles(selected); }} /></label>\n          <Button disabled={!data.orderIsOpen || !orderFiles.length || uploadingOrder} onClick={() => void uploadOrder()}>{uploadingOrder ? <Loader2 className="animate-spin" /> : <FileUp />} {(data.orders?.length ?? 0) === 1 ? "2-BUYRUQ faylini yuklash" : "BUYRUQ fayllarini yuklash"}</Button>\n        </>}\n      </section>`;
  text = replaceOnce(text, oldCard, newCard, 'portal-order-card');
  return text;
});

// Admin can delete BUYRUQ files; admin/evaluator evaluation dialog shows both files.
patchFile('components/kpi-app.tsx', (text) => {
  text = replaceOnce(
    text,
    `  const selectedOrder = selectedInstitution\n    ? data.attachments.find((attachment) => attachment.institutionId === selectedInstitution.id && attachment.source === "institution_order")\n    : undefined;`,
    `  const selectedOrders = selectedInstitution\n    ? data.attachments.filter((attachment) => attachment.institutionId === selectedInstitution.id && attachment.source === "institution_order")\n    : [];`,
    'selected-orders',
  );

  text = replaceOnce(
    text,
    `: <strong>Mas’ul shaxs belgilanmagan</strong>}</div>{selectedOrder && <a className="evaluation-order-link" href={\`/api/files?id=\${selectedOrder.id}\`} target="_blank" rel="noreferrer"><Eye /> BUYRUQni ochish</a>}</div><div className="draft-total">`,
    `: <strong>Mas’ul shaxs belgilanmagan</strong>}</div>{selectedOrders.map((order, index) => <a key={order.id} className="evaluation-order-link" href={\`/api/files?id=\${order.id}\`} target="_blank" rel="noreferrer"><Eye /> {selectedOrders.length > 1 ? \`BUYRUQ \${index + 1} — ochish\` : "BUYRUQni ochish"}</a>)}</div><div className="draft-total">`,
    'evaluation-orders-links',
  );

  text = replaceOnce(
    text,
    `<AdminPanel data={data} onRefresh={() => void loadData()} onAddUser={() => openUser()} onEditUser={openUser} onAddInstitution={() => openInstitution()} onEditInstitution={openInstitution} onOpenEvaluation={openEvaluation} selectedRound={selectedRound} />`,
    `<AdminPanel data={data} onRefresh={() => void loadData()} onAddUser={() => openUser()} onEditUser={openUser} onAddInstitution={() => openInstitution()} onEditInstitution={openInstitution} onOpenEvaluation={openEvaluation} onDeleteAttachment={deleteAttachment} selectedRound={selectedRound} />`,
    'admin-panel-delete-prop-call',
  );

  text = replaceOnce(
    text,
    `function AdminPanel({ data, onRefresh, onAddUser, onEditUser, onAddInstitution, onEditInstitution, onOpenEvaluation, selectedRound }: { data: DashboardData; onRefresh: () => void; onAddUser: () => void; onEditUser: (user: AppUser) => void; onAddInstitution: () => void; onEditInstitution: (institution: Institution) => void; onOpenEvaluation: (institution: Institution) => void; selectedRound: number }) {`,
    `function AdminPanel({ data, onRefresh, onAddUser, onEditUser, onAddInstitution, onEditInstitution, onOpenEvaluation, onDeleteAttachment, selectedRound }: { data: DashboardData; onRefresh: () => void; onAddUser: () => void; onEditUser: (user: AppUser) => void; onAddInstitution: () => void; onEditInstitution: (institution: Institution) => void; onOpenEvaluation: (institution: Institution) => void; onDeleteAttachment: (id: string) => void; selectedRound: number }) {`,
    'admin-panel-delete-prop-signature',
  );

  text = replaceOnce(
    text,
    `<TableCell className="action-col"><a href={\`/api/files?id=\${order.id}\`} target="_blank" rel="noreferrer"><Eye /> Ochish / yuklab olish</a></TableCell>`,
    `<TableCell className="action-col"><a href={\`/api/files?id=\${order.id}\`} target="_blank" rel="noreferrer"><Eye /> Ochish / yuklab olish</a><Button variant="ghost" size="sm" onClick={() => void onDeleteAttachment(order.id)}><Trash2 /> O‘chirish</Button></TableCell>`,
    'admin-order-delete-button',
  );

  return text;
});

console.log('KPI two-order upload + admin order deletion patch applied. Existing files are preserved.');