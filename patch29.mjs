import fs from "node:fs";

for (const file of ["components/public-dashboard.tsx", "app/api/dashboard/route.ts"]) {
  if (!fs.existsSync(file)) {
    console.log(`PATCH29-FULL missing ${file}`);
    continue;
  }
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  console.log(`PATCH29-FULL-BEGIN ${file}`);
  lines.forEach((line, index) => console.log(`${index + 1}: ${line}`));
  console.log(`PATCH29-FULL-END ${file}`);
}
console.log("PATCH29-FULL complete");
