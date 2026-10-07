import fs from "node:fs";
const p=JSON.parse(fs.readFileSync("package.json","utf8"));
const s=String(p.scripts?.preinstall||"");
if(!s.includes("node patch99.mjs"))p.scripts.preinstall=s+" && node patch99.mjs && node patch99.test.mjs";
fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");
