"use client";

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
function bytes(value:number|null|undefined){
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
