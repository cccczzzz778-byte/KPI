import fs from "node:fs";

function read(file) {
  if (!fs.existsSync(file)) throw new Error("PATCH76 missing " + file);
  return fs.readFileSync(file, "utf8");
}
function write(file, source) {
  const i = file.lastIndexOf("/");
  if (i >= 0) fs.mkdirSync(file.slice(0, i), { recursive: true });
  fs.writeFileSync(file, source, "utf8");
  console.log("PATCH76: " + file);
}

// 1) Align audit helper/API with the existing production audit_logs schema.
write("lib/audit-log.ts", [
  'import { getKpiDatabase } from "@/lib/netlify-db";',
  '',
  'export type AuditEntry = {',
  '  actorEmail?: string | null;',
  '  actorRole?: string | null;',
  '  action: string;',
  '  targetType?: string | null;',
  '  targetId?: string | null;',
  '  entityType?: string | null;',
  '  entityId?: string | null;',
  '  details?: string | null;',
  '  metadata?: Record<string, unknown>;',
  '};',
  '',
  'export async function ensureAuditTable() {',
  '  const db = getKpiDatabase();',
  '  await db.pool.query("CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, actor_email TEXT NOT NULL DEFAULT \'\', action TEXT NOT NULL, target_type TEXT NOT NULL DEFAULT \'\', target_id TEXT NOT NULL DEFAULT \'\', details TEXT NOT NULL DEFAULT \'\', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");',
  '  await db.pool.query("CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC)");',
  '  await db.pool.query("CREATE INDEX IF NOT EXISTS audit_logs_actor_email_idx ON audit_logs (actor_email)");',
  '}',
  '',
  'export async function writeAuditLog(entry: AuditEntry) {',
  '  await ensureAuditTable();',
  '  const db = getKpiDatabase();',
  '  const targetType = entry.targetType ?? entry.entityType ?? "";',
  '  const targetId = entry.targetId ?? entry.entityId ?? "";',
  '  const metadataText = entry.metadata ? " | " + JSON.stringify(entry.metadata) : "";',
  '  const roleText = entry.actorRole ? " [" + entry.actorRole + "]" : "";',
  '  const details = String(entry.details ?? "").trim() + roleText + metadataText;',
  '  await db.pool.query("INSERT INTO audit_logs (actor_email, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)", [entry.actorEmail ?? "", entry.action, targetType, targetId, details]);',
  '}',
  ''
].join("\n"));

write("app/api/admin/audit/route.ts", [
  'import { ensureAuditTable } from "@/lib/audit-log";',
  'import { getKpiDatabase } from "@/lib/netlify-db";',
  'import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";',
  '',
  'export const runtime = "nodejs";',
  'export const dynamic = "force-dynamic";',
  '',
  'export async function GET(request: Request) {',
  '  try {',
  '    const session = await requireAppUser(request);',
  '    if (session.role !== "admin") throw new AccessError("Audit jurnalini ko‘rish huquqi yo‘q.", 403);',
  '    await ensureAuditTable();',
  '    const url = new URL(request.url);',
  '    const requested = Number(url.searchParams.get("limit") || "200");',
  '    const limit = Math.max(1, Math.min(500, Number.isFinite(requested) ? requested : 200));',
  '    const db = getKpiDatabase();',
  '    const result = await db.pool.query("SELECT id, actor_email AS \\"actorEmail\\", action, target_type AS \\"targetType\\", target_id AS \\"targetId\\", details, created_at AS \\"createdAt\\" FROM audit_logs ORDER BY created_at DESC LIMIT $1", [limit]);',
  '    return Response.json({ items: result.rows }, { headers: { "cache-control": "no-store" } });',
  '  } catch (error) {',
  '    return accessErrorResponse(error);',
  '  }',
  '}',
  ''
].join("\n"));

// 2) Real system status for admin: DB, active sessions, S3 backup, counts and recent audit activity.
write("app/api/admin/system-status/route.ts", [
  'import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";',
  'import { getKpiDatabase } from "@/lib/netlify-db";',
  'import { isR2Configured } from "@/lib/r2";',
  'import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";',
  '',
  'export const runtime = "nodejs";',
  'export const dynamic = "force-dynamic";',
  '',
  'function storageConfig() {',
  '  const endpoint = process.env.S3_ENDPOINT || process.env.ENDPOINT || "";',
  '  const region = process.env.S3_REGION || process.env.REGION || "auto";',
  '  const bucket = process.env.S3_BUCKET || process.env.BUCKET || "";',
  '  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID || "";',
  '  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY || "";',
  '  return { endpoint, region, bucket, accessKeyId, secretAccessKey };',
  '}',
  '',
  'async function latestBackup() {',
  '  const cfg = storageConfig();',
  '  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) return { status: "not_configured", lastBackupAt: null, key: null, sizeBytes: null };',
  '  try {',
  '    const s3 = new S3Client({ endpoint: cfg.endpoint, region: cfg.region, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }, forcePathStyle: true });',
  '    let token: string | undefined;',
  '    let latest: { Key?: string; LastModified?: Date; Size?: number } | null = null;',
  '    let pages = 0;',
  '    do {',
  '      const result = await s3.send(new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: "db-backups/", ContinuationToken: token, MaxKeys: 1000 }));',
  '      for (const item of result.Contents || []) {',
  '        if (!item.LastModified) continue;',
  '        if (!latest?.LastModified || item.LastModified.getTime() > latest.LastModified.getTime()) latest = item;',
  '      }',
  '      token = result.IsTruncated ? result.NextContinuationToken : undefined;',
  '      pages += 1;',
  '    } while (token && pages < 5);',
  '    return { status: latest ? "ok" : "empty", lastBackupAt: latest?.LastModified?.toISOString() || null, key: latest?.Key || null, sizeBytes: latest?.Size ?? null };',
  '  } catch {',
  '    return { status: "error", lastBackupAt: null, key: null, sizeBytes: null };',
  '  }',
  '}',
  '',
  'export async function GET(request: Request) {',
  '  try {',
  '    const session = await requireAppUser(request);',
  '    if (session.role !== "admin") throw new AccessError("Tizim nazoratini ko‘rish huquqi yo‘q.", 403);',
  '    const started = Date.now();',
  '    const db = getKpiDatabase();',
  '    await db.pool.query("SELECT 1");',
  '    const databaseLatencyMs = Date.now() - started;',
  '    const [usersResult, institutionsResult, sessionsResult, auditResult, activeResult, backup] = await Promise.all([',
  '      db.pool.query("SELECT COUNT(*)::int AS count FROM users WHERE active=1"),',
  '      db.pool.query("SELECT COUNT(*)::int AS count FROM institutions WHERE active=1"),',
  '      db.pool.query("SELECT COUNT(DISTINCT user_email)::int AS count FROM sessions WHERE expires_at>NOW() AND last_seen_at>=NOW()-INTERVAL \'15 minutes\'"),',
  '      db.pool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE created_at>=NOW()-INTERVAL \'24 hours\'"),',
  '      db.pool.query("SELECT s.user_email AS email, COALESCE(u.name,\'\') AS name, COALESCE(u.role,\'\') AS role, MAX(s.last_seen_at) AS \\"lastSeenAt\\" FROM sessions s LEFT JOIN users u ON u.email=s.user_email WHERE s.expires_at>NOW() AND s.last_seen_at>=NOW()-INTERVAL \'15 minutes\' GROUP BY s.user_email,u.name,u.role ORDER BY MAX(s.last_seen_at) DESC LIMIT 50"),',
  '      latestBackup(),',
  '    ]);',
  '    return Response.json({',
  '      checks: { app: true, database: true, cacheConfigured: Boolean(process.env.REDIS_URL), storageConfigured: isR2Configured() },',
  '      databaseLatencyMs,',
  '      uptimeSeconds: Math.floor(process.uptime()),',
  '      build: process.env.APP_BUILD_REV || null,',
  '      checkedAt: new Date().toISOString(),',
  '      counts: { activeUsers: Number(usersResult.rows[0]?.count || 0), institutions: Number(institutionsResult.rows[0]?.count || 0), onlineNow: Number(sessionsResult.rows[0]?.count || 0), audit24h: Number(auditResult.rows[0]?.count || 0) },',
  '      activeSessions: activeResult.rows,',
  '      backup,',
  '    }, { headers: { "cache-control": "no-store" } });',
  '  } catch (error) {',
  '    return accessErrorResponse(error);',
  '  }',
  '}',
  ''
].join("\n"));

// 3) Admin System Control UI.
write("components/admin-system-control.tsx", String.raw`"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Database, FileClock, HardDrive, RefreshCw, Server, ShieldCheck, Users } from "lucide-react";

type Status = {
  checks: { app:boolean; database:boolean; cacheConfigured:boolean; storageConfigured:boolean };
  databaseLatencyMs:number;
  uptimeSeconds:number;
  build:string|null;
  checkedAt:string;
  counts:{ activeUsers:number; institutions:number; onlineNow:number; audit24h:number };
  activeSessions:Array<{email:string;name:string;role:string;lastSeenAt:string}>;
  backup:{status:string;lastBackupAt:string|null;key:string|null;sizeBytes:number|null};
  error?:string;
};
type Audit = { id:number; actorEmail:string; action:string; targetType:string; targetId:string; details:string; createdAt:string };
type AuditResponse = { items:Audit[]; error?:string };

function fmt(value:string|null|undefined){
  if(!value) return "—";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("uz-UZ",{timeZone:"Asia/Tashkent",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(date);
}
function duration(seconds:number){
  const d=Math.floor(seconds/86400), h=Math.floor((seconds%86400)/3600), m=Math.floor((seconds%3600)/60);
  return [d?d+" kun":"",h?h+" soat":"",m?m+" daq":""].filter(Boolean).join(" ")||"<1 daq";
}
function bytes(value:number|null){
  if(value===null||value===undefined) return "—";
  if(value<1024) return value+" B";
  if(value<1024*1024) return (value/1024).toFixed(1)+" KB";
  return (value/(1024*1024)).toFixed(1)+" MB";
}

export default function AdminSystemControl(){
  const [status,setStatus]=useState<Status|null>(null);
  const [audit,setAudit]=useState<Audit[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");

  async function load(){
    setLoading(true);setError("");
    try{
      const [sr,ar]=await Promise.all([
        fetch("/api/admin/system-status",{cache:"no-store"}),
        fetch("/api/admin/audit?limit=250",{cache:"no-store"}),
      ]);
      const sj=await sr.json() as Status;
      const aj=await ar.json() as AuditResponse;
      if(!sr.ok) throw new Error(sj.error||"Tizim holatini yuklab bo‘lmadi.");
      if(!ar.ok) throw new Error(aj.error||"Audit jurnalini yuklab bo‘lmadi.");
      setStatus(sj);setAudit(aj.items||[]);
    }catch(e){setError(e instanceof Error?e.message:"Tizim holatini yuklab bo‘lmadi.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load()},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("uz");
    if(!q) return audit;
    return audit.filter(item=>[item.actorEmail,item.action,item.targetType,item.targetId,item.details].some(v=>String(v||"").toLocaleLowerCase("uz").includes(q)));
  },[audit,query]);

  const cards=[
    {label:"Ilova",value:status?.checks.app?"ONLINE":"—",icon:Server,ok:Boolean(status?.checks.app)},
    {label:"PostgreSQL",value:status?.checks.database?"ONLINE":"—",icon:Database,ok:Boolean(status?.checks.database),sub:status?status.databaseLatencyMs+" ms":"—"},
    {label:"Cache",value:status?.checks.cacheConfigured?"ULANGAN":"YO‘Q",icon:HardDrive,ok:Boolean(status?.checks.cacheConfigured)},
    {label:"Storage",value:status?.checks.storageConfigured?"ULANGAN":"YO‘Q",icon:ShieldCheck,ok:Boolean(status?.checks.storageConfigured)},
    {label:"Hozir faol",value:String(status?.counts.onlineNow??"—"),icon:Users,ok:true,sub:"15 daqiqa"},
    {label:"24 soat audit",value:String(status?.counts.audit24h??"—"),icon:Activity,ok:true},
  ];

  return <section className="sysctl">
    <div className="sysctl-head">
      <div><span>TIZIM BOSHQARUVI</span><h3>System Control</h3><p>Production holati, faol sessiyalar, backup va audit jurnali.</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{loading?"Yangilanmoqda":"Yangilash"}</button>
    </div>
    {error&&<div className="sysctl-error">{error}</div>}
    <div className="sysctl-cards">{cards.map(card=>{const Icon=card.icon;return <article key={card.label} className={"sysctl-card "+(card.ok?"ok":"warn")}><Icon size={20}/><div><small>{card.label}</small><strong>{card.value}</strong>{card.sub&&<span>{card.sub}</span>}</div></article>})}</div>

    <div className="sysctl-grid">
      <article className="sysctl-panel">
        <div className="sysctl-panel-title"><FileClock size={18}/><div><strong>Oxirgi database backup</strong><span>Railway S3 · db-backups/</span></div></div>
        <div className="sysctl-backup">
          <b>{status?.backup.status==="ok"?"MUVAFFAQIYATLI":status?.backup.status==="empty"?"HALI YO‘Q":status?.backup.status==="error"?"TEKSHIRUV XATOSI":"SOZLANMAGAN"}</b>
          <strong>{fmt(status?.backup.lastBackupAt)}</strong>
          <small>{status?.backup.key||"Backup fayli aniqlanmadi"}</small>
          <span>{bytes(status?.backup.sizeBytes)}</span>
        </div>
        <div className="sysctl-meta"><span>Uptime: <b>{status?duration(status.uptimeSeconds):"—"}</b></span><span>Tekshirildi: <b>{fmt(status?.checkedAt)}</b></span><span>Faol foydalanuvchilar: <b>{status?.counts.activeUsers??"—"}</b></span><span>Muassasalar: <b>{status?.counts.institutions??"—"}</b></span></div>
      </article>

      <article className="sysctl-panel">
        <div className="sysctl-panel-title"><Users size={18}/><div><strong>Faol sessiyalar</strong><span>Oxirgi 15 daqiqada faol bo‘lganlar</span></div></div>
        <div className="sysctl-sessions">{status?.activeSessions?.length?status.activeSessions.map(item=><div key={item.email}><span className="sysctl-dot"/><div><strong>{item.name||item.email}</strong><small>{item.email} · {item.role||"—"}</small></div><time>{fmt(item.lastSeenAt)}</time></div>):<p>Hozir faol sessiya aniqlanmadi.</p>}</div>
      </article>
    </div>

    <article className="sysctl-panel sysctl-audit">
      <div className="sysctl-audit-head"><div className="sysctl-panel-title"><Activity size={18}/><div><strong>Audit Log</strong><span>Oxirgi {audit.length} ta tizim amali</span></div></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Login, foydalanuvchi yoki amal bo‘yicha qidirish..."/></div>
      <div className="sysctl-table-wrap"><table><thead><tr><th>Vaqt</th><th>Foydalanuvchi</th><th>Amal</th><th>Obyekt</th><th>Tafsilot</th></tr></thead><tbody>{filtered.slice(0,250).map(item=><tr key={item.id}><td>{fmt(item.createdAt)}</td><td>{item.actorEmail||"—"}</td><td><b>{item.action}</b></td><td>{[item.targetType,item.targetId].filter(Boolean).join(" · ")||"—"}</td><td>{item.details||"—"}</td></tr>)}{!filtered.length&&<tr><td colSpan={5} className="sysctl-empty">Mos yozuv topilmadi.</td></tr>}</tbody></table></div>
    </article>
  </section>;
}
`);

// 4) Add System Control as a dedicated admin tab.
{
  const file = "components/kpi-app.tsx";
  let s = read(file);
  if (!s.includes('AdminSystemControl')) {
    const anchor = 'import AdminDashboardOverview from "@/components/admin-dashboard-overview";';
    if (!s.includes(anchor)) throw new Error("PATCH76 admin overview import anchor missing");
    s = s.replace(anchor, anchor + '\nimport AdminSystemControl from "@/components/admin-system-control";');
  }

  const triggerAnchor = '<TabsTrigger value="logs"><Activity /> Faoliyat jurnali</TabsTrigger>';
  if (!s.includes('<TabsTrigger value="system">')) {
    if (!s.includes(triggerAnchor)) throw new Error("PATCH76 admin logs trigger anchor missing");
    s = s.replace(triggerAnchor, '<TabsTrigger value="system">🛠 Tizim nazorati</TabsTrigger>' + triggerAnchor);
  }

  const contentAnchor = '<TabsContent value="logs" className="panel-content">';
  if (!s.includes('<TabsContent value="system" className="panel-content">')) {
    if (!s.includes(contentAnchor)) throw new Error("PATCH76 admin logs content anchor missing");
    s = s.replace(contentAnchor, '<TabsContent value="system" className="panel-content"><AdminSystemControl /></TabsContent>' + contentAnchor);
  }
  write(file, s);
}

// 5) Styling.
{
  const file = "app/globals.css";
  let s = read(file);
  if (!s.includes("PATCH76_SYSTEM_CONTROL")) {
    s += String.raw`
/* PATCH76_SYSTEM_CONTROL */
.sysctl{display:grid;gap:14px;margin:14px 0 22px}.sysctl-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px;border:1px solid #d9e7eb;background:linear-gradient(135deg,#f8fcff,#f8fffc);border-radius:18px}.sysctl-head>div{display:grid;gap:4px}.sysctl-head>div>span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#0f766e}.sysctl-head h3{margin:0;font-size:23px;color:#17324d}.sysctl-head p{margin:0;color:#6b7f91;font-size:12px}.sysctl-head button{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:10px;background:#0f766e;color:#fff;padding:10px 13px;font-weight:800;cursor:pointer}.sysctl-head button:disabled{opacity:.6}.sysctl-error{padding:10px 12px;border-radius:10px;background:#fff0f0;border:1px solid #ffd1d1;color:#a33434;font-size:12px;font-weight:700}.sysctl-cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.sysctl-card{display:flex;gap:10px;align-items:center;min-height:86px;padding:13px;border:1px solid #dce7ed;border-radius:14px;background:#fff}.sysctl-card.ok>svg{color:#11856d}.sysctl-card.warn>svg{color:#c77a13}.sysctl-card div{display:grid;gap:2px;min-width:0}.sysctl-card small,.sysctl-card span{font-size:9px;color:#78899a}.sysctl-card strong{font-size:15px;color:#17324d}.sysctl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.sysctl-panel{border:1px solid #dce7ed;border-radius:15px;background:#fff;padding:15px;min-width:0}.sysctl-panel-title{display:flex;align-items:center;gap:9px;margin-bottom:12px;color:#0f766e}.sysctl-panel-title>div{display:grid;gap:2px}.sysctl-panel-title strong{font-size:13px;color:#17324d}.sysctl-panel-title span{font-size:10px;color:#7c8d9e}.sysctl-backup{display:grid;grid-template-columns:auto 1fr auto;gap:7px 12px;align-items:center;padding:12px;border-radius:12px;background:#f5fbfa}.sysctl-backup>b{font-size:10px;color:#0f766e;background:#e4f6f1;border-radius:999px;padding:5px 8px;width:max-content}.sysctl-backup>strong{font-size:13px;color:#17324d}.sysctl-backup>small{grid-column:1/3;font-size:10px;color:#6f8192;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sysctl-backup>span{grid-row:1/3;grid-column:3;font-size:11px;font-weight:800;color:#4a5e72}.sysctl-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.sysctl-meta span{font-size:10px;color:#758697;background:#f8fafb;padding:8px;border-radius:9px}.sysctl-meta b{color:#21394f}.sysctl-sessions{display:grid;gap:6px;max-height:260px;overflow:auto}.sysctl-sessions>div{display:grid;grid-template-columns:9px 1fr auto;align-items:center;gap:8px;padding:8px;border-radius:10px;background:#f8fbfc}.sysctl-dot{width:8px;height:8px;border-radius:50%;background:#19a974;box-shadow:0 0 0 3px #ddf7ed}.sysctl-sessions strong{font-size:11px;color:#203950}.sysctl-sessions small{display:block;font-size:9px;color:#8191a0}.sysctl-sessions time{font-size:9px;color:#748595}.sysctl-sessions p{font-size:11px;color:#7a8b9b}.sysctl-audit{padding:0;overflow:hidden}.sysctl-audit-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 15px;border-bottom:1px solid #e4ecef}.sysctl-audit-head .sysctl-panel-title{margin:0}.sysctl-audit-head input{width:min(410px,45%);border:1px solid #d7e3e8;border-radius:10px;padding:9px 11px;font-size:11px;outline:none}.sysctl-table-wrap{overflow:auto;max-height:520px}.sysctl-table-wrap table{width:100%;border-collapse:collapse;font-size:10px}.sysctl-table-wrap th{position:sticky;top:0;background:#f7fafb;text-align:left;padding:9px 10px;color:#65788a;border-bottom:1px solid #dfe8eb;z-index:1}.sysctl-table-wrap td{padding:9px 10px;border-bottom:1px solid #edf2f4;color:#41566a;vertical-align:top}.sysctl-table-wrap td b{color:#17324d}.sysctl-empty{text-align:center!important;padding:20px!important;color:#8293a2!important}@media(max-width:1150px){.sysctl-cards{grid-template-columns:repeat(3,1fr)}}@media(max-width:800px){.sysctl-head{align-items:flex-start;flex-direction:column}.sysctl-cards{grid-template-columns:repeat(2,1fr)}.sysctl-grid{grid-template-columns:1fr}.sysctl-audit-head{align-items:stretch;flex-direction:column}.sysctl-audit-head input{width:100%}}@media(max-width:520px){.sysctl-cards{grid-template-columns:1fr}.sysctl-meta{grid-template-columns:1fr}}
`;
  }
  write(file, s);
}

console.log("PATCH76: System Control tab + active sessions + real S3 backup status + audit compatibility added.");
