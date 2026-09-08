import fs from "node:fs";

function dump(path, needles) {
  if (!fs.existsSync(path)) {
    console.log(`PATCH29-DIAG missing ${path}`);
    return;
  }
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  console.log(`PATCH29-DIAG-BEGIN ${path}`);
  const printed = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (needles.some((needle) => lines[i].includes(needle))) {
      const start = Math.max(0, i - 18);
      const end = Math.min(lines.length, i + 35);
      for (let j = start; j < end; j++) {
        if (!printed.has(j)) {
          console.log(`${j + 1}: ${lines[j]}`);
          printed.add(j);
        }
      }
    }
  }
  console.log(`PATCH29-DIAG-END ${path}`);
}

dump("components/public-dashboard.tsx", ["Muassasalar reytingi", "JAMI KPI", "YETAKCHI NATIJA", "O‘RTACHA KPI", "fileCount", "responsible"]);
dump("app/api/dashboard/route.ts", ["evaluations", "daily_evaluations", "institutions", "responsible", "attachments"]);
console.log("PATCH29-DIAG complete");
