import fs from "node:fs";

for (const path of ["components/public-dashboard.tsx", "app/api/dashboard/route.ts"]) {
  if (!fs.existsSync(path)) { console.log(`PATCH29-DIAG: missing ${path}`); continue; }
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  console.log(`PATCH29-PUBLIC-BEGIN ${path}`);
  lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));
  console.log(`PATCH29-PUBLIC-END ${path}`);
}
console.log("PATCH29-PUBLIC-DIAG complete");
