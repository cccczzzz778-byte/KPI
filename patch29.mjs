import fs from "node:fs";
import path from "node:path";

function copyTemplate(templateName, targetName) {
  const template = path.join(process.cwd(), templateName);
  const target = path.join(process.cwd(), targetName);
  if (!fs.existsSync(template)) throw new Error(`PATCH29: template missing ${templateName}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fs.readFileSync(template, "utf8"), "utf8");
  console.log(`PATCH29: wrote ${targetName}`);
}

copyTemplate("patch29.public-dashboard.tsx.txt", "components/public-dashboard.tsx");
copyTemplate("patch29.dashboard-route.ts.txt", "app/api/dashboard/route.ts");

const cssTemplate = fs.readFileSync(path.join(process.cwd(), "patch29.dashboard.css.txt"), "utf8");
const cssPath = path.join(process.cwd(), "app/globals.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PATCH29_DAILY_MONTHLY_PUBLIC_DASHBOARD */";
if (!css.includes(marker)) {
  css += `\n\n${cssTemplate}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
  console.log("PATCH29: daily/monthly dashboard CSS added.");
}

console.log("PATCH29: public dashboard now shows real daily, monthly, 60-day cumulative and direction-based scores from daily_evaluations; auto-refresh enabled.");
