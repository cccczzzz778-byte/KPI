"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Institution = { id:string; name:string; district:string };
type Criterion = { id:string; title:string; commission:string };
type Evaluation = { criterionId:string; date:string; score:number; note:string; updatedAt:string };
type Payload = { institutions:Institution[]; criteria:Criterion[]; evaluations:Evaluation[]; error?:string };
const field: React.CSSProperties = { minHeight:38, padding:"8px 10px", border:"1px solid #cbd5e1", borderRadius:8, background:"white", color:"#0f172a", width:"100%", maxWidth:520 };
const button: React.CSSProperties = { padding:"10px 16px", background:"#0b766e", color:"white", border:0, borderRadius:8, cursor:"pointer", fontWeight:700 };

export function AdminMonthEditor({ onChanged }: { onChanged?: () => void }) {
  const [month,setMonth] = useState("2026-10");
  const [institutionId,setInstitutionId] = useState("");
  const [payload,setPayload] = useState<Payload | null>(null);
  const [date,setDate] = useState("");
  const [criterionId,setCriterionId] = useState("");
  const [score,setScore] = useState(0);
  const [note,setNote] = useState("");
  const [reason,setReason] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const url = "/api/admin/monthly-scores?month="+encodeURIComponent(month)+"&institutionId="+encodeURIComponent(institutionId);
    const response = await fetch(url,{cache:"no-store"});
    const body = await response.json() as Payload;
    if (!response.ok) throw new Error(body.error || "Baholar yuklanmadi.");
    setPayload(body);
  },[month,institutionId]);

  useEffect(() => { let active=true; void load().catch(err=>{if(active)setError(String(err.message||err));}); return()=>{active=false}; },[load]);

  const dates = useMemo(()=>Array.from(new Set((payload?.evaluations||[]).map(x=>x.date))).sort().reverse(),[payload]);
  useEffect(()=>{if(!dates.includes(date))setDate(dates[0]||"");},[dates,date]);
  const rows = useMemo(()=> (payload?.evaluations||[]).filter(x=>x.date===date),[payload,date]);
  useEffect(()=>{if(!rows.some(x=>x.criterionId===criterionId))setCriterionId(rows[0]?.criterionId||"");},[rows,criterionId]);
  const current = rows.find(x=>x.criterionId===criterionId);
  useEffect(()=>{if(current){setScore(Number(current.score));setNote(current.note||"");setReason("");}},[current?.date,current?.criterionId,current?.score,current?.note]);
  const chosen = payload?.criteria.find(c=>c.id===criterionId);

  async function save(){
    if(!current||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/admin/monthly-scores",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({month,institutionId,date,criterionId,score,note,reason})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||"Saqlashda xatolik.");
      setMessage("Baholash saqlandi. Oylik va ikki oylik natijalar qayta hisoblanadi.");
      await load();onChanged?.();
    }catch(e){setError(e instanceof Error?e.message:"Xatolik");}finally{setBusy(false);}
  }

  return <section className="responsible-card" style={{marginTop:18,padding:18,border:"1px solid #cbd5e1",borderRadius:12}}>
    <h3 style={{fontSize:19,fontWeight:800}}>Sentabr / oktabr baholarini tahrirlash — Admin</h3>
    <p style={{fontSize:13,margin:"8px 0 14px"}}>Faqat mavjud baholar tahrirlanadi. Har bir tuzatish sababi, avvalgi baho va admin ma’lumotlari audit jurnaliga yoziladi. Reyting ballar asosida hisoblanadi.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
      <label>Oy<select style={field} value={month} onChange={e=>{setMonth(e.target.value);setDate("");setCriterionId("");setMessage("");}}><option value="2026-09">Sentabr 2026</option><option value="2026-10">Oktabr 2026</option></select></label>
      <label>Muassasa<select style={field} value={institutionId} onChange={e=>{setInstitutionId(e.target.value);setDate("");setCriterionId("");setMessage("");}}><option value="">Muassasani tanlang</option>{(payload?.institutions||[]).map(x=><option key={x.id} value={x.id}>{x.name} — {x.district}</option>)}</select></label>
      <label>Baholangan sana<select style={field} value={date} onChange={e=>{setDate(e.target.value);setCriterionId("");}} disabled={!dates.length}><option value="">Sana mavjud emas</option>{dates.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    </div>
    {institutionId && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginTop:14}}>
      <label>Mezon<select style={field} value={criterionId} onChange={e=>setCriterionId(e.target.value)} disabled={!rows.length}><option value="">Mezonni tanlang</option>{rows.map(x=>{const c=payload?.criteria.find(v=>v.id===x.criterionId);return <option key={x.criterionId} value={x.criterionId}>{c?.title||x.criterionId} ({x.score})</option>})}</select></label>
      <label>Yangi baho (0–2)<select style={field} value={score} onChange={e=>setScore(Number(e.target.value))} disabled={!current}><option value={0}>0</option><option value={1}>1</option><option value={2}>2</option></select></label>
      <label>Izoh<input style={field} value={note} onChange={e=>setNote(e.target.value)} disabled={!current}/></label>
      <label>O‘zgartirish sababi<input style={field} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Majburiy: tuzatish asosi" disabled={!current}/></label>
    </div>}
    {current&&<p style={{marginTop:12,fontSize:13}}>Yo‘nalish: <strong>{chosen?.commission||"—"}</strong> · Amaldagi baho: <strong>{current.score}</strong> · Sana: <strong>{current.date}</strong></p>}
    {institutionId&&!dates.length&&<p style={{marginTop:12}}>Tanlangan oyda saqlangan baho topilmadi.</p>}
    {error&&<p role="alert" style={{color:"#b91c1c",marginTop:12}}>{error}</p>}
    {message&&<p role="status" style={{color:"#047857",marginTop:12}}>{message}</p>}
    <button type="button" style={{...button,marginTop:14,opacity:(!current || busy || reason.trim().length < 5) ? 0.5 : 1}} disabled={!current||busy||reason.trim().length<5} onClick={()=>void save()}>{busy?"Saqlanmoqda...":"Bahoni saqlash"}</button>
  </section>;
}
