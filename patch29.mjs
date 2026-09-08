import fs from "node:fs";

function dump(path, patterns = []) {
  if (!fs.existsSync(path)) {
    console.log(`PATCH29-DIAG: missing ${path}`);
    return;
  }
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  console.log(`PATCH29-DIAG-BEGIN ${path}`);
  if (lines.length <= 260) {
    lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));
  } else {
    const hits = new Set();
    for (let i = 0; i < lines.length; i++) {
      if (patterns.some((p) => lines[i].toLowerCase().includes(p.toLowerCase()))) {
        for (let j = Math.max(0, i - 8); j <= Math.min(lines.length - 1, i + 22); j++) hits.add(j);
      }
    }
    [...hits].sort((a,b)=>a-b).forEach((i) => console.log(`${i + 1}: ${lines[i]}`));
  }
  console.log(`PATCH29-DIAG-END ${path}`);
}

dump("app/api/dashboard/route.ts", ["evaluation", "score", "institution", "round", "daily", "month"]);
dump("components/kpi-app.tsx", ["dashboard", "/api/dashboard", "DashboardPanel", "totalScore", "jami kpi", "monitoring"]);
dump("app/page.tsx", ["dashboard", "KpiApp"]);
console.log("PATCH29-DIAG: dashboard daily/monthly investigation complete.");
