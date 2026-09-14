import fs from 'node:fs';

function read(file){if(!fs.existsSync(file))throw new Error('PATCH51 missing '+file);return fs.readFileSync(file,'utf8')}
function write(file,text){fs.mkdirSync(file.slice(0,file.lastIndexOf('/')),{recursive:true});fs.writeFileSync(file,text,'utf8');console.log('PATCH51: '+file)}

const component = String.raw`"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Building2, ClipboardCheck, FileText, RefreshCw, TrendingUp } from "lucide-react";

type Key = "ijro" | "birlamchi" | "statsionar" | "raqam" | "moliya";
type ReportRow = { id:string; name:string; district:string; parts:Record<Key,number>; total:number; evaluated:boolean; fileCount:number };
type Report = { selectedDate:string; totalInstitutions:number; evaluatedCount:number; averageScore:number; maxAverageScore:number; fileCount:number; rows:ReportRow[]; error?:string };
const names:Record<Key,string>={ijro:"Ijro intizomi",birlamchi:"Birlamchi yordam",statsionar:"Statsionar xizmat",raqam:"Raqamlashtirish",moliya:"Moliya va infratuzilma"};
const maximum:Record<Key,number>={ijro:10.3,birlamchi:29.4,statsionar:23.5,raqam:13.3,moliya:23.5};
const keys:Key[]=["ijro","birlamchi","statsionar","raqam","moliya"];

function tashkentDate(){return new Intl.DateTimeFormat("uz-UZ",{timeZone:"Asia/Tashkent",year:"numeric",month:"long",day:"2-digit",weekday:"long"}).format(new Date())}

export default function AdminDashboardOverview(){
  const [data,setData]=useState<Report|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{const r=await fetch("/api/reports/kpi-period?period=daily",{cache:"no-store"});const j=await r.json() as Report;if(!r.ok)throw new Error(j.error||"Admin tahlili yuklanmadi.");setData(j)}catch(e){setError(e instanceof Error?e.message:"Admin tahlili yuklanmadi.")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  const assessed=useMemo(()=>data?.rows.filter(row=>row.evaluated)??[],[data]);
  const direction=useMemo(()=>keys.map(key=>{const avg=assessed.length?assessed.reduce((sum,row)=>sum+Number(row.parts[key]||0),0)/assessed.length:0;return{key,avg:+avg.toFixed(1),pct:Math.min(100,Math.round((avg/maximum[key])*100))}}),[assessed]);
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
`;
write('components/admin-dashboard-overview.tsx',component);

{
  const file='components/kpi-app.tsx';
  let s=read(file);
  if(!s.includes('AdminDashboardOverview')){
    const anchor='"use client";';
    if(!s.includes(anchor))throw new Error('PATCH51 use client anchor');
    s=s.replace(anchor,anchor+'\nimport AdminDashboardOverview from "@/components/admin-dashboard-overview";');
  }
  const tab='<TabsContent value="institutions" className="panel-content">';
  if(!s.includes(tab))throw new Error('PATCH51 institutions tab anchor');
  if(!s.includes('<AdminDashboardOverview />'))s=s.replace(tab,tab+'<AdminDashboardOverview />');
  write(file,s);
}

{
  const file='components/admin-institution-manager.tsx';
  let s=read(file);
  if(!s.includes('className="admin-institution-manager"')){
    const anchor='return <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>';
    if(!s.includes(anchor))throw new Error('PATCH51 admin manager root anchor');
    s=s.replace(anchor,'return <div className="admin-institution-manager" style={{ display: "grid", gap: 14, marginBottom: 20 }}>');
  }
  write(file,s);
}

{
  const file='app/globals.css';
  let s=read(file);
  const marker='/* PATCH51_ADMIN_V1 */';
  if(!s.includes(marker))s+=String.raw`

/* PATCH51_ADMIN_V1 */
.admin-v1{margin:0 0 18px;padding:20px;border:1px solid #d9ebe9;border-radius:20px;background:linear-gradient(135deg,#f8fcfc 0%,#fff 60%,#f6fbff 100%);box-shadow:0 12px 34px rgba(15,82,79,.07);color:#102a43}.admin-v1-hero{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:17px}.admin-v1-kicker{display:block;font-size:10px;font-weight:900;letter-spacing:.14em;color:#16827a;margin-bottom:7px}.admin-v1 h2{margin:0;font-size:25px;letter-spacing:-.03em;color:#102a43}.admin-v1-hero p{margin:5px 0 0;color:#62758a;font-size:13px}.admin-v1-date{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #d7e9e7;border-radius:13px;background:#fff;min-width:255px;color:#167a73}.admin-v1-date div{display:grid;flex:1}.admin-v1-date small{font-size:10px;color:#7b8fa2}.admin-v1-date strong{font-size:12px;color:#253b53}.admin-v1-date button{width:34px;height:34px;border:0;border-radius:9px;background:#edf8f7;color:#13776f;display:grid;place-items:center;cursor:pointer}.admin-v1-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.admin-v1-card{min-height:92px;padding:15px;border:1px solid #dce7ef;border-radius:15px;background:#fff;display:flex;align-items:center;gap:12px;box-shadow:0 5px 16px rgba(15,35,55,.04)}.admin-v1-icon{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;flex:0 0 auto}.admin-v1-card div{display:grid;gap:4px}.admin-v1-card small{font-size:11px;font-weight:700;color:#65798c}.admin-v1-card strong{font-size:22px;line-height:1;color:#102a43}.admin-v1-card.blue .admin-v1-icon{background:#eaf4ff;color:#2778d4}.admin-v1-card.green .admin-v1-icon{background:#e7f9f1;color:#159668}.admin-v1-card.amber .admin-v1-icon{background:#fff4df;color:#dc8314}.admin-v1-card.violet .admin-v1-icon{background:#f1edff;color:#7557d8}.admin-v1-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(330px,.85fr);gap:12px}.admin-v1-panel{border:1px solid #dce8ef;border-radius:15px;background:#fff;padding:16px;min-width:0}.admin-v1-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:15px}.admin-v1-panel-head>div{display:grid;gap:3px}.admin-v1-panel-head strong{font-size:14px;color:#17324d}.admin-v1-panel-head span{font-size:10px;color:#789}.admin-v1-badge{padding:5px 8px!important;border-radius:999px;background:#edf8f7;color:#167a73!important;font-weight:800}.admin-v1-bars{display:grid;gap:12px}.admin-v1-bar>div:first-child{display:flex;justify-content:space-between;gap:10px;margin-bottom:5px;font-size:11px}.admin-v1-bar span{font-weight:700;color:#41566b}.admin-v1-bar b{color:#17324d}.admin-v1-track{height:8px;background:#edf3f5;border-radius:999px;overflow:hidden}.admin-v1-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#22a69a,#3b82f6)}.admin-v1-top{display:grid;gap:7px}.admin-v1-rank{display:grid;grid-template-columns:30px 1fr auto;gap:9px;align-items:center;padding:8px;border-radius:11px;background:#f8fbfc}.admin-v1-rank-n{width:27px;height:27px;border-radius:8px;background:#e4f6f3;color:#137a72;display:grid;place-items:center;font-size:11px;font-weight:900}.admin-v1-rank div{display:grid;gap:2px;min-width:0}.admin-v1-rank strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#213b53}.admin-v1-rank small{font-size:9px;color:#8191a1}.admin-v1-rank>b{font-size:14px;color:#128078}.admin-v1-empty,.admin-v1-loading{padding:12px;color:#718396;font-size:12px}.admin-v1-error{padding:10px 12px;margin-bottom:12px;border-radius:10px;background:#fff0f0;color:#a63b3b;font-size:12px;font-weight:700}.admin-institution-manager>div{box-shadow:0 6px 20px rgba(15,35,55,.045)}@media(max-width:1050px){.admin-v1-cards{grid-template-columns:repeat(2,1fr)}.admin-v1-grid{grid-template-columns:1fr}}@media(max-width:650px){.admin-v1{padding:14px;border-radius:15px}.admin-v1-hero{align-items:flex-start;flex-direction:column}.admin-v1-date{width:100%;min-width:0}.admin-v1-cards{grid-template-columns:1fr 1fr}.admin-v1-card{min-height:82px;padding:11px}.admin-v1-card strong{font-size:18px}.admin-v1 h2{font-size:21px}}`;
  write(file,s);
}
console.log('PATCH51: variant 1 admin overview active; existing admin functions preserved.');
