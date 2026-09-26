import fs from "node:fs";

function read(file){if(!fs.existsSync(file))throw new Error("PATCH70 missing "+file);return fs.readFileSync(file,"utf8")}
function write(file,source){fs.writeFileSync(file,source,"utf8");console.log("PATCH70: "+file)}

const file="app/api/reports/kpi-period/route.ts";
let s=read(file);

// Monthly Excel = real month-to-date accumulated score, not an average/carry-forward value.
// Daily and weekly reports keep their existing behavior.
const oldSc='function sc(raw:number,k:CommissionKey){const max=M[k],v=+((raw/(IDS[k].length*2))*max).toFixed(1);return Math.max(0,Math.min(max,v))}';
const newSc=oldSc+'function scMonthly(raw:number,k:CommissionKey){return +((raw/(IDS[k].length*2))*M[k]).toFixed(1)}';
if(!s.includes("function scMonthly(")){
  if(!s.includes(oldSc))throw new Error("PATCH70 score helper anchor missing");
  s=s.replace(oldSc,newSc);
}

const oldQuery='db.pool.query("WITH ds AS (SELECT generate_series($1::date,$2::date,\'1 day\')::date d), base AS (SELECT i.id,c.cid,ds.d,(SELECT de.score FROM daily_evaluations de WHERE de.institution_id=i.id AND de.criterion_id=c.cid AND de.evaluation_date<=ds.d ORDER BY de.evaluation_date DESC,de.updated_at DESC LIMIT 1) score FROM institutions i CROSS JOIN unnest($3::text[]) c(cid) CROSS JOIN ds WHERE i.active=1) SELECT id AS \\"institutionId\\",cid AS \\"criterionId\\",AVG(COALESCE(score,0))::float8 AS score,BOOL_OR(score IS NOT NULL) AS assessed FROM base GROUP BY id,cid",[a.start,a.end,ids])';
const newQuery='p==="monthly"?db.pool.query("SELECT institution_id AS \\"institutionId\\",criterion_id AS \\"criterionId\\",SUM(LEAST(2,GREATEST(0,score)))::float8 AS score,TRUE AS assessed FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date AND criterion_id=ANY($3::text[]) GROUP BY institution_id,criterion_id",[a.start,a.end,ids]):'+oldQuery;
if(!s.includes('SUM(LEAST(2,GREATEST(0,score)))')){
  if(!s.includes(oldQuery))throw new Error("PATCH70 monthly query anchor missing");
  s=s.replace(oldQuery,newQuery);
}

if(!s.includes('p==="monthly"?scMonthly(raw,k):sc(raw,k)')){
  if(!s.includes('parts[k]=sc(raw,k)'))throw new Error("PATCH70 parts score anchor missing");
  s=s.replace('parts[k]=sc(raw,k)','parts[k]=p==="monthly"?scMonthly(raw,k):sc(raw,k)');
}

// Make the Excel wording explicit so users know monthly is an accumulated total.
s=s.replace(
  'd.period==="daily"?"Kunlik":d.period==="weekly"?"Haftalik":"Oylik"',
  'd.period==="daily"?"Kunlik":d.period==="weekly"?"Haftalik":"Oylik jami"'
);
s=s.replace(
  '["Muassasalar","Baholangan","O‘rtacha KPI","Asoslovchi fayllar"].forEach',
  '["Muassasalar","Baholangan",d.period==="monthly"?"O‘rtacha jami ball":"O‘rtacha KPI","Asoslovchi fayllar"].forEach'
);
s=s.replace(
  'f="Buxoro_KPI_"+d.period+(d.commission?"_"+d.commission:"")+"_"+d.selectedDate+".xlsx"',
  'f="Buxoro_KPI_"+(d.period==="monthly"?"monthly_total":d.period)+(d.commission?"_"+d.commission:"")+"_"+d.selectedDate+".xlsx"'
);

write(file,s);
console.log("PATCH70: Admin Excel Oylik = selected month start through selected date SUM of actual saved daily_evaluations.");
console.log("PATCH70: monthly direction and Jami values are cumulative and are intentionally not capped at the daily direction maximum.");
console.log("PATCH70: daily and weekly Excel calculations are unchanged.");
