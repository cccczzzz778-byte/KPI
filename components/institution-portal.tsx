/* PATCH53_RECURRENCE_RESET_NOTE: recurrence baseline 2026-09-14; older files remain archive-only. */
"use client";

import { InstitutionDailyFeedback } from "@/components/institution-daily-feedback";

import { InstitutionSubmissionManager } from "@/components/institution-submission-manager";


import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock3, FileCheck2, FileUp, Loader2, LogOut, Paperclip, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { commissions, criteria, type CommissionKey } from "@/lib/kpi-data";
import { uploadFileToNetlify } from "@/lib/client-upload";

type Submission = {
  id: string;
  institutionId: string;
  criterionId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  source: string;
  responsibleName: string;
  responsiblePhone: string;
  submissionDate: string;
  createdAt: string;
};

type PortalData = {
  session: { email: string; name: string; role: string; institutionId: string };
  institution: { id: string; name: string; district: string; type: string; active: number };
  uploadDate: string;
  openTime: string;
  closeTime: string;
  today: string;
  currentTime: string;
  orderIsOpen: boolean;
  criteriaIsOpen: boolean;
  submissions: Submission[];
  responsible: { responsibleName: string; responsiblePhone: string; orderAttachmentId: string } | null;
  order: { id: string; filename: string; sizeBytes: number; submissionDate: string; createdAt: string } | null;
};

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.zip,.rar";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function InstitutionPortal() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [activeCommission, setActiveCommission] = useState<CommissionKey>("ijro");
  /* PATCH80C_INSTITUTION */
  const [excludedCommissions,setExcludedCommissions]=useState<CommissionKey[]>([]);
  useEffect(()=>{let alive=true;fetch("/api/applicability",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"x");if(alive)setExcludedCommissions(Array.isArray(j.excludedCommissions)?j.excludedCommissions:[])}).catch(()=>{if(alive)setExcludedCommissions([])});return()=>{alive=false}},[]);
  useEffect(()=>{if(!excludedCommissions.includes(activeCommission))return;const next=commissions.find(x=>!excludedCommissions.includes(x.id));if(next)setActiveCommission(next.id)},[excludedCommissions,activeCommission]);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const [uploading, setUploading] = useState<string>("");

  async function loadData() {
    try {
      const response = await fetch("/api/institution", { cache: "no-store" });
      const payload = (await response.json()) as PortalData & { error?: string };
      if (response.status === 401) { window.location.href = "/login"; return; }
      if (!response.ok) throw new Error(payload.error || "Ma’lumotlarni yuklab bo‘lmadi.");
      setData(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ma’lumotlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const currentSubmissions = useMemo(() => {
    const result = new Map<string, Submission>();
    const items = (data?.submissions ?? []).filter((item) => item.submissionDate >= "2026-09-14");
    const now = Date.now();

    for (const criterion of criteria) {
      const latest = items.find((item) => item.criterionId === criterion.id);
      if (!latest) continue;

      const deadline = String(criterion.deadline || "").toLocaleLowerCase("uz");
      const daily = deadline.includes("har kuni")
        || deadline.includes("doimiy")
        || deadline.includes("muntazam")
        || deadline.includes("1 kun");

      let locked = false;
      if (daily) {
        locked = latest.submissionDate === data?.today;
      } else {
        let intervalDays: number | null = null;
        if (deadline.includes("1 hafta") || deadline.includes("haftada 1 marta")) intervalDays = 7;
        else if (deadline.includes("10 kun")) intervalDays = 10;
        else if (deadline.includes("1 oy") || deadline.includes("har oyda")) intervalDays = 30;
        else if (deadline.includes("60 kun")) intervalDays = 60;
        else if (deadline.includes("ikkinchi yarim yillik")) intervalDays = 180;

        if (intervalDays) {
          const lastAt = new Date(latest.createdAt).getTime();
          locked = Number.isFinite(lastAt) && now < lastAt + intervalDays * 24 * 60 * 60 * 1000;
        } else {
          locked = latest.submissionDate === data?.today;
        }
      }

      if (locked) result.set(criterion.id, latest);
    }
    return result;
  }, [data]);

  async function upload(criterionId: string) {
    const file = files[criterionId];
    if (!data?.criteriaIsOpen) { toast.error("Mezon fayllari faqat 08:00–19:00 oralig‘ida yuklanadi."); return; }
    if (!data?.responsible) { toast.error("Avval BUYRUQni mas’ul F.I.Sh. va telefon bilan yuklang."); return; }
    if (!file) { toast.error("Faylni tanlang."); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("Fayl hajmi 30 MB dan oshmasligi kerak."); return; }
    if (currentSubmissions.has(criterionId)) { toast.error("Bu mezon uchun joriy davr fayli allaqachon yuklangan. Keyingi ijro muddati kelganda qayta yuklash mumkin."); return; }

    setUploading(criterionId);
    try {
      await uploadFileToNetlify({
        kind: "institution_criterion",
        file,
        criterionId,
      });
      setFiles((value) => ({ ...value, [criterionId]: null }));
      toast.success("Mezon fayli bugungi kun uchun yuklandi. Ertaga yana 1 marta yuklash mumkin.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yuklashda xatolik.");
    } finally {
      setUploading("");
    }
  }

  async function uploadOrder() {
    if (!data?.orderIsOpen) { toast.error("BUYRUQ yuklash oynasi hozir yopiq."); return; }
    if (data.order) { toast.error("BUYRUQ avval yuklangan va bloklangan."); return; }
    if (!responsibleName.trim()) { toast.error("Mas’ul shaxs F.I.Sh.ni kiriting."); return; }
    if (!responsiblePhone.trim()) { toast.error("Mas’ul shaxs telefon raqamini kiriting."); return; }
    if (!orderFile) { toast.error("BUYRUQ (chora-tadbir) faylini tanlang."); return; }
    if (orderFile.size > MAX_FILE_BYTES) { toast.error("Fayl hajmi 30 MB dan oshmasligi kerak."); return; }
    setUploadingOrder(true);
    try {
      await uploadFileToNetlify({
        kind: "institution_order",
        file: orderFile,
        responsibleName: responsibleName.trim(),
        responsiblePhone: responsiblePhone.trim(),
      });
      setOrderFile(null);
      toast.success("BUYRUQ yuklandi. Mas’ul shaxs barcha mezon fayllariga biriktirildi.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "BUYRUQ yuklashda xatolik.");
    } finally { setUploadingOrder(false); }
  }

  if (loading) return <main className="institution-shell"><div className="institution-loading"><Loader2 className="animate-spin" /> Yuklanmoqda...</div></main>;
  if (!data) return <main className="institution-shell"><div className="institution-loading">Ma’lumotlarni yuklab bo‘lmadi. <a href="/login">Qayta kirish</a></div></main>;

  const directionCriteria = excludedCommissions.includes(activeCommission) ? [] : criteria.filter((criterion) => criterion.commission === activeCommission);
  const isTtbOrShtb = data.institution.type === "Tibbiyot birlashmasi" || /tibbiyot birlashmasi/i.test(data.institution.name);
  const opOshpSuffix = " (OP va OSHP kesimida)";
  const commissionLabel = (label: string) => isTtbOrShtb && !label.includes("OP va OSHP kesimida") ? `${label}${opOshpSuffix}` : label;
  const commissionTitle = (title: string) => {
    if (!isTtbOrShtb) return title;
    const cleaned = title
      .replace(/\s*[—-]\s*tuman va shahar tibbiyot birlashmalarida\s*\(OP va OSHP kesimida\)/i, "")
      .replace(/\s*\(OP va OSHP kesimida\)/i, "")
      .trim();
    return `${cleaned}${opOshpSuffix}`;
  };

  return (
    <main className="institution-shell">
      <Toaster richColors position="top-right" />
      <header className="institution-topbar">
        <div><Building2 /><div><span>Muassasa kabineti</span><strong>{data.institution.name}</strong></div></div>
        <a href="/api/auth/logout"><LogOut /> Chiqish</a>
      </header>

      <section className={`upload-window-card ${data.orderIsOpen ? "open" : "closed"}`}>
        <div><Clock3 /><div><span>Buyruq (chora-tadbir) yuklash oynasi</span><strong>{data.uploadDate || "Sana hali belgilanmagan"}</strong><small>08:00 dan 19:00 gacha · Hozir: {data.today} {data.currentTime}</small></div></div>
        <b>{data.orderIsOpen ? "BUYRUQ OCHIQ" : "BUYRUQ YOPIQ"}</b>
      </section>
      <InstitutionDailyFeedback />
      <InstitutionSubmissionManager />
      <section className="responsible-card">
        <div className="responsible-title"><FileCheck2 /><div><strong>BUYRUQ (CHORA-TADBIR) — 1 MARTALIK</strong><span>Mas’ul shaxs shu yerda bir marta belgilanadi va barcha keyingi fayllarga avtomatik javobgar bo‘ladi.</span></div></div>
        {data.order && data.responsible ? <div className="institution-submitted">
          <div><CheckCircle2 /><strong>BUYRUQ yuklangan — qayta yuklash bloklangan</strong></div>
          <a href={`/api/files?id=${encodeURIComponent(data.order.id)}`}><Paperclip /> {data.order.filename} <small>{formatBytes(data.order.sizeBytes)}</small></a>
          <p><b>Mas’ul:</b> {data.responsible.responsibleName} · {data.responsible.responsiblePhone}</p>
        </div> : <>
          <label>Mas’ul shaxs F.I.Sh.<Input value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} placeholder="Masalan: Aliyev Ali Valiyevich" /></label>
          <label>Telefon raqami<div className="phone-field"><Phone /><Input value={responsiblePhone} onChange={(event) => setResponsiblePhone(event.target.value)} placeholder="+998 90 123 45 67" /></div></label>
          <label className="institution-file-picker"><FileUp /><div><strong>{orderFile?.name || "BUYRUQ (chora-tadbir) faylini tanlash"}</strong><span>PDF, JPEG, Word, Excel, ZIP, RAR · 30 MB gacha</span></div><input type="file" accept={ACCEPT} disabled={!data.orderIsOpen} onChange={(event) => setOrderFile(event.target.files?.[0] ?? null)} /></label>
          <Button disabled={!data.orderIsOpen || !orderFile || uploadingOrder} onClick={() => void uploadOrder()}>{uploadingOrder ? <Loader2 className="animate-spin" /> : <FileUp />} BUYRUQni bir marta yuklash</Button>
        </>}
      </section>

      <section className="institution-directions">
        <div className="institution-section-heading"><FileCheck2 /><div><strong>Yo‘nalish → mezonni tanlang</strong><span>Bo‘limlarga ajratilmaydi. Sana belgilanmaydi. Har bir mezon fayli “Ijro muddati”da ko‘rsatilgan davriylik bo‘yicha yuklanadi. Muddat kelmaguncha qayta yuklash bloklanadi. Mas’ul shaxs BUYRUQdan avtomatik olinadi.</span></div></div>
        <div className="institution-commission-tabs">
          {commissions.filter((commission) => !excludedCommissions.includes(commission.id)).map((commission) => <button type="button" key={commission.id} className={activeCommission === commission.id ? "active" : ""} onClick={() => setActiveCommission(commission.id)}><span>{commission.code}</span><div><strong>{commissionLabel(commission.short)}</strong><small>{criteria.filter((item) => item.commission === commission.id).length} ta mezon</small></div></button>)}
        </div>

        <div className="institution-sections-list">
          <article className="institution-program-section">
            <header><span>BAHOLASH MEZONLARI</span><div><strong>{commissionTitle(commissions.find((commission) => commission.id === activeCommission)?.title ?? "")}</strong><small>{directionCriteria.length} ta mezon</small></div></header>
            <div className="institution-criteria-list">{directionCriteria.map((criterion, index) => {
              const submitted = currentSubmissions.get(criterion.id);
              return <div className={`institution-criterion ${submitted ? "locked" : ""}`} key={criterion.id}>
                <div className="institution-criterion-copy"><span>{index + 1}</span><div><strong>{criterion.title}</strong><p>{criterion.detail}</p><small><Clock3 /> {criterion.deadline} · {criterion.source}</small></div></div>
                {criterion.requiresInstitutionFile === false ? <div className="institution-submitted"><div><CheckCircle2 /><strong>Fayl biriktirish shart emas</strong></div><p>Ushbu mezon baholovchi tomonidan kunlik topshiriqlarning o‘z vaqtida bajarilishiga ko‘ra baholanadi.</p></div> : submitted ? <div className="institution-submitted"><div><CheckCircle2 /><strong>Amaldagi fayl yuklangan</strong></div><a href={`/api/files?id=${encodeURIComponent(submitted.id)}`}><Paperclip /> {submitted.filename} <small>{formatBytes(submitted.sizeBytes)}</small></a><p>Mas’ul: {submitted.responsibleName} · {submitted.responsiblePhone} · Qayta yuklash ijro muddati kelganda ochiladi</p></div> : <div className="institution-upload-box"><label className="institution-file-picker"><FileUp /><div><strong>{files[criterion.id]?.name || "Mezon faylini tanlash"}</strong><span>PDF, JPEG, Word, Excel, ZIP, RAR · 30 MB gacha</span></div><input type="file" accept={ACCEPT} disabled={!data.criteriaIsOpen} onChange={(event) => setFiles((value) => ({ ...value, [criterion.id]: event.target.files?.[0] ?? null }))} /></label><Button disabled={!data.criteriaIsOpen || !data.responsible || !files[criterion.id] || uploading === criterion.id} onClick={() => void upload(criterion.id)}>{uploading === criterion.id ? <Loader2 className="animate-spin" /> : <FileUp />} Faylni yuklash</Button></div>}
              </div>;
            })}</div>
          </article>
        </div>
      </section>
    </main>
  );
}
