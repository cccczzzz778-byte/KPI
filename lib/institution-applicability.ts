import { getKpiDatabase } from "@/lib/netlify-db";
export async function ensureApplicabilityTable(){
 const db=getKpiDatabase();
 await db.pool.query("CREATE TABLE IF NOT EXISTS institution_commission_exclusions (institution_id TEXT NOT NULL, commission TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by TEXT NOT NULL DEFAULT '', PRIMARY KEY (institution_id,commission))");
 await db.pool.query("CREATE INDEX IF NOT EXISTS institution_commission_exclusions_commission_idx ON institution_commission_exclusions (commission)");
}
export async function isInstitutionCommissionExcluded(institutionId:string,commission:string){
 await ensureApplicabilityTable();
 const db=getKpiDatabase();
 const r=await db.pool.query("SELECT 1 FROM institution_commission_exclusions WHERE institution_id=$1 AND commission=$2 LIMIT 1",[institutionId,commission]);
 return Boolean(r.rowCount);
}
