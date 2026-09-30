import fs from "node:fs";
function write(file,source){const i=file.lastIndexOf("/");if(i>=0)fs.mkdirSync(file.slice(0,i),{recursive:true});fs.writeFileSync(file,source,"utf8");console.log("PATCH80A: "+file)}
write("lib/institution-applicability.ts",[
  'import { getKpiDatabase } from "@/lib/netlify-db";',
  'export async function ensureApplicabilityTable(){',
  ' const db=getKpiDatabase();',
  ' await db.pool.query("CREATE TABLE IF NOT EXISTS institution_commission_exclusions (institution_id TEXT NOT NULL, commission TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by TEXT NOT NULL DEFAULT \'\', PRIMARY KEY (institution_id,commission))");',
  ' await db.pool.query("CREATE INDEX IF NOT EXISTS institution_commission_exclusions_commission_idx ON institution_commission_exclusions (commission)");',
  '}',
  'export async function isInstitutionCommissionExcluded(institutionId:string,commission:string){',
  ' await ensureApplicabilityTable();',
  ' const db=getKpiDatabase();',
  ' const r=await db.pool.query("SELECT 1 FROM institution_commission_exclusions WHERE institution_id=$1 AND commission=$2 LIMIT 1",[institutionId,commission]);',
  ' return Boolean(r.rowCount);',
  '}',
  ''
].join("\n"));
write("app/api/applicability/route.ts",[
  'import { commissions } from "@/lib/kpi-data";',
  'import { ensureApplicabilityTable } from "@/lib/institution-applicability";',
  'import { getKpiDatabase } from "@/lib/netlify-db";',
  'import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";',
  'export const runtime="nodejs"; export const dynamic="force-dynamic";',
  'const valid=new Set(commissions.map(x=>x.id));',
  'export async function GET(request:Request){try{',
  ' const session=await requireAppUser(request); await ensureApplicabilityTable(); const db=getKpiDatabase(); let result;',
  ' if(session.role==="evaluator") result=await db.pool.query("SELECT institution_id AS \\"institutionId\\",commission FROM institution_commission_exclusions WHERE commission=$1 ORDER BY institution_id",[session.commission]);',
  ' else if(session.role==="institution") result=await db.pool.query("SELECT institution_id AS \\"institutionId\\",commission FROM institution_commission_exclusions WHERE institution_id=$1 ORDER BY commission",[session.institutionId]);',
  ' else if(session.role==="admin"||session.role==="monitor") result=await db.pool.query("SELECT institution_id AS \\"institutionId\\",commission FROM institution_commission_exclusions ORDER BY institution_id,commission");',
  ' else throw new AccessError("Ruxsat yo‘q.",403);',
  ' const exclusions=result.rows.map((x:any)=>({institutionId:String(x.institutionId),commission:String(x.commission)}));',
  ' return Response.json({exclusions,excludedInstitutionIds:session.role==="evaluator"?exclusions.map(x=>x.institutionId):[],excludedCommissions:session.role==="institution"?exclusions.map(x=>x.commission):[]},{headers:{"cache-control":"no-store"}});',
  '}catch(error){return accessErrorResponse(error)}}',
  'export async function POST(request:Request){try{',
  ' const session=await requireAppUser(request); if(session.role!=="admin") throw new AccessError("Faqat admin o‘zgartira oladi.",403);',
  ' await ensureApplicabilityTable(); const body=await request.json() as {institutionId?:string;commission?:string;applicable?:boolean};',
  ' const institutionId=String(body.institutionId||"").trim(), commission=String(body.commission||"").trim();',
  ' if(!institutionId||!valid.has(commission as any)) return Response.json({error:"Muassasa yoki bo‘lim noto‘g‘ri."},{status:400});',
  ' const db=getKpiDatabase(); const exists=await db.pool.query("SELECT 1 FROM institutions WHERE id=$1 LIMIT 1",[institutionId]);',
  ' if(!exists.rowCount) return Response.json({error:"Muassasa topilmadi."},{status:404});',
  ' const applicable=body.applicable!==false;',
  ' if(applicable) await db.pool.query("DELETE FROM institution_commission_exclusions WHERE institution_id=$1 AND commission=$2",[institutionId,commission]);',
  ' else await db.pool.query("INSERT INTO institution_commission_exclusions (institution_id,commission,updated_at,updated_by) VALUES ($1,$2,NOW(),$3) ON CONFLICT (institution_id,commission) DO UPDATE SET updated_at=NOW(),updated_by=EXCLUDED.updated_by",[institutionId,commission,session.email]);',
  ' await db.pool.query("INSERT INTO audit_logs (actor_email,action,target_type,target_id,details) VALUES ($1,\'institution_direction_applicability\',\'institution\',$2,$3)",[session.email,institutionId,commission+": "+(applicable?"tatbiq etiladi":"tatbiq etilmaydi")]);',
  ' return Response.json({saved:true,institutionId,commission,applicable},{headers:{"cache-control":"no-store"}});',
  '}catch(error){return accessErrorResponse(error)}}',
  ''
].join("\n"));
console.log("PATCH80A: applicability API ready");