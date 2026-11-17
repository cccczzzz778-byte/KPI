import fs from "node:fs";
const file = "components/period-comparison-panel.tsx";
if (!fs.existsSync(file)) throw new Error("PATCH107: period panel not found");
let s = fs.readFileSync(file, "utf8");
const oldRows = "const topRows = useMemo(() => data?.rows.slice(0, 12) ?? [], [data]);";
const newRows = "const topRows = useMemo(() => data?.rows ?? [], [data]);";
if (s.includes(oldRows)) {
  s = s.replace(oldRows, newRows);
} else if (!s.includes(newRows)) {
  throw new Error("PATCH107: row anchor missing");
}
fs.writeFileSync(file, s, "utf8");
console.log("PATCH107: full period comparison list; no administrative rank column.");
