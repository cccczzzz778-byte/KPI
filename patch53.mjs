import fs from 'node:fs';

function read(file){
  if(!fs.existsSync(file)) throw new Error('PATCH53 missing '+file);
  return fs.readFileSync(file,'utf8');
}
function write(file,text){
  fs.writeFileSync(file,text,'utf8');
  console.log('PATCH53: '+file);
}

// 2026-09-14 is the new recurrence baseline requested by the administrator.
// Older evidence remains visible in archive/history, but it no longer locks a criterion.
// The first institution upload on/after this date starts that criterion's normal cadence.
const baselineSql = " AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14'";

function addBaseline(file){
  let s=read(file);
  if(s.includes("DATE '2026-09-14'")) return write(file,s);
  const variants=[
    "source IN ('institution', 'institution_submission') ORDER BY created_at DESC LIMIT 1",
    "source IN ('institution','institution_submission') ORDER BY created_at DESC LIMIT 1",
  ];
  const hit=variants.find(v=>s.includes(v));
  if(!hit) throw new Error('PATCH53 recurrence query not found in '+file);
  s=s.replace(hit, hit.replace(' ORDER BY', baselineSql+' ORDER BY'));
  write(file,s);
}

addBaseline('app/api/uploads/prepare/route.ts');
addBaseline('app/api/uploads/complete/route.ts');

// Keep an auditable marker in the institution UI; historical files are intentionally preserved.
{
  const file='components/institution-portal.tsx';
  let s=read(file);
  const marker='PATCH53_RECURRENCE_RESET_NOTE';
  if(!s.includes(marker)){
    s='/* '+marker+': recurrence baseline 2026-09-14; older files remain archive-only. */\n'+s;
  }
  write(file,s);
}

console.log('PATCH53: files before 2026-09-14 are archive-only for recurrence.');
console.log('PATCH53: every criterion is open today unless it already received a new file on/after 2026-09-14.');
console.log('PATCH53: after today’s upload, each criterion follows its own 1/7/10/30/60/180-day rule again.');
console.log('PATCH53: 08:00-19:00 Asia/Tashkent upload window remains enforced.');
