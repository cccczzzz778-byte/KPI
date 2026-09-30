import fs from "node:fs";

const file="components/public-dashboard.tsx";
if(!fs.existsSync(file)) throw new Error("PATCH90 missing "+file);
let s=fs.readFileSync(file,"utf8");

const old='{commissions.map((commission) => <TableCell key={commission.id} className="score-col">{row.excludedDirections.includes(commission.id) ? <><strong>N/A</strong><span>tatbiq etilmaydi</span></> : <><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></>}</TableCell>)}';
const neu='{commissions.map((commission) => <TableCell key={commission.id} className="score-col">{row.excludedDirections.includes(commission.id) ? <strong>N/A</strong> : <><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></>}</TableCell>)}';

if(s.includes(old)) s=s.replace(old,neu);
else if(s.includes('<span>tatbiq etilmaydi</span>')) s=s.replaceAll('<span>tatbiq etilmaydi</span>','');
else if(!s.includes('row.excludedDirections.includes(commission.id) ? <strong>N/A</strong>')) throw new Error("PATCH90 N/A render anchor missing");

fs.writeFileSync(file,s,"utf8");
console.log("PATCH90: removed 'tatbiq etilmaydi' text; N/A now displays alone in score alignment.");