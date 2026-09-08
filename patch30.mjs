import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patchFile(relativePath, transform) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`PATCH30: missing ${relativePath}`);
  const before = fs.readFileSync(filePath, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`PATCH30: no changes applied to ${relativePath}`);
  fs.writeFileSync(filePath, after, "utf8");
  console.log(`PATCH30: patched ${relativePath}`);
}

patchFile("components/public-dashboard.tsx", (source) => {
  let s = source;

  // Public dashboard must be fully open/full-width: remove the private-style left navigation.
  s = s.replace(/\n\s*<aside className="daily-board-sidebar">[\s\S]*?<\/aside>\s*\n/, "\n");

  // Keep API compatibility, but add responsible contact fields used instead of file counts.
  s = s.replace(
    "  fileCount: number;\n  daysEvaluated: number;",
    "  fileCount: number;\n  responsibleName: string;\n  responsiblePhone: string;\n  daysEvaluated: number;",
  );

  s = s.replace(
    "return data.rows.filter((row) => `${row.name} ${row.district} ${row.type}`.toLocaleLowerCase(\"uz\").includes(needle));",
    "return data.rows.filter((row) => `${row.name} ${row.district} ${row.type} ${row.responsibleName || \"\"} ${row.responsiblePhone || \"\"}`.toLocaleLowerCase(\"uz\").includes(needle));",
  );

  s = s.replace(
    'const headers = ["#", "Muassasa", "Tuman / shahar", ...commissions.map((item) => item.short), "Jami", "Maksimal", assessedLabel, "Fayllar", "Holat"];',
    'const headers = ["#", "Muassasa", "Tuman / shahar", ...commissions.map((item) => item.short), "Jami", "Maksimal", assessedLabel, "Mas’ul shaxs", "Telefon", "Holat"];',
  );

  s = s.replace(
    "        row.fileCount,\n        status,",
    "        row.responsibleName || \"—\",\n        row.responsiblePhone || \"—\",\n        status,",
  );

  // Do not expose how many files institutions uploaded on the open dashboard.
  s = s.replace(/\n\s*<article><div className="metric-mark violet"><FileText \/><\/div><div><span>Yuklangan fayllar<\/span><strong>\{data\.fileCount\}<\/strong><small>\{periodLabels\[period\]\} davrida<\/small><\/div><\/article>/, "");

  s = s.replace(
    '<th>{assessedLabel}</th><th>Fayllar</th><th>Holat</th>',
    '<th>{assessedLabel}</th><th>Mas’ul shaxs</th><th>Holat</th>',
  );

  s = s.replace(
    '<td><span className="file-pill">{row.fileCount}</span></td>',
    '<td className="responsible-cell"><strong>{row.responsibleName || "—"}</strong><span>{row.responsiblePhone || "—"}</span></td>',
  );

  return s;
});

patchFile("app/api/dashboard/route.ts", (source) => {
  let s = source;

  s = s.replace(
    "const [institutionResult, dailyResult, fileResult] = await Promise.all([",
    "const [institutionResult, dailyResult, fileResult, responsibleResult] = await Promise.all([",
  );

  const promiseTail = `        [rangeStart, selectedDate],\n      ),\n    ]);`;
  const responsibleQuery = `        [rangeStart, selectedDate],\n      ),\n      db.pool.query(\`\n        SELECT DISTINCT ON (institution_id)\n               institution_id AS \"institutionId\",\n               COALESCE(NULLIF(TRIM(responsible_name), ''), '') AS \"responsibleName\",\n               COALESCE(NULLIF(TRIM(responsible_phone), ''), '') AS \"responsiblePhone\"\n          FROM attachments\n         WHERE COALESCE(TRIM(responsible_name), '') <> ''\n            OR COALESCE(TRIM(responsible_phone), '') <> ''\n         ORDER BY institution_id,\n                  CASE WHEN source = 'institution_order' THEN 0 ELSE 1 END,\n                  created_at DESC\n      \`),\n    ]);`;
  if (!s.includes(promiseTail)) throw new Error("PATCH30: dashboard Promise.all anchor not found");
  s = s.replace(promiseTail, responsibleQuery);

  const buildAnchor = "    const buildDaily = (institution: Institution, date: string) => {";
  const responsibleBlock = `    const responsibleMap = new Map<string, { responsibleName: string; responsiblePhone: string }>();\n    for (const row of responsibleResult.rows) {\n      responsibleMap.set(String(row.institutionId), {\n        responsibleName: String(row.responsibleName || \"\"),\n        responsiblePhone: String(row.responsiblePhone || \"\"),\n      });\n    }\n    const responsibleFor = (institutionId: string) => responsibleMap.get(institutionId) ?? { responsibleName: \"\", responsiblePhone: \"\" };\n\n${buildAnchor}`;
  if (!s.includes(buildAnchor)) throw new Error("PATCH30: buildDaily anchor not found");
  s = s.replace(buildAnchor, responsibleBlock);

  const rowsBlock = `    const rows = institutions.map((institution) => {\n      if (period === \"monthly\") return buildMonthly(institution);\n      if (period === \"60d\") return build60(institution);\n      return buildDaily(institution, selectedDate);\n    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, \"uz\"));`;
  const rowsReplacement = `    const rows = institutions.map((institution) => {\n      let row;\n      if (period === \"monthly\") row = buildMonthly(institution);\n      else if (period === \"60d\") row = build60(institution);\n      else row = buildDaily(institution, selectedDate);\n      return { ...row, ...responsibleFor(institution.id) };\n    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, \"uz\"));`;
  if (!s.includes(rowsBlock)) throw new Error("PATCH30: rows anchor not found");
  s = s.replace(rowsBlock, rowsReplacement);

  return s;
});

const cssPath = path.join(root, "app/globals.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PATCH30_PUBLIC_FULLWIDTH_RESPONSIBLE_CONTACT */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.daily-board-sidebar{display:none!important}\n.daily-board-main{margin-left:0!important;width:100%!important;max-width:100%!important}\n.daily-board-metrics{grid-template-columns:repeat(4,minmax(0,1fr))!important}\n.responsible-cell{min-width:190px}\n.responsible-cell strong{display:block;font-size:10.5px;color:#17324d;line-height:1.25}\n.responsible-cell span{display:block;margin-top:3px;font-size:10px;font-weight:700;color:#0877c9;white-space:nowrap}\n@media(max-width:1050px){.daily-board-main{margin-left:0!important;width:100%!important}.daily-board-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}}\n@media(max-width:430px){.daily-board-metrics{grid-template-columns:1fr!important}}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
  console.log("PATCH30: full-width public dashboard CSS added");
}

console.log("PATCH30: public sidebar removed; institution file counts hidden and replaced with responsible person name/phone.");
