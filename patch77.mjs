import fs from "node:fs";

const file="components/admin-system-control.tsx";
if(!fs.existsSync(file)) throw new Error("PATCH77 missing "+file);
let s=fs.readFileSync(file,"utf8");

const from='function bytes(value:number|null){';
const to='function bytes(value:number|null|undefined){';
if(s.includes(from)) s=s.replace(from,to);
else if(!s.includes(to)) throw new Error("PATCH77 bytes signature anchor missing");

fs.writeFileSync(file,s,"utf8");
console.log("PATCH77: fixed System Control TypeScript nullable backup size.");
