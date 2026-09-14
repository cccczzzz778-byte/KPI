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
// Evidence uploaded before this date remains in the archive but MUST NOT lock
// any criterion today. The first file uploaded on/after this date starts that
// criterion's normal 1/7/10/30/60/180-day recurrence again.
const baselineSql = " AND (created_at AT TIME ZONE 'Asia/Tashkent')::date >= DATE '2026-09-14'";

{
  const file='app/api/uploads/prepare/route.ts';
  let s=read(file);
  const oldQuery = "SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN ('institution', 'institution_submission') ORDER BY created_at DESC LIMIT 1";
  const oldQuery2 = "SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN ('institution','institution_submission') ORDER BY created_at DESC LIMIT 1";
  if(s.includes(oldQuery)) s=s.replace(oldQuery, oldQuery.replace(' ORDER BY', baselineSql+' ORDER BY'));
  else if(s.includes(oldQuery2)) s=s.replace(oldQuery2, oldQuery2.replace(' ORDER BY', baselineSql+' ORDER BY'));
  else throw new Error('PATCH53 prepare recurrence query not found');
  write(file,s);
}

{
  const file='app/api/uploads/complete/route.ts';
  let s=read(file);
  const oldQuery = "SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id=$1 AND criterion_id=$2 AND source IN ('institution','institution_submission') ORDER BY created_at DESC LIMIT 1";
  const oldQuery2 = "SELECT created_at AS \\\"createdAt\\\" FROM attachments WHERE institution_id = $1 AND criterion_id = $2 AND source IN ('institution', 'institution_submission') ORDER BY created_at DESC LIMIT 1";
  if(s.includes(oldQuery)) s=s.replace(oldQuery, oldQuery.replace(' ORDER BY', baselineSql+' ORDER BY'));
  else if(s.includes(oldQuery2)) s=s.replace(oldQuery2, oldQuery2.replace(' ORDER BY', baselineSql+' ORDER BY'));
  else throw new Error('PATCH53 complete recurrence query not found');
  write(file,s);
}

// Add a clear institution-facing note without removing the historical archive.
{
  const file='components/institution-portal.tsx';
  let s=read(file);
  const marker='PATCH53_RECURRENCE_RESET_NOTE';
  if(!s.includes(marker)){
    const cssAnchor='className="institution-portal"';
    // No structural UI rewrite: server behavior is authoritative. Keep marker in source for auditability.
    s=s.replace(cssAnchor, cssAnchor+' data-recurrence-baseline="2026-09-14"');
    s='/* '+marker+' */\n'+s;
  }
  write(file,s);
}

console.log('PATCH53: pre-2026-09-14 institution criterion files remain archived but do not count toward recurrence.');
console.log('PATCH53: first upload on/after 2026-09-14 becomes the new recurrence anchor per institution + criterion.');
console.log('PATCH53: 08:00-19:00 Asia/Tashkent upload window remains enforced.');
