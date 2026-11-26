"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Building2, ClipboardCheck, FileText, RefreshCw, TrendingUp } from "lucide-react";

type Key = "ijro" | "birlamchi" | "statsionar" | "raqam" | "moliya";
type ReportRow = { id:string; name:string; district:string; parts:Record<Key,number>; total:number; evaluated:boolean; fileCount:number; excludedDirections?:Key[] };
type Report = { selectedDate:string; totalInstitutions:number; evaluatedCount:number; averageScore:number; maxAverageScore:number; fileCount:number; rows:ReportRow[]; error?:string };
const names:Record<Key,string>={ijro:"Ijro intizomi",birlamchi:"Birlamchi yordam",statsionar:"Statsionar xizmat",raqam:"Raqamlashtirish",moliya:"Moliya va infratuzilma"};
const maximum:Record<Key,number>={ijro:10.6,birlamchi:27.3,statsionar:19.7,raqam:22.7,moliya:19.7};
const keys:Key[]=["ijro","birlamchi","statsionar","raqam","moliya"];

function tashkentDate(){return new Intl.DateTimeFormat("uz-UZ",{timeZone:"Asia/Tashkent",year:"numeric",month:"long",day:"2-digit",weekday:"long"}).format(new Date())}

export default function AdminDashboardOverview(){
  const [data,setData]=useState<Report|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{const r=await fetch("/api/reports/kpi-period?period=daily",{cache:"no-store"});const j=await r.json() as Report;if(!r.ok)throw new Error(j.error||"Admin tahlili yuklanmadi.");setData(j)}catch(e){setError(e instanceof Error?e.message:"Admin tahlili yuklanmadi.")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  const assessed=useMemo(()=>data?.rows.filter(row=>row.evaluated)??[],[data]);
  const direction=useMemo(()=>keys.map(key=>{const applicable=assessed.filter(row=>!row.excludedDirections?.includes(key));const avg=applicable.length?applicable.reduce((sum,row)=>sum+Number(row.parts[key]||0),0)/applicable.length:0;return{key,avg:+avg.toFixed(1),pct:Math.min(100,Math.round((avg/maximum[key])*100))}}),[assessed]);
  const top=useMemo(()=>[...(data?.rows??[])].filter(row=>row.evaluated).sort((a,b)=>b.total-a.total).slice(0,5),[data]);
  const cards=[
    {label:"Jami muassasalar",value:data?.totalInstitutions??"—",icon:Building2,tone:"blue"},
    {label:"Baholangan",value:data?.evaluatedCount??"—",icon:ClipboardCheck,tone:"green"},
    {label:"O‘rtacha KPI",value:data?data.averageScore+" / "+data.maxAverageScore:"—",icon:TrendingUp,tone:"amber"},
    {label:"Asoslovchi fayllar",value:data?.fileCount??"—",icon:FileText,tone:"violet"},
  ];
  return <section className="admin-v1">
    <div className="admin-v1-hero">
      <div><span className="admin-v1-kicker">BUXORO VILOYATI SOG‘LIQNI SAQLASH BOSHQARMASI</span><h2>Admin boshqaruv paneli</h2><p>KPI nazorati, muassasalar holati va tezkor tahlil bir joyda.</p></div>
      <div className="admin-v1-date"><Activity size={18}/><div><small>Bugungi sana</small><strong>{tashkentDate()}</strong></div><button type="button" onClick={()=>void load()} disabled={loading} title="Yangilash"><RefreshCw size={17}/></button></div>
    </div>
    {error&&<div className="admin-v1-error">{error}</div>}
    <div className="admin-v1-cards">{cards.map(card=>{const Icon=card.icon;return <article key={card.label} className={"admin-v1-card "+card.tone}><span className="admin-v1-icon"><Icon size={22}/></span><div><small>{card.label}</small><strong>{card.value}</strong></div></article>})}</div>
    <div className="admin-v1-grid">
      <article className="admin-v1-panel"><div className="admin-v1-panel-head"><div><strong>Yo‘nalishlar kesimida natija</strong><span>Baholangan muassasalar bo‘yicha o‘rtacha ball</span></div><span className="admin-v1-badge">Bugungi holat</span></div><div className="admin-v1-bars">{direction.map(item=><div className="admin-v1-bar" key={item.key}><div><span>{names[item.key]}</span><b>{item.avg} / {maximum[item.key]}</b></div><div className="admin-v1-track"><i style={{width:item.pct+"%"}}/></div></div>)}</div></article>
      <article className="admin-v1-panel"><div className="admin-v1-panel-head"><div><strong>Top 5 muassasa</strong><span>Joriy KPI bali bo‘yicha</span></div><span className="admin-v1-badge">Reyting</span></div><div className="admin-v1-top">{top.length?top.map((row,index)=><div key={row.id} className="admin-v1-rank"><span className="admin-v1-rank-n">{index+1}</span><div><strong>{row.name}</strong><small>{row.district||"Buxoro viloyati"}</small></div><b>{row.total.toFixed(1)}</b></div>):<div className="admin-v1-empty">Hozircha baholangan muassasa yo‘q.</div>}</div></article>
    </div>
    {loading&&<div className="admin-v1-loading">Ma’lumotlar yangilanmoqda...</div>}
  </section>;
}
