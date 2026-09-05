import fs from 'node:fs';
import path from 'node:path';

function copyTemplate(template, relative) {
  const source = path.join(process.cwd(), template);
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
  console.log(`Created ${relative}`);
}

function writeSource(relative, content) {
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
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

writeSource('app/api/institution/history/route.ts', "import { criteria } from \"@/lib/kpi-data\";\nimport { getKpiDatabase } from \"@/lib/netlify-db\";\nimport { accessErrorResponse, AccessError, requireAppUser } from \"@/lib/server-auth\";\n\nexport const runtime = \"nodejs\";\n\nexport async function GET(request: Request) {\n  try {\n    const session = await requireAppUser(request);\n    if (session.role !== \"institution\" || !session.institutionId) {\n      throw new AccessError(\"Bu bo‘lim faqat muassasa kabineti uchun.\", 403);\n    }\n\n    const db = getKpiDatabase();\n    const result = await db.pool.query(\n      `SELECT id,\n              criterion_id AS \"criterionId\",\n              round_day AS \"roundDay\",\n              filename,\n              content_type AS \"contentType\",\n              size_bytes AS \"sizeBytes\",\n              source,\n              responsible_name AS \"responsibleName\",\n              responsible_phone AS \"responsiblePhone\",\n              TO_CHAR(submission_date, 'YYYY-MM-DD') AS \"submissionDate\",\n              created_at AS \"createdAt\"\n         FROM attachments\n        WHERE institution_id = $1\n        ORDER BY created_at DESC`,\n      [session.institutionId],\n    );\n\n    const items = result.rows.map((row) => {\n      const criterion = criteria.find((item) => item.id === row.criterionId);\n      const criterionTitle = row.source === \"institution_order\"\n        ? \"BUYRUQ (chora-tadbir)\"\n        : criterion?.title || row.criterionId || \"Mezon ko‘rsatilmagan\";\n      return { ...row, criterionTitle };\n    });\n\n    return Response.json({ items });\n  } catch (error) {\n    return accessErrorResponse(error);\n  }\n}\n");

writeSource('components/institution-file-history.tsx', "\"use client\";\n\nimport { useEffect, useMemo, useState } from \"react\";\n\ntype HistoryItem = {\n  id: string;\n  criterionId: string;\n  criterionTitle: string;\n  roundDay: number | null;\n  filename: string;\n  contentType: string;\n  sizeBytes: number;\n  source: string;\n  responsibleName?: string;\n  responsiblePhone?: string;\n  submissionDate?: string;\n  createdAt?: string;\n};\n\nfunction formatBytes(bytes: number) {\n  if (!Number.isFinite(bytes) || bytes <= 0) return \"—\";\n  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;\n  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;\n}\n\nfunction formatDate(item: HistoryItem) {\n  if (item.submissionDate) return item.submissionDate;\n  if (!item.createdAt) return \"—\";\n  const date = new Date(item.createdAt);\n  return Number.isNaN(date.getTime()) ? item.createdAt : date.toLocaleDateString(\"uz-UZ\");\n}\n\nexport function InstitutionFileHistory() {\n  const [items, setItems] = useState<HistoryItem[]>([]);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState(\"\");\n  const [query, setQuery] = useState(\"\");\n\n  useEffect(() => {\n    let active = true;\n    fetch(\"/api/institution/history\", { cache: \"no-store\" })\n      .then(async (response) => {\n        const payload = await response.json() as { items?: HistoryItem[]; error?: string };\n        if (!response.ok) throw new Error(payload.error || \"Fayllar tarixini yuklab bo‘lmadi.\");\n        return payload.items || [];\n      })\n      .then((rows) => { if (active) setItems(rows); })\n      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : \"Xatolik yuz berdi.\"); })\n      .finally(() => { if (active) setLoading(false); });\n    return () => { active = false; };\n  }, []);\n\n  const filtered = useMemo(() => {\n    const value = query.trim().toLocaleLowerCase(\"uz\");\n    if (!value) return items;\n    return items.filter((item) =>\n      item.filename.toLocaleLowerCase(\"uz\").includes(value) ||\n      item.criterionTitle.toLocaleLowerCase(\"uz\").includes(value) ||\n      formatDate(item).includes(value),\n    );\n  }, [items, query]);\n\n  return <section className=\"responsible-card\" style={{ marginTop: 16 }}>\n    <div style={{ display: \"flex\", alignItems: \"flex-start\", justifyContent: \"space-between\", gap: 12, flexWrap: \"wrap\" }}>\n      <div>\n        <strong style={{ display: \"block\", fontSize: 16 }}>YUKLANGAN FAYLLAR TARIXI</strong>\n        <span style={{ opacity: 0.75 }}>Qaysi mezonga va qaysi sanada fayl yuklanganini shu yerda ko‘rishingiz mumkin.</span>\n      </div>\n      <input\n        value={query}\n        onChange={(event) => setQuery(event.target.value)}\n        placeholder=\"Mezon, sana yoki fayl bo‘yicha qidirish\"\n        style={{ minWidth: 280, maxWidth: \"100%\", border: \"1px solid var(--border)\", borderRadius: 8, padding: \"9px 11px\", background: \"transparent\" }}\n      />\n    </div>\n\n    {loading ? <p style={{ marginTop: 14 }}>Fayllar tarixi yuklanmoqda...</p> : error ? <p style={{ marginTop: 14 }}>{error}</p> : filtered.length === 0 ? <p style={{ marginTop: 14 }}>Hozircha yuklangan fayl topilmadi.</p> :\n      <div style={{ overflowX: \"auto\", marginTop: 14 }}>\n        <table style={{ width: \"100%\", borderCollapse: \"collapse\", minWidth: 760 }}>\n          <thead>\n            <tr style={{ textAlign: \"left\" }}>\n              <th style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>Sana</th>\n              <th style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>Mezon</th>\n              <th style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>Nazorat</th>\n              <th style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>Fayl</th>\n              <th style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>Hajm</th>\n              <th style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>Amal</th>\n            </tr>\n          </thead>\n          <tbody>\n            {filtered.map((item) => <tr key={item.id}>\n              <td style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>{formatDate(item)}</td>\n              <td style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\", maxWidth: 360 }}><strong>{item.criterionTitle}</strong></td>\n              <td style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\" }}>{item.roundDay ? `${item.roundDay}-kunlik` : \"—\"}</td>\n              <td style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\", maxWidth: 280, overflowWrap: \"anywhere\" }}>{item.filename}</td>\n              <td style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\", whiteSpace: \"nowrap\" }}>{formatBytes(Number(item.sizeBytes))}</td>\n              <td style={{ padding: \"10px 8px\", borderBottom: \"1px solid var(--border)\", whiteSpace: \"nowrap\" }}>\n                <a href={`/api/files?id=${encodeURIComponent(item.id)}`} target=\"_blank\" rel=\"noreferrer\" style={{ fontWeight: 700, textDecoration: \"underline\" }}>Ochish / yuklab olish</a>\n              </td>\n            </tr>)}\n          </tbody>\n        </table>\n      </div>}\n  </section>;\n}\n");

patchFile('components/institution-portal.tsx', (text) => {
  if (!text.includes('InstitutionFileHistory')) {
    const importLine = 'import { InstitutionFileHistory } from "@/components/institution-file-history";';
    if (text.includes('"use client";')) text = text.replace('"use client";', '"use client";\n\n' + importLine);
    else if (text.includes("'use client';")) text = text.replace("'use client';", "'use client';\n\n" + importLine);
    else throw new Error('institution portal use client anchor not found');
  }

  if (!text.includes('<InstitutionFileHistory />')) {
    const cardAnchor = '<section className="responsible-card">';
    if (!text.includes(cardAnchor)) throw new Error('institution history card anchor not found');
    text = text.replace(cardAnchor, '<InstitutionFileHistory />\n      ' + cardAnchor);
  }

  let acceptChanged = false;
  text = text.replace(/const ACCEPT\s*=\s*(["'])([^"']*)\1;/, (_match, quote, value) => {
    const parts = String(value).split(',').map((item) => item.trim()).filter(Boolean);
    for (const extension of ['.zip', '.rar']) if (!parts.includes(extension)) parts.push(extension);
    acceptChanged = true;
    return `const ACCEPT = ${quote}${parts.join(',')}${quote};`;
  });
  if (!acceptChanged) throw new Error('institution ACCEPT constant anchor not found');

  text = text.replaceAll('PDF, JPEG, Word, Excel', 'PDF, JPEG, Word, Excel, ZIP, RAR');
  return text;
});

patchFile('app/api/uploads/prepare/route.ts', (text) => {
  const oldSet = 'const INSTITUTION_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"]);';
  const newSet = 'const INSTITUTION_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "doc", "docx", "xls", "xlsx", "zip", "rar"]);';
  if (!text.includes(oldSet)) throw new Error('institution extension set anchor not found');
  text = text.replace(oldSet, newSet);
  text = text.replaceAll('Faqat PDF, JPEG, Word yoki Excel fayl yuklash mumkin.', 'Faqat PDF, JPEG, Word, Excel, ZIP yoki RAR fayl yuklash mumkin.');
  return text;
});

console.log('Admin manager + institution file history + ZIP/RAR upload patch applied.');
