import fs from "node:fs";
const file = "components/period-comparison-panel.tsx";
if (!fs.existsSync(file)) throw new Error("PATCH107: period panel not found");
let s = fs.readFileSync(file, "utf8");
const tag = "PATCH107_QORAKOL_ADMIN_RANK";
if (!s.includes(tag)) {
  const oldRows = "const topRows = useMemo(() => data?.rows.slice(0, 12) ?? [], [data]);";
  const newRows = 'const topRows = useMemo(() => data?.rows ?? [], [data]);\\n  // PATCH107_QORAKOL_ADMIN_RANK: administrative rank is separate from calculated scores.\\n  const isQorakol = (row: Row) => /qorako.?l|qorakol|karakul|коракол|қорақол|қоракўл/i.test(row.name + " " + row.district);';
  if (!s.includes(oldRows)) throw new Error("PATCH107: row anchor missing");
  s = s.replace(oldRows, newRows);
  const oldHeader = "<th>Dinamika</th></tr></thead>";
  const newHeader = "<th>Dinamika</th><th>Admin tasdiqlagan o‘rin<small>Hisoblangan reytingdan alohida</small></th></tr></thead>";
  if (!s.includes(oldHeader)) throw new Error("PATCH107: header anchor missing");
  s = s.replace(oldHeader, newHeader);
  const oldCell = "<td><Trend value={row.delta} /></td></tr>)}</tbody>";
  const newCell = '<td><Trend value={row.delta} /></td><td>{isQorakol(row) ? <strong title="Sentabr, oktabr va ikki oylik jami uchun admin tasdiqlagan o‘rin; KPI ballari o‘zgartirilmagan">25 — admin (sentabr, oktabr, jami)</strong> : "—"}</td></tr>)}</tbody>';
  if (!s.includes(oldCell)) throw new Error("PATCH107: cell anchor missing");
  s = s.replace(oldCell, newCell);
  fs.writeFileSync(file, s, "utf8");
}
console.log("PATCH107: Qorako‘l administrator-designated 25th place shown separately; scoring unchanged.");
