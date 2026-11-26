import ExcelJS from "exceljs";
import { commissions, criteria, type CommissionKey } from "@/lib/kpi-data";
import { ensureApplicabilityTable } from "@/lib/institution-applicability";
import { getKpiDatabase } from "@/lib/netlify-db";
import { accessErrorResponse, AccessError, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = "daily" | "weekly" | "monthly";
const K: CommissionKey[] = ["ijro","birlamchi","statsionar","raqam","moliya"];
const M: Record<CommissionKey,number> = {ijro:10.6,birlamchi:27.3,statsionar:19.7,raqam:22.7,moliya:19.7};
const IDS = Object.fromEntries(K.map((k)=>[k,criteria.filter((c)=>c.commission===k).map((c)=>c.id)])) as Record<CommissionKey,string[]>;

function today(){
  const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tashkent",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const g=(t:string)=>p.find((q)=>q.type===t)?.value||"";
  return g("year")+"-"+g("month")+"-"+g("day");
}
function shift(d:string,n:number){
  const x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);
}
function kpiMonthStart(e:string){return e.slice(0,7)==="2026-10"&&e>="2026-10-05"?"2026-10-05":e.slice(0,7)+"-01"}
function range(p:P,e:string){return{start:p==="weekly"?shift(e,-6):p==="monthly"?kpiMonthStart(e):e,end:e}}
function score(raw:number,k:CommissionKey){
  const max=M[k],v=+((raw/(IDS[k].length*2))*max).toFixed(1);
  return Math.max(0,Math.min(max,v));
}

async function data(req:Request){
  const session=await requireAppUser(req);
  if(!["admin","evaluator","monitor"].includes(String(session.role)))throw new AccessError("Hisobotga ruxsat yo‘q.",403);
  await ensureApplicabilityTable();

  const u=new URL(req.url);
  const q=String(u.searchParams.get("period")||"daily");
  const p:P=q==="weekly"||q==="monthly"?q:"daily";
  const t=today();
  const z=String(u.searchParams.get("date")||"");
  const e=/^\d{4}-\d{2}-\d{2}$/.test(z)&&z<=t?z:t;
  const a=range(p,e);
  const own=session.role==="evaluator"&&K.includes(session.commission as CommissionKey)?session.commission as CommissionKey:null;
  const keys=own?[own]:K;
  const ids=keys.flatMap((k)=>IDS[k]);
  const db=getKpiDatabase();

  const evaluationQuery=p==="monthly"
    ?db.pool.query("SELECT institution_id AS \"institutionId\",criterion_id AS \"criterionId\",(ARRAY_AGG(LEAST(2,GREATEST(0,score)) ORDER BY evaluation_date DESC, updated_at DESC))[1]::float8 AS score,TRUE AS assessed FROM daily_evaluations WHERE evaluation_date BETWEEN $1::date AND $2::date AND criterion_id=ANY($3::text[]) GROUP BY institution_id,criterion_id",[a.start,a.end,ids])
    :db.pool.query("WITH ds AS (SELECT generate_series($1::date,$2::date,'1 day')::date d), base AS (SELECT i.id,c.cid,ds.d,(SELECT de.score FROM daily_evaluations de WHERE de.institution_id=i.id AND de.criterion_id=c.cid AND de.evaluation_date<=ds.d ORDER BY de.evaluation_date DESC,de.updated_at DESC LIMIT 1) score FROM institutions i CROSS JOIN unnest($3::text[]) c(cid) CROSS JOIN ds WHERE i.active=1) SELECT id AS \"institutionId\",cid AS \"criterionId\",AVG(COALESCE(score,0))::float8 AS score,BOOL_OR(score IS NOT NULL) AS assessed FROM base GROUP BY id,cid",[a.start,a.end,ids]);

  const [ir,er,fr,xr]=await Promise.all([
    db.pool.query("SELECT id,name,district,type FROM institutions WHERE active=1 ORDER BY LOWER(name)"),
    evaluationQuery,
    db.pool.query("SELECT institution_id AS \"institutionId\",COUNT(*)::int n FROM attachments WHERE source IN ('institution','institution_submission') AND criterion_id=ANY($1::text[]) AND submission_date BETWEEN $2::date AND $3::date GROUP BY institution_id",[ids,a.start,a.end]),
    db.pool.query("SELECT institution_id AS \"institutionId\",commission FROM institution_commission_exclusions"),
  ]);

  const ev=new Map(er.rows.map((v:any)=>[String(v.institutionId)+"::"+String(v.criterionId),v]));
  const fm=new Map(fr.rows.map((v:any)=>[String(v.institutionId),Number(v.n||0)]));
  const exclusions=new Map<string,Set<CommissionKey>>();
  for(const x of xr.rows){
    const id=String(x.institutionId);
    const commission=String(x.commission) as CommissionKey;
    if(!K.includes(commission))continue;
    if(!exclusions.has(id))exclusions.set(id,new Set<CommissionKey>());
    exclusions.get(id)!.add(commission);
  }

  const rows=ir.rows
    .filter((i:any)=>!own||!exclusions.get(String(i.id))?.has(own))
    .map((i:any)=>{
      const id=String(i.id);
      const excluded=exclusions.get(id)??new Set<CommissionKey>();
      const parts=Object.fromEntries(K.map((k)=>[k,0])) as Record<CommissionKey,number>;
      let n=0;
      for(const k of keys){
        if(excluded.has(k))continue;
        let raw=0;
        for(const criterionId of IDS[k]){
          const v:any=ev.get(id+"::"+criterionId);
          raw+=Number(v?.score||0);
          if(v?.assessed)n++;
        }
        parts[k]=score(raw,k);
      }
      const applicableKeys=keys.filter((k)=>!excluded.has(k));
      const rawTotal=applicableKeys.reduce((v,k)=>v+parts[k],0);
      const applicableWeight=applicableKeys.reduce((v,k)=>v+M[k],0);
      const total=own?+rawTotal.toFixed(1):(applicableWeight>0?+((rawTotal/applicableWeight)*100).toFixed(1):0);
      return{
        id,
        name:String(i.name),
        district:String(i.district||""),
        parts,
        total,
        maxTotal:own?+applicableWeight.toFixed(1):100,
        evaluated:n>0,
        fileCount:fm.get(id)||0,
        excludedDirections:Array.from(excluded),
      };
    })
    .sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"uz"));

  const ok=rows.filter((v)=>v.evaluated);
  return{
    role:session.role,
    commission:own,
    period:p,
    selectedDate:e,
    startDate:a.start,
    endDate:a.end,
    visibleKeys:keys,
    totalInstitutions:rows.length,
    evaluatedCount:ok.length,
    averageScore:ok.length?+(ok.reduce((v,q)=>v+q.total,0)/ok.length).toFixed(1):0,
    maxAverageScore:own?+keys.reduce((v,k)=>v+M[k],0).toFixed(1):100,
    fileCount:rows.reduce((v,q)=>v+q.fileCount,0),
    rows,
  };
}

async function book(d:Awaited<ReturnType<typeof data>>){
  const b=new ExcelJS.Workbook();
  const s=b.addWorksheet("KPI reytingi",{views:[{state:"frozen",xSplit:2,ySplit:7}]});
  const ks=d.visibleKeys as CommissionKey[];
  const hc=ks.length+3;
  s.mergeCells(1,1,1,hc);
  const t=s.getCell(1,1);
  t.value="Buxoro viloyati tibbiyot muassasalari KPI reytingi — "+(d.period==="daily"?"Kunlik":d.period==="weekly"?"Haftalik":"Oylik jami");
  t.font={bold:true,size:16,color:{argb:"FFFFFFFF"}};
  t.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF198178"}};
  t.alignment={horizontal:"center"};
  s.getRow(1).height=30;

  ["Muassasalar","Baholangan",d.period==="monthly"?"O‘rtacha jami ball":"O‘rtacha KPI","Asoslovchi fayllar"].forEach((v,j)=>{
    const c=s.getCell(3,j+1);c.value=v;c.font={bold:true,color:{argb:"FF14766F"}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE9F7F5"}};c.alignment={horizontal:"center"};
  });
  [d.totalInstitutions,d.evaluatedCount,d.averageScore,d.fileCount].forEach((v,j)=>{
    const c=s.getCell(4,j+1);c.value=v;c.font={bold:true,size:15};c.alignment={horizontal:"center"};if(j===2)c.numFmt="0.0";
  });

  const h=["N","Muassasa",...ks.map((k)=>commissions.find((c)=>c.id===k)?.short||k),"Jami"];
  const hr=s.getRow(7);hr.values=h;hr.height=44;
  for(let j=1;j<=h.length;j++){
    const c=hr.getCell(j);c.font={bold:true,color:{argb:"FFFFFFFF"}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF155C57"}};
    c.alignment={horizontal:"center",vertical:"middle",wrapText:true};
  }

  d.rows.forEach((v,i)=>{
    const q=s.getRow(i+8);
    q.values=[i+1,v.name,...ks.map((k)=>v.excludedDirections.includes(k)?"N/A":v.parts[k]),v.total];
    q.height=32;
    for(let j=1;j<=h.length;j++){
      const c=q.getCell(j);c.alignment={horizontal:"center",vertical:"middle",wrapText:true};
      c.border={bottom:{style:"thin",color:{argb:"FF36B9E8"}}};
      if(j>=3&&typeof c.value==="number")c.numFmt="0.0";
    }
    const c=q.getCell(h.length);c.font={bold:true,color:{argb:"FF087D76"}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF2F7CF"}};
  });
  s.getColumn(1).width=8;s.getColumn(2).width=58;
  for(let j=3;j<h.length;j++)s.getColumn(j).width=20;
  s.getColumn(h.length).width=14;
  s.autoFilter={from:{row:7,column:1},to:{row:7+d.rows.length,column:h.length}};
  return b;
}

export async function GET(req:Request){
  try{
    const d=await data(req),u=new URL(req.url);
    if(u.searchParams.get("format")==="xlsx"){
      const b=await book(d),buf=await b.xlsx.writeBuffer();
      const f="Buxoro_KPI_"+(d.period==="monthly"?"monthly_total":d.period)+(d.commission?"_"+d.commission:"")+"_"+d.selectedDate+".xlsx";
      return new Response(new Uint8Array(buf),{headers:{
        "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition":"attachment; filename=\""+f+"\"",
        "cache-control":"no-store"
      }});
    }
    return Response.json(d,{headers:{"cache-control":"no-store"}});
  }catch(e){return accessErrorResponse(e)}
}
