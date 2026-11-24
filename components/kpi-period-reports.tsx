"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { CalendarDays,Download,RefreshCw } from "lucide-react";
import { commissions,type CommissionKey } from "@/lib/kpi-data";

type P="daily"|"weekly"|"monthly";
type Row={id:string;name:string;parts:Record<CommissionKey,number>;total:number;excludedDirections?:CommissionKey[]};
type D={period:P;selectedDate:string;startDate:string;endDate:string;visibleKeys:CommissionKey[];totalInstitutions:number;evaluatedCount:number;averageScore:number;maxAverageScore:number;fileCount:number;rows:Row[];error?:string};
const E:D={period:"daily",selectedDate:"",startDate:"",endDate:"",visibleKeys:[],totalInstitutions:0,evaluatedCount:0,averageScore:0,maxAverageScore:100,fileCount:0,rows:[]};

export default function KpiPeriodReports(){
  const[p,setP]=useState<P>("daily"),[dt,setDt]=useState(""),[d,setD]=useState<D>(E),[load,setLoad]=useState(true),[err,setErr]=useState("");
  const go=useCallback(async()=>{
    setLoad(true);
    try{
      const q=new URLSearchParams({period:p});if(dt)q.set("date",dt);
      const r=await fetch("/api/reports/kpi-period?"+q,{cache:"no-store"}),j=await r.json();
      if(!r.ok)throw Error(j.error||"Hisobot yuklanmadi");
      setD(j);if(!dt)setDt(j.selectedDate);setErr("");
    }catch(e){setErr(e instanceof Error?e.message:"Xatolik")}finally{setLoad(false)}
  },[p,dt]);
  useEffect(()=>{void go()},[go]);
  const cs=useMemo(()=>d.visibleKeys.map((k)=>({k,n:commissions.find((c)=>c.id===k)?.short||k})),[d.visibleKeys]);
  const dl="/api/reports/kpi-period?"+new URLSearchParams({period:p,date:dt,format:"xlsx"});
  return <section className="kpi-pr">
    <div className="kpi-pr-h"><div><strong>Baholar hisoboti</strong><span>Kunlik · haftalik · oylik</span></div><div className="kpi-pr-c">
      <div className="kpi-pr-tabs">{(["daily","weekly","monthly"]as P[]).map((v)=><button key={v} className={p===v?"active":""} onClick={()=>setP(v)}>{v==="daily"?"Kunlik":v==="weekly"?"Haftalik":"Oylik"}</button>)}</div>
      <label><CalendarDays size={16}/><input type="date" value={dt} onChange={(e)=>setDt(e.target.value)}/></label>
      <button onClick={()=>void go()}><RefreshCw size={16}/>Yangilash</button><a href={dl}><Download size={16}/>Excel</a>
    </div></div>
    {err?<div className="kpi-pr-err">{err}</div>:<>
      <div className="kpi-pr-m"><div>Muassasalar<b>{d.totalInstitutions}</b></div><div>Baholangan<b>{d.evaluatedCount}</b></div><div>O‘rtacha KPI<b>{d.averageScore}/{d.maxAverageScore}</b></div><div>Asoslovchi fayllar<b>{d.fileCount}</b></div></div>
      <div className="kpi-pr-w"><table><thead><tr><th>N</th><th>Muassasa</th>{cs.map((c)=><th key={c.k}>{c.n}</th>)}<th>Jami</th></tr></thead><tbody>
        {d.rows.map((q,i)=><tr key={q.id}><td>{i+1}</td><td>{q.name}</td>{cs.map((c)=><td key={c.k}>{q.excludedDirections?.includes(c.k)?"N/A":Number(q.parts[c.k]||0).toFixed(1)}</td>)}<td className="tot">{Number(q.total).toFixed(1)}</td></tr>)}
      </tbody></table></div>{load&&<small className="kpi-pr-load">Yangilanmoqda...</small>}
    </>}
  </section>;
}
