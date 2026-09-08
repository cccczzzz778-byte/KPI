import fs from "node:fs";

function printSnippets(file, needles, before = 20, after = 45) {
  if (!fs.existsSync(file)) {
    console.log(`PATCH29SRC|${file}|MISSING`);
    return;
  }
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const selected = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (needles.some((needle) => lines[i].includes(needle))) {
      for (let j = Math.max(0, i - before); j < Math.min(lines.length, i + after + 1); j++) selected.add(j);
    }
  }
  for (const index of [...selected].sort((a,b)=>a-b)) {
    console.log(`PATCH29SRC|${file}|${index + 1}|${lines[index]}`);
  }
}

printSnippets("components/public-dashboard.tsx", [
  "Muassasalar reytingi",
  "10-kunlik nazorat",
  "YETAKCHI NATIJA",
  "O‘RTACHA KPI",
  "JAMI KPI",
  "MAS’UL SHAXS",
  "fetch(",
  "function PublicDashboard",
  "export default function",
  "useState",
]);
printSnippets("app/api/dashboard/route.ts", [
  "export async function GET",
  "evaluations",
  "daily_evaluations",
  "institutions",
  "responsible",
  "attachments",
  "Response.json",
  "criteria",
]);
console.log("PATCH29SRC|DONE");
