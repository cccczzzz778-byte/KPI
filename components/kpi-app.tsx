"use client";
import PeriodComparisonPanel from "@/components/period-comparison-panel";
import KpiExcelExport from "@/components/kpi-excel-export";
import AdminDashboardOverview from "@/components/admin-dashboard-overview";
import AdminSystemControl from "@/components/admin-system-control";
import AdminInstitutionApplicability from "@/components/admin-institution-applicability";

import { EvaluatorReferencePanel } from "@/components/evaluator-reference-panel";

import { AdminFileArchive } from "@/components/admin-file-archive";

import { AdminInstitutionManager } from "@/components/admin-institution-manager";
import { AdminMonthEditor } from "@/components/admin-month-editor";
import { getMonthOverride } from "@/lib/kpi-month-overrides";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FileCheck2,
  FileUp,
  HeartPulse,
  Hospital,
  Landmark,
  Loader2,
  LockKeyhole,
  LogOut,
  Paperclip,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { uploadFileToNetlify } from "@/lib/client-upload";
import {
  commissions,
  criteria,
  rounds,
  scoreLabels,
  type CommissionKey,
} from "@/lib/kpi-data";

type PanelMode = "evaluator" | "monitoring" | "admin";
type Session = { email: string; name: string; role: "admin" | "evaluator" | "monitor" | "institution"; commission: CommissionKey | ""; institutionId: string; active: number };
type Institution = { id: string; name: string; district: string; type: string; active: number; createdAt?: string };
type Evaluation = { institutionId: string; roundDay: number; criterionId: string; score: number; note: string; evaluatorEmail: string; evaluatorName: string; updatedAt: string };
type DailyEvaluation = { institutionId: string; criterionId: string; evaluationDate: string; score: number; note: string; evaluatorEmail: string; evaluatorName: string; createdAt: string; updatedAt: string };
type Attachment = { id: string; institutionId: string; roundDay: number; criterionId: string; filename: string; contentType: string; sizeBytes: number; uploadedBy: string; source: string; responsibleName: string; responsiblePhone: string; submissionDate: string; createdAt: string };
type AppUser = { email: string; name: string; role: "admin" | "evaluator" | "monitor" | "institution"; commission: CommissionKey | ""; institutionId: string; active: number; createdAt?: string; updatedAt?: string };
type AuditLog = { id: number; actorEmail: string; action: string; targetType: string; targetId: string; details: string; createdAt: string };
type DashboardData = { session: Session | null; institutions: Institution[]; evaluations: Evaluation[]; dailyEvaluations: DailyEvaluation[]; attachments: Attachment[]; users: AppUser[]; auditLogs: AuditLog[]; uploadSettings: { uploadDate: string; openTime: string; closeTime: string } };
type CommissionExclusion = { institutionId: string; commission: CommissionKey };

const EMPTY_DATA: DashboardData = { session: null, institutions: [], evaluations: [], dailyEvaluations: [], attachments: [], users: [], auditLogs: [], uploadSettings: { uploadDate: "", openTime: "08:00", closeTime: "18:00" } };
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const iconByCommission = { ijro: ClipboardCheck, birlamchi: HeartPulse, statsionar: Hospital, raqam: Database, moliya: Landmark };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function tashkentDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function kpiMonthKeyForDate(date:string){return date<"2026-10-05"?"2026-09":date.slice(0,7)}
function currentKpiMonthKey(){return kpiMonthKeyForDate(tashkentDateKey())}
function kpiMonthBounds(key:string){if(key==="2026-09")return{start:"2000-01-01",end:"2026-10-04"};if(key==="2026-10")return{start:"2026-10-05",end:"2026-10-31"};const m=/^(\d{4})-(\d{2})$/.exec(key);if(!m)return{start:"2026-10-05",end:"2026-10-31"};const y=Number(m[1]),mo=Number(m[2]),last=new Date(Date.UTC(y,mo,0)).getUTCDate();return{start:key+"-01",end:key+"-"+String(last).padStart(2,"0")}}
const KPI_MONTH_NAMES=["","Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
function kpiMonthLabel(key:string){const [y,m]=key.split("-").map(Number);if(key==="2026-09")return"Sentabr 2026 · oldingi oy";if(key==="2026-10")return"Oktabr 2026 · 5-oktabrdan";return(KPI_MONTH_NAMES[m]||key)+" "+y}

function cumulative60Score(rows: DailyEvaluation[], institutionId: string, criterionIds?: Set<string>) {
  const grouped = new Map<string, DailyEvaluation[]>();
  rows.forEach((row) => {
    if (row.institutionId !== institutionId || (criterionIds && !criterionIds.has(row.criterionId))) return;
    const list = grouped.get(row.criterionId) ?? [];
    list.push(row);
    grouped.set(row.criterionId, list);
  });
  let total = 0;
  grouped.forEach((list) => {
    list.sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate));
    total += list.slice(0, 60).reduce((sum, row) => sum + Number(row.score || 0), 0);
  });
  return total;
}

const commissionMaxScores: Record<CommissionKey, number> = {"ijro":10.3,"birlamchi":29.4,"statsionar":23.5,"raqam":13.3,"moliya":23.5};

function getCommissionMaxScore(commissionId: CommissionKey) {
  return commissionMaxScores[commissionId];
}

function getCommissionDraftScore(commissionId: CommissionKey, scoreSource: Record<string, number>) {
  const items = criteria.filter((criterion) => criterion.commission === commissionId);
  if (!items.length) return 0;
  const earned = items.reduce((sum, criterion) => sum + (scoreSource[criterion.id] ?? 0), 0);
  const maxScore = getCommissionMaxScore(commissionId);
  if (!items.length) return 0;
  const calculated = Number(((earned / (items.length * 2)) * maxScore).toFixed(1));
  return Math.max(0, Math.min(maxScore, calculated));
}

function getCommissionScore(commissionId: CommissionKey, institutionId: string, roundDay: number, evaluationMap: Map<string, number>) {
  const scoreSource = Object.fromEntries(
    criteria
      .filter((criterion) => criterion.commission === commissionId)
      .map((criterion) => [criterion.id, evaluationMap.get(`${institutionId}:${roundDay}:${criterion.id}`) ?? 0]),
  );
  return getCommissionDraftScore(commissionId, scoreSource);
}

function scoreStatus(total: number, hasEvaluation: boolean) {
  if (!hasEvaluation) return { label: "Baholanmagan", className: "status-pending" };
  if (total >= 86) return { label: "A’lo", className: "status-excellent" };
  if (total >= 71) return { label: "Yaxshi", className: "status-good" };
  if (total >= 56) return { label: "Qoniqarli", className: "status-average" };
  return { label: "Tanqidiy", className: "status-critical" };
}

function RoundGauge({ day }: { day: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="round-gauge" aria-label={`60 kunlik dastur: ${day}-kun`}>
      <svg viewBox="0 0 84 84" role="img">
        <circle className="round-gauge-track" cx="42" cy="42" r={radius} />
        <circle className="round-gauge-value" cx="42" cy="42" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - day / 60)} />
      </svg>
      <div><strong>{day}</strong><span>/ 60 kun</span></div>
    </div>
  );
}

function roleLabel(role: Session["role"]) {
  return role === "admin" ? "Administrator" : role === "monitor" ? "Tahlil va monitoring" : role === "institution" ? "Muassasa" : "Baholovchi";
}

function accountRoleLabel(user: Pick<AppUser, "role" | "commission" | "institutionId">) {
  if (user.role === "institution") return `Muassasa (${user.institutionId || "biriktirilmagan"})`;
  if (user.role !== "evaluator") return roleLabel(user.role);
  const commission = commissions.find((item) => item.id === user.commission);
  return `Baholovchi (${commission?.title ?? "yo‘nalish biriktirilmagan"})`;
}

export default function KpiApp({ mode = "monitoring" }: { mode?: PanelMode }) {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [selectedKpiMonth, setSelectedKpiMonth] = useState(() => currentKpiMonthKey());
  const [commissionExclusions, setCommissionExclusions] = useState<CommissionExclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRound, setSelectedRound] = useState<number>(10);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [institutionOpen, setInstitutionOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [activeCommission, setActiveCommission] = useState<CommissionKey>("ijro");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState(false);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [institutionForm, setInstitutionForm] = useState({ id: "", name: "", district: "", type: "", active: true });
  const [userForm, setUserForm] = useState<{ email: string; password: string; name: string; role: AppUser["role"]; commission: CommissionKey; institutionId: string; active: boolean }>({ email: "", password: "", name: "", role: "evaluator", commission: "ijro", institutionId: "", active: true });

  const setPayload = (payload: DashboardData) => {
    setData({
      session: payload.session,
      institutions: payload.institutions ?? [],
      evaluations: payload.evaluations ?? [],
      dailyEvaluations: payload.dailyEvaluations ?? [],
      attachments: payload.attachments ?? [],
      users: payload.users ?? [],
      auditLogs: payload.auditLogs ?? [],
      uploadSettings: payload.uploadSettings ?? { uploadDate: "", openTime: "08:00", closeTime: "18:00" },
    });
  };

  async function loadCommissionExclusions() {
    try {
      const response = await fetch("/api/applicability", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { exclusions?: CommissionExclusion[] };
      setCommissionExclusions(Array.isArray(payload.exclusions) ? payload.exclusions : []);
    } catch {
      // Keep current KPI data if this auxiliary refresh fails.
    }
  }
  const loadData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/kpi", { cache: "no-store" });
      const payload = (await response.json()) as DashboardData & { error?: string };
      if (response.status === 401) { window.location.href = "/login"; return; }
      if (!response.ok) throw new Error(payload.error || "Ma’lumotlarni yuklab bo‘lmadi.");
      setPayload(payload);
      await loadCommissionExclusions();
      setError("");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Ma’lumotlarni yuklashda xatolik.";
      setError(message);
      toast.error(message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/kpi", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as DashboardData & { error?: string };
        if (response.status === 401) { window.location.href = "/login"; throw new Error("Tizimga kirish talab qilinadi."); }
        if (!response.ok) throw new Error(payload.error || "Ma’lumotlarni yuklab bo‘lmadi.");
        return payload;
      })
      .then((payload) => { if (active) setPayload(payload); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Kirishda xatolik."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void loadCommissionExclusions();
  }, []);

  const evaluationMap = useMemo(() => new Map(data.evaluations.map((item) => [`${item.institutionId}:${item.roundDay}:${item.criterionId}`, Number(item.score)])), [data.evaluations]);
  const kpiMonthOptions = useMemo(() => { const keys=new Set<string>([currentKpiMonthKey()]); data.dailyEvaluations.forEach((item)=>keys.add(kpiMonthKeyForDate(item.evaluationDate))); return Array.from(keys).sort((a,b)=>b.localeCompare(a)); }, [data.dailyEvaluations]);
  const historicalEvaluationMap = useMemo(() => {
    const grouped = new Map<string, DailyEvaluation>();
    const bounds=kpiMonthBounds(selectedKpiMonth);
    data.dailyEvaluations.forEach((item) => {
      if(item.evaluationDate<bounds.start||item.evaluationDate>bounds.end)return;
      const key = `${item.institutionId}:${item.criterionId}`;
      const current = grouped.get(key);
      if (!current || item.evaluationDate > current.evaluationDate || (item.evaluationDate === current.evaluationDate && item.updatedAt > current.updatedAt)) grouped.set(key, item);
    });
    return new Map(Array.from(grouped.entries()).map(([key, value]) => [key, Math.max(0, Math.min(2, Number(value.score) || 0))]));
  }, [data.dailyEvaluations, selectedKpiMonth]);
  const ranking = useMemo(() => data.institutions.filter((item) => item.active !== 0).map((institution) => {
    const override = getMonthOverride(selectedKpiMonth, institution.id);
    const excludedDirections = override ? new Set<CommissionKey>(commissions.filter((commission) => override[commission.id] === null).map((commission) => commission.id)) : new Set<CommissionKey>(
      commissionExclusions.filter((item) => item.institutionId === institution.id).map((item) => item.commission),
    );
    const parts = Object.fromEntries(commissions.map((commission) => {
      if (excludedDirections.has(commission.id)) return [commission.id, 0];
      const scoreSource = Object.fromEntries(
        criteria
          .filter((criterion) => criterion.commission === commission.id)
          .map((criterion) => [criterion.id, historicalEvaluationMap.get(`${institution.id}:${criterion.id}`) ?? 0]),
      );
      return [commission.id, override ? Number(override[commission.id] || 0) : getCommissionDraftScore(commission.id, scoreSource)];
    })) as Record<CommissionKey, number>;
    const applicable = commissions.filter((commission) => !excludedDirections.has(commission.id));
    const rawTotal = applicable.reduce((sum, commission) => sum + parts[commission.id], 0);
    const applicableMaximum = applicable.reduce((sum, commission) => sum + getCommissionMaxScore(commission.id), 0);
    const total = applicableMaximum > 0 ? Number(((rawTotal / applicableMaximum) * 100).toFixed(1)) : 0;
    const selectedBounds=kpiMonthBounds(selectedKpiMonth);
    const hasEvaluation = Boolean(override) || data.dailyEvaluations.some((evaluation) => {
      if (evaluation.institutionId !== institution.id || evaluation.evaluationDate<selectedBounds.start || evaluation.evaluationDate>selectedBounds.end) return false;
      const criterion = criteria.find((item) => item.id === evaluation.criterionId);
      return Boolean(criterion && !excludedDirections.has(criterion.commission));
    });
    return { institution, parts, total, hasEvaluation, applicableCount: criteria.filter((criterion) => !excludedDirections.has(criterion.commission)).length, excludedDirections: Array.from(excludedDirections) };
  }).sort((a, b) => Number(b.hasEvaluation) - Number(a.hasEvaluation) || b.total - a.total || b.applicableCount - a.applicableCount || a.institution.name.localeCompare(b.institution.name, "uz")), [data, historicalEvaluationMap, commissionExclusions, selectedKpiMonth]);

  const evaluated = ranking.filter((row) => row.hasEvaluation);
  const average = evaluated.length ? Number((evaluated.reduce((sum, row) => sum + row.total, 0) / evaluated.length).toFixed(1)) : 0;
  const selectedResponsible = selectedInstitution
    ? data.attachments.find((attachment) => attachment.institutionId === selectedInstitution.id && attachment.source === "institution_order" && (attachment.responsibleName || attachment.responsiblePhone))
      ?? data.attachments.find((attachment) => attachment.institutionId === selectedInstitution.id && attachment.source === "institution" && (attachment.responsibleName || attachment.responsiblePhone))
    : undefined;
  const selectedOrder = selectedInstitution
    ? data.attachments.find((attachment) => attachment.institutionId === selectedInstitution.id && attachment.source === "institution_order")
    : undefined;
  const session = data.session;
  const isAdmin = session?.role === "admin";
  const canEvaluate = session?.role === "admin" || session?.role === "evaluator";
  const readOnlyEvaluation = mode === "monitoring" || session?.role === "monitor";
  const visibleCommissions = session?.role === "evaluator"
    ? commissions.filter((commission) => commission.id === session.commission)
    : commissions;
  const modeAllowed = mode === "admin" ? isAdmin : mode === "evaluator" ? canEvaluate : isAdmin || session?.role === "monitor";

  function openEvaluation(institution: Institution, preferred?: CommissionKey) {
    const patch64Today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const currentMonthBounds=kpiMonthBounds(currentKpiMonthKey());
  const cycleRows=data.dailyEvaluations.filter((item)=>item.institutionId===institution.id&&item.evaluationDate>=currentMonthBounds.start&&item.evaluationDate<=currentMonthBounds.end);
  const latestCycleRows=new Map<string,DailyEvaluation>();
  cycleRows.forEach((item)=>{const prev=latestCycleRows.get(item.criterionId);if(!prev||item.evaluationDate>prev.evaluationDate)latestCycleRows.set(item.criterionId,item)});
  const patch64DailyEvaluationIds = new Set(
    criteria.filter((item) => String(item.deadline || "").toLocaleLowerCase("uz").includes("doimiy")).map((item) => item.id),
  );
  const patch64TodayRows = data.dailyEvaluations.filter(
    (item) => item.institutionId === institution.id && item.evaluationDate === patch64Today && patch64DailyEvaluationIds.has(item.criterionId),
  );
  const patch64DisplayRows = [
    ...Array.from(latestCycleRows.values()).filter((item) => !patch64DailyEvaluationIds.has(item.criterionId)),
    ...patch64TodayRows,
  ];
    setScores(Object.fromEntries(patch64DisplayRows.map((item) => [item.criterionId, Number(item.score)])));
    setNotes(Object.fromEntries(criteria.map((criterion) => {
      const saved = patch64DisplayRows.find((item) => item.criterionId === criterion.id);
      return [criterion.id, saved?.note ?? ""];
    })));
    setFiles({});
    setSelectedInstitution(institution);
    setActiveCommission(preferred ?? (session?.role === "evaluator" && session.commission ? session.commission : "ijro"));
    setEvaluationOpen(true);
  }

  function openInstitution(institution?: Institution) {
    setInstitutionForm(institution
      ? { id: institution.id, name: institution.name, district: institution.district, type: institution.type, active: institution.active !== 0 }
      : { id: "", name: "", district: "", type: "", active: true });
    setInstitutionOpen(true);
  }

  function openUser(user?: AppUser) {
    setUserForm(user
      ? { email: user.email, password: "", name: user.name, role: user.role, commission: user.commission || "ijro", institutionId: user.institutionId || "", active: user.active !== 0 }
      : { email: "", password: "", name: "", role: "evaluator", commission: "ijro", institutionId: "", active: true });
    setShowUserPassword(false);
    setUserOpen(true);
  }

  async function saveInstitution(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/kpi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upsert_institution", ...institutionForm }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Muassasani saqlab bo‘lmadi.");
      setInstitutionOpen(false);
      await loadData(true);
      toast.success("Muassasa ma’lumotlari saqlandi.");
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Saqlashda xatolik."); }
    finally { setSaving(false); }
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/kpi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upsert_user", ...userForm }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Foydalanuvchini saqlab bo‘lmadi.");
      setUserOpen(false);
      await loadData(true);
      toast.success("Foydalanuvchi huquqlari saqlandi.");
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Saqlashda xatolik."); }
    finally { setSaving(false); }
  }

  async function saveEvaluation() {
    if (!selectedInstitution) return;
    const activeCriteria = criteria.filter((criterion) => criterion.commission === activeCommission && Object.prototype.hasOwnProperty.call(scores, criterion.id));
    const commissionScores = Object.fromEntries(activeCriteria.map((criterion) => [criterion.id, scores[criterion.id] ?? 0]));
    const commissionNotes = Object.fromEntries(activeCriteria.map((criterion) => [criterion.id, notes[criterion.id] ?? ""]));
    setSaving(true);
    try {
      const response = await fetch("/api/kpi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save_evaluation", institutionId: selectedInstitution.id, roundDay: selectedRound, scores: commissionScores, notes: commissionNotes }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Baholashni saqlab bo‘lmadi.");

      const pendingFiles = activeCriteria.filter((criterion) => files[criterion.id]);
      await Promise.all(pendingFiles.map(async (criterion) => {
        const file = files[criterion.id];
        if (!file) return;
        await uploadFileToNetlify({
          kind: "evaluator",
          file,
          institutionId: selectedInstitution.id,
          roundDay: selectedRound,
          criterionId: criterion.id,
        });
      }));
      await loadData(true);
      setFiles({});
      setEvaluationOpen(false);
      toast.success(`${commissions.find((item) => item.id === activeCommission)?.short} bo‘yicha bugungi baholar alohida saqlandi. 60 kunlik yig‘indi avtomatik hisoblanadi.`);
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Saqlashda xatolik."); }
    finally { setSaving(false); }
  }

  async function deleteAttachment(id: string) {
    if (!confirm("Biriktirilgan fayl o‘chirilsinmi?")) return;
    try {
      const response = await fetch(`/api/files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Faylni o‘chirib bo‘lmadi.");
      await loadData(true);
      toast.success("Fayl o‘chirildi.");
    } catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : "O‘chirishda xatolik."); }
  }

  const draftScores = Object.fromEntries(
    commissions.map((commission) => [commission.id, getCommissionDraftScore(commission.id, scores)]),
  ) as Record<CommissionKey, number>;
  const draftTotal = Number(commissions.reduce((sum, commission) => sum + draftScores[commission.id], 0).toFixed(1));
  const activeCriterionIds = new Set(criteria.filter((criterion) => criterion.commission === activeCommission).map((criterion) => criterion.id));
  const cumulative60 = selectedInstitution ? cumulative60Score(data.dailyEvaluations, selectedInstitution.id, activeCriterionIds) : 0;

  if (loading) {
    return <main className="dashboard-shell"><div className="page-loading"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-96 w-full" /></div></main>;
  }

  if (error || !session) {
    return (
      <main className="dashboard-shell"><section className="access-state"><LockKeyhole /><h1>Tizimga kirish amalga oshmadi</h1><p>{error || "Foydalanuvchi aniqlanmadi."}</p><a href="/login">Login va parol orqali kirish</a></section></main>
    );
  }

  if (!modeAllowed) {
    return (
      <main className="dashboard-shell"><section className="access-state"><ShieldCheck /><h1>Bu panel uchun ruxsat yo‘q</h1><p>Sizning rolingiz: {accountRoleLabel(session)}.</p><a href={session.role === "evaluator" ? "/evaluator" : session.role === "monitor" ? "/monitoring" : "/admin"}>Ruxsat berilgan panelga o‘tish</a></section></main>
    );
  }

  return (
    <main className="dashboard-shell">{session.role !== "institution" && <KpiExcelExport />}
      <Toaster richColors position="top-right" />
      <header className="topbar app-topbar">
        <div className="brand-lockup"><div className="brand-mark"><Stethoscope size={24} strokeWidth={1.8} /></div><div><p>Buxoro viloyati sog‘liqni saqlash boshqarmasi</p><h1>Tibbiyot muassasalari KPI nazorati</h1></div></div>
        <nav className="panel-nav" aria-label="Boshqaruv panellari">
          <Link href="/"><BarChart3 /> Dashboard</Link>
          {(session.role === "admin" || session.role === "evaluator") && <a className={mode === "evaluator" ? "active" : ""} href="/evaluator"><ClipboardCheck /> Baholovchi</a>}
          {(session.role === "admin" || session.role === "monitor") && <a className={mode === "monitoring" ? "active" : ""} href="/monitoring"><BarChart3 /> Monitoring</a>}
          {session.role === "admin" && <a className={mode === "admin" ? "active" : ""} href="/admin"><Settings /> Admin</a>}
        </nav>
        <div className="account-chip"><div><strong>{session.name || session.email}</strong><span>{accountRoleLabel(session)}</span></div><a href="/api/auth/logout" title="Chiqish"><LogOut /></a></div>
      </header>

      <section className="control-deck">
        <div className="control-copy">
          <p className="eyebrow">2026-yil II yarim yillik · {mode === "admin" ? "Administrator paneli" : mode === "evaluator" ? accountRoleLabel(session) : "Tahlil va monitoring paneli"}</p>
          <h2>{mode === "admin" ? "Tizim, foydalanuvchilar va baholarni boshqaring" : mode === "evaluator" ? "Muassasalarni yuklangan mezonlar bo‘yicha bosqichma-bosqich baholang" : "KPI natijalari va asoslarini bir joyda tahlil qiling"}</h2>
          <p>5 ta yo‘nalish bo‘yicha mezonlar 0/1/2 ball bilan baholanadi. Baholovchi har kuni yangidan ball qo‘yadi, har kunlik baho alohida saqlanadi va 60 kungacha yig‘indi avtomatik hisoblanadi. Izoh ixtiyoriy.</p>
        </div>
        <div className="round-control"><RoundGauge day={selectedRound} /><div><label>Baholash bosqichi</label><Select value={String(selectedRound)} onValueChange={(value) => setSelectedRound(Number(value))}><SelectTrigger className="round-select"><SelectValue /></SelectTrigger><SelectContent>{rounds.map((round) => <SelectItem key={round} value={String(round)}>{round}-kunlik nazorat</SelectItem>)}</SelectContent></Select><span>10, 20, 30, 40, 50 va 60-kunlarda</span></div></div>
      </section>

      {mode === "admin" ? (
        <AdminPanel data={data} onRefresh={() => void loadData()} onAddUser={() => openUser()} onEditUser={openUser} onAddInstitution={() => openInstitution()} onEditInstitution={openInstitution} onOpenEvaluation={openEvaluation} onDeleteAttachment={deleteAttachment} selectedRound={selectedRound} />
      ) : mode === "evaluator" ? (
        <EvaluatorReferencePanel data={data} session={session} selectedRound={selectedRound} onOpenEvaluation={openEvaluation} />
      ) : (
        <MonitoringPanel data={data} ranking={ranking} evaluatedCount={evaluated.length} average={average} selectedRound={selectedRound} selectedMonth={selectedKpiMonth} monthOptions={kpiMonthOptions} onMonthChange={setSelectedKpiMonth} onRefresh={() => void loadData()} onOpenEvaluation={openEvaluation} />
      )}

      <footer className="site-footer"><span><Activity size={15} /> 60 kunlik strategik o‘zgarishlar dasturi asosida</span><span>Himoyalangan kirish · Harakatlar jurnali · 30 MB fayl chegarasi</span></footer>

      <Dialog open={institutionOpen} onOpenChange={setInstitutionOpen}>
        <DialogContent><form onSubmit={saveInstitution}><DialogHeader><DialogTitle>Muassasa ma’lumotlari</DialogTitle><DialogDescription>Administrator muassasani qo‘shishi, tahrirlashi yoki faolsizlantirishi mumkin.</DialogDescription></DialogHeader><div className="form-stack"><label>Muassasa nomi<Input value={institutionForm.name} onChange={(event) => setInstitutionForm((value) => ({ ...value, name: event.target.value }))} required /></label><label>Hudud<Input value={institutionForm.district} onChange={(event) => setInstitutionForm((value) => ({ ...value, district: event.target.value }))} /></label><label>Muassasa turi<Input value={institutionForm.type} onChange={(event) => setInstitutionForm((value) => ({ ...value, type: event.target.value }))} /></label><label className="switch-row">Faol muassasa<Switch checked={institutionForm.active} onCheckedChange={(active) => setInstitutionForm((value) => ({ ...value, active }))} /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setInstitutionOpen(false)}>Bekor qilish</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Saqlash</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent><form onSubmit={saveUser}><DialogHeader><DialogTitle>Foydalanuvchi va ruxsat</DialogTitle><DialogDescription>Har bir foydalanuvchiga mustaqil login-parol, rol va tegishli yo‘nalish biriktiriladi.</DialogDescription></DialogHeader><div className="form-stack"><label>Login<Input type="text" value={userForm.email} onChange={(event) => setUserForm((value) => ({ ...value, email: event.target.value.toLowerCase() }))} required disabled={Boolean(data.users.find((item) => item.email === userForm.email))} /></label><label>Parol<div className="admin-password-field"><Input type={showUserPassword ? "text" : "password"} value={userForm.password} onChange={(event) => setUserForm((value) => ({ ...value, password: event.target.value }))} placeholder={data.users.find((item) => item.email === userForm.email) ? "O‘zgartirmasangiz bo‘sh qoldiring" : "Kamida 6 ta belgi"} /><button type="button" className="admin-password-toggle" onClick={() => setShowUserPassword((value) => !value)} aria-label={showUserPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"} title={showUserPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"}>{showUserPassword ? <EyeOff /> : <Eye />}</button></div></label><label>F.I.Sh.<Input value={userForm.name} onChange={(event) => setUserForm((value) => ({ ...value, name: event.target.value }))} /></label><label>Rol<Select value={userForm.role} onValueChange={(role) => setUserForm((value) => ({ ...value, role: role as AppUser["role"] }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="evaluator">Baholovchi</SelectItem><SelectItem value="monitor">Tahlil va monitoring</SelectItem><SelectItem value="institution">Muassasa</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent></Select></label>{userForm.role === "evaluator" && <label>Biriktirilgan yo‘nalish<Select value={userForm.commission} onValueChange={(commission) => setUserForm((value) => ({ ...value, commission: commission as CommissionKey }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{commissions.map((commission) => <SelectItem key={commission.id} value={commission.id}>{commission.title}</SelectItem>)}</SelectContent></Select></label>}{userForm.role === "institution" && <label>Biriktirilgan muassasa<Select value={userForm.institutionId} onValueChange={(institutionId) => setUserForm((value) => ({ ...value, institutionId }))}><SelectTrigger className="w-full"><SelectValue placeholder="Muassasani tanlang" /></SelectTrigger><SelectContent>{data.institutions.map((institution) => <SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>)}</SelectContent></Select></label>}<label className="switch-row">Hisob faol<Switch checked={userForm.active} onCheckedChange={(active) => setUserForm((value) => ({ ...value, active }))} /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setUserOpen(false)}>Bekor qilish</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Saqlash</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={evaluationOpen} onOpenChange={setEvaluationOpen}>
        <DialogContent className="evaluation-dialog" showCloseButton>
          <DialogHeader className="evaluation-header"><div className="evaluation-header-main"><DialogTitle>{selectedInstitution?.name}</DialogTitle><DialogDescription>{tashkentDateKey()} · Kunlik baholash · {readOnlyEvaluation ? "ball, izoh va fayl asoslarini ko‘rish" : "bugungi kerakli mezonlarni baholab saqlang"}</DialogDescription><div className={`evaluation-responsible ${selectedResponsible ? "has-responsible" : "no-responsible"}`}><span>Mas’ul shaxs</span>{selectedResponsible ? <><strong>{selectedResponsible.responsibleName || "—"}</strong><a href={selectedResponsible.responsiblePhone ? `tel:${selectedResponsible.responsiblePhone.replace(/\s+/g, "")}` : undefined}>Tel: {selectedResponsible.responsiblePhone || "—"}</a></> : <strong>Mas’ul shaxs belgilanmagan</strong>}</div>{selectedOrder && <a className="evaluation-order-link" href={`/api/files?id=${selectedOrder.id}`} target="_blank" rel="noreferrer"><Eye /> BUYRUQni ochish</a>}</div><div className="draft-total"><span>Bugungi KPI</span><strong>{draftTotal}<small>/100</small></strong><em style={{ display: "block", marginTop: 4, fontSize: 11, fontStyle: "normal", opacity: .85 }}>60 kunlik yig‘indi: {cumulative60} ball</em></div></DialogHeader>
          <Tabs value={activeCommission} onValueChange={(value) => setActiveCommission(value as CommissionKey)} className="evaluation-tabs">
            <TabsList className="evaluation-tablist">{visibleCommissions.map((commission) => <TabsTrigger key={commission.id} value={commission.id}><span>{commission.code}</span><div>{commission.short}<strong>{draftScores[commission.id]}/{getCommissionMaxScore(commission.id)}</strong></div></TabsTrigger>)}</TabsList>
            {visibleCommissions.map((commission) => <EvaluationSection key={commission.id} commissionId={commission.id} scores={scores} notes={notes} files={files} data={data} institution={selectedInstitution} roundDay={selectedRound} readOnly={readOnlyEvaluation} onScore={(criterionId, score) => setScores((value) => ({ ...value, [criterionId]: score }))} onNote={(criterionId, note) => setNotes((value) => ({ ...value, [criterionId]: note }))} onFile={(criterionId, file) => { if (file && file.size > MAX_FILE_BYTES) { toast.error("Fayl hajmi 30 MB dan oshmasligi kerak."); return; } setFiles((value) => ({ ...value, [criterionId]: file })); }} onDeleteAttachment={deleteAttachment} />)}
          </Tabs>
          <DialogFooter className="evaluation-footer"><div><Paperclip /> Har bir fayl uchun maksimal hajm: 30 MB</div><Button variant="outline" onClick={() => setEvaluationOpen(false)}>Yopish</Button>{!readOnlyEvaluation && <Button onClick={saveEvaluation} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Tanlangan mezonlarni saqlash</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function MonitoringPanel({ data, ranking, evaluatedCount, average, selectedRound, selectedMonth, monthOptions, onMonthChange, onRefresh, onOpenEvaluation }: { data: DashboardData; ranking: Array<{ institution: Institution; parts: Record<CommissionKey, number>; total: number; hasEvaluation: boolean; applicableCount: number; excludedDirections: CommissionKey[] }>; evaluatedCount: number; average: number; selectedRound: number; selectedMonth:string; monthOptions:string[]; onMonthChange:(value:string)=>void; onRefresh: () => void; onOpenEvaluation: (institution: Institution) => void }) {
  return <><section className="metric-grid" aria-label="KPI umumiy ko‘rsatkichlari"><article className="metric-card"><div className="metric-icon blue"><Building2 /></div><div><span>Muassasalar</span><strong>{ranking.length}</strong><small>faol muassasa</small></div></article><article className="metric-card"><div className="metric-icon teal"><FileCheck2 /></div><div><span>Baholangan</span><strong>{evaluatedCount}</strong><small>{kpiMonthLabel(selectedMonth)}</small></div></article><article className="metric-card"><div className="metric-icon violet"><BarChart3 /></div><div><span>O‘rtacha KPI</span><strong>{average}<em>/100</em></strong><small>{kpiMonthLabel(selectedMonth)}</small></div></article><article className="metric-card"><div className="metric-icon amber"><Paperclip /></div><div><span>Asoslovchi fayllar</span><strong>{data.attachments.length}</strong><small>markaziy omborda</small></div></article></section><CommissionCards /><PeriodComparisonPanel mode="monitoring" /><section className="workspace-panel"><div className="workspace-toolbar"><h3 className="panel-heading"><BarChart3 /> Muassasalar reytingi va asoslari</h3><div className="monitor-month-tools"><Select value={selectedMonth} onValueChange={onMonthChange}><SelectTrigger className="kpi-month-select"><SelectValue /></SelectTrigger><SelectContent>{monthOptions.map((month)=><SelectItem key={month} value={month}>{kpiMonthLabel(month)}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw /> Yangilash</Button></div></div><RankingTable ranking={ranking} onOpen={onOpenEvaluation} actionLabel="Asoslarni ko‘rish" /></section></>;
}

function EvaluatorPanel({ data, session, selectedRound, onOpenEvaluation }: { data: DashboardData; session: Session; selectedRound: number; onOpenEvaluation: (institution: Institution, commission?: CommissionKey) => void }) {
  const commission = commissions.find((item) => item.id === session.commission) ?? commissions[0];
  const relevantCriteria = criteria.filter((item) => item.commission === commission.id);
  return <><section className="assignment-banner" style={{ "--commission": commission.color } as React.CSSProperties}><div><span>Biriktirilgan yo‘nalish</span><h3>Baholovchi ({commission.title})</h3><p>Faqat shu yo‘nalishdagi baholash mezonlari ko‘rinadi · {getCommissionMaxScore(commission.id)} ball · Izoh ixtiyoriy · Bosqichma-bosqich baholash mumkin</p></div><div><FileUp /><strong>30 MB</strong><span>har bir fayl uchun</span></div></section><section className="workspace-panel"><div className="workspace-toolbar"><h3 className="panel-heading"><ClipboardCheck /> Baholash uchun muassasalar ({commission.short})</h3><span className="toolbar-note">{selectedRound}-kunlik nazorat</span></div><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Muassasa</TableHead><TableHead>Yo‘nalish natijasi</TableHead><TableHead>To‘ldirilgan mezonlar</TableHead><TableHead>Fayllar</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.institutions.filter((item) => item.active !== 0).map((institution, index) => { const saved = data.evaluations.filter((item) => item.institutionId === institution.id && item.roundDay === selectedRound && relevantCriteria.some((criterion) => criterion.id === item.criterionId)); const savedScoreSource = Object.fromEntries(saved.map((item) => [item.criterionId, Number(item.score)])); const score = getCommissionDraftScore(commission.id, savedScoreSource); const fileCount = data.attachments.filter((item) => item.institutionId === institution.id && (item.roundDay === selectedRound || item.source === "institution") && relevantCriteria.some((criterion) => criterion.id === item.criterionId)).length; return <TableRow key={institution.id}><TableCell>{index + 1}</TableCell><TableCell className="institution-cell"><strong>{institution.name}</strong><span>{institution.district} · {institution.type}</span></TableCell><TableCell className="total-col"><strong>{score}</strong><span>/{getCommissionMaxScore(commission.id)}</span></TableCell><TableCell>{saved.length}/{relevantCriteria.length}</TableCell><TableCell><span className="file-count"><Paperclip /> {fileCount}</span></TableCell><TableCell className="action-col"><Button size="sm" onClick={() => onOpenEvaluation(institution, commission.id)}>Baholash <ChevronRight /></Button></TableCell></TableRow>; })}</TableBody></Table></section></>;
}

function UploadDateCard({ settings, onSaved }: { settings: DashboardData["uploadSettings"]; onSaved: () => void }) {
  const [uploadDate, setUploadDate] = useState(settings.uploadDate || "");
  const [savingDate, setSavingDate] = useState(false);
  useEffect(() => { setUploadDate(settings.uploadDate || ""); }, [settings.uploadDate]);

  async function saveDate(value = uploadDate) {
    setSavingDate(true);
    try {
      const response = await fetch("/api/kpi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_institution_upload_date", uploadDate: value }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Yuklash sanasini saqlab bo‘lmadi.");
      toast.success(value ? `BUYRUQ yuklash ${value} kuni 08:00–18:00 ochiladi.` : "BUYRUQ yuklash sanasi yopildi.");
      onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Saqlashda xatolik."); }
    finally { setSavingDate(false); }
  }

  return <section className="admin-upload-window"><div><Clock3 /><div><span>FAQAT BUYRUQ UCHUN 1 KUNLIK SANA</span><strong>{settings.uploadDate || "BUYRUQ sanasi belgilanmagan"}</strong><small>Tanlangan sana faqat BUYRUQ (chora-tadbir) yuklashga tegishli: shu kuni 08:00–18:00 bir marta yuklanadi. Mezon fayllari uchun sana belgilanmaydi — ular har kuni 08:00–18:00, har bir mezonga kuniga 1 martadan yuklanadi.</small></div></div><div className="admin-upload-window-controls"><Input type="date" aria-label="Faqat BUYRUQ uchun sana" value={uploadDate} onChange={(event) => setUploadDate(event.target.value)} /><Button onClick={() => void saveDate()} disabled={savingDate}>{savingDate && <Loader2 className="animate-spin" />} BUYRUQ sanasini saqlash</Button><Button variant="outline" onClick={() => { setUploadDate(""); void saveDate(""); }}>BUYRUQ sanasini yopish</Button></div></section>;
}

function AdminPanel({ data, onRefresh, onAddUser, onEditUser, onAddInstitution, onEditInstitution, onOpenEvaluation, onDeleteAttachment, selectedRound }: { data: DashboardData; onRefresh: () => void; onAddUser: () => void; onEditUser: (user: AppUser) => void; onAddInstitution: () => void; onEditInstitution: (institution: Institution) => void; onOpenEvaluation: (institution: Institution) => void; onDeleteAttachment: (id: string) => void; selectedRound: number }) {
  return <><UploadDateCard settings={data.uploadSettings} onSaved={onRefresh} /><section className="admin-metrics"><article><Users /><div><span>Foydalanuvchilar</span><strong>{data.users.length}</strong></div></article><article><Building2 /><div><span>Muassasalar</span><strong>{data.institutions.length}</strong></div></article><article><ClipboardCheck /><div><span>Baholash yozuvlari</span><strong>{data.evaluations.length}</strong></div></article><article><Paperclip /><div><span>Biriktirilgan fayllar</span><strong>{data.attachments.length}</strong></div></article></section><section className="workspace-panel"><Tabs defaultValue="users"><div className="workspace-toolbar"><TabsList variant="line" className="workspace-tabs"><TabsTrigger value="users" title="Foydalanuvchilar"><UserCog /> Foydalanuvchilar</TabsTrigger><TabsTrigger value="institutions" title="Muassasalar"><Hospital /> Muassasalar</TabsTrigger><TabsTrigger value="orders" title="Yuklangan BUYRUQLAR"><Paperclip /> Buyruqlar</TabsTrigger><TabsTrigger value="files" title="Yuklangan fayllar">📂 Fayllar</TabsTrigger><TabsTrigger value="evaluations" title="Baholar va asoslar"><ClipboardCheck /> Baholar</TabsTrigger><TabsTrigger value="system" title="Tizim nazorati">🛠 Tizim</TabsTrigger></TabsList><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw /> Yangilash</Button></div><TabsContent value="users" className="panel-content"><div className="table-actionbar"><p>Har bir hisobning roli, yo‘nalishi va kirish holatini boshqarish</p><Button size="sm" onClick={onAddUser}><Plus /> Foydalanuvchi qo‘shish</Button></div><Table><TableHeader><TableRow><TableHead>Foydalanuvchi</TableHead><TableHead>Rol (biriktirilgan bo‘lim)</TableHead><TableHead>Holat</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.users.map((user) => <TableRow key={user.email}><TableCell className="institution-cell"><strong>{user.name || user.email}</strong><span>{user.email}</span></TableCell><TableCell className="wrap-cell">{accountRoleLabel(user)}</TableCell><TableCell><span className={`status-pill ${user.active ? "status-excellent" : "status-critical"}`}>{user.active ? "Faol" : "Bloklangan"}</span></TableCell><TableCell className="action-col"><Button variant="ghost" size="sm" onClick={() => onEditUser(user)}><Edit3 /> Tahrirlash</Button></TableCell></TableRow>)}</TableBody></Table></TabsContent><AdminDashboardOverview />
<TabsContent value="institutions" className="panel-content"><AdminInstitutionApplicability />
<AdminInstitutionManager onChanged={onRefresh} />
<AdminMonthEditor onChanged={onRefresh} /><div className="table-actionbar"><p>Muassasalar ro‘yxati va keyingi qo‘shimchalarni boshqarish</p><Button size="sm" onClick={onAddInstitution}><Plus /> Muassasa qo‘shish</Button></div><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Muassasa</TableHead><TableHead>Hudud</TableHead><TableHead>Tur</TableHead><TableHead>Holat</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.institutions.map((institution, index) => <TableRow key={institution.id}><TableCell>{index + 1}</TableCell><TableCell className="institution-cell"><strong>{institution.name}</strong></TableCell><TableCell>{institution.district}</TableCell><TableCell>{institution.type}</TableCell><TableCell><span className={`status-pill ${institution.active ? "status-excellent" : "status-critical"}`}>{institution.active ? "Faol" : "Nofaol"}</span></TableCell><TableCell className="action-col"><Button variant="ghost" size="sm" onClick={() => onEditInstitution(institution)}><Edit3 /> Tahrirlash</Button></TableCell></TableRow>)}</TableBody></Table></TabsContent><TabsContent value="orders" className="panel-content"><Table><TableHeader><TableRow><TableHead>Muassasa</TableHead><TableHead>Mas’ul F.I.Sh.</TableHead><TableHead>Telefon</TableHead><TableHead>Sana</TableHead><TableHead>Fayl</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.attachments.filter((item) => item.source === "institution_order").map((order) => { const institution = data.institutions.find((item) => item.id === order.institutionId); return <TableRow key={order.id}><TableCell className="institution-cell"><strong>{institution?.name || order.institutionId}</strong></TableCell><TableCell>{order.responsibleName || "—"}</TableCell><TableCell>{order.responsiblePhone || "—"}</TableCell><TableCell>{order.submissionDate || "—"}</TableCell><TableCell className="wrap-cell">{order.filename}</TableCell><TableCell className="action-col"><a href={`/api/files?id=${order.id}`} target="_blank" rel="noreferrer"><Eye /> Ochish / yuklab olish</a><Button variant="ghost" size="sm" onClick={() => void onDeleteAttachment(order.id)}><Trash2 /> O‘chirish</Button></TableCell></TableRow>; })}</TableBody></Table></TabsContent><TabsContent value="files" className="panel-content"><AdminFileArchive /></TabsContent><TabsContent value="evaluations" className="panel-content"><Table><TableHeader><TableRow><TableHead>Muassasa</TableHead><TableHead>Mezon</TableHead><TableHead>Ball</TableHead><TableHead>Baholovchi</TableHead><TableHead>Izoh</TableHead><TableHead>Fayl</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.evaluations.filter((item) => item.roundDay === selectedRound).map((evaluation) => { const institution = data.institutions.find((item) => item.id === evaluation.institutionId); const criterion = criteria.find((item) => item.id === evaluation.criterionId); const fileCount = data.attachments.filter((item) => item.institutionId === evaluation.institutionId && (item.roundDay === evaluation.roundDay || item.source === "institution") && item.criterionId === evaluation.criterionId).length; return <TableRow key={`${evaluation.institutionId}:${evaluation.roundDay}:${evaluation.criterionId}`}><TableCell className="institution-cell"><strong>{institution?.name || evaluation.institutionId}</strong></TableCell><TableCell className="wrap-cell">{criterion?.title || evaluation.criterionId}</TableCell><TableCell><span className={`score-dot score-${evaluation.score}`}>{evaluation.score}</span></TableCell><TableCell className="wrap-cell">{evaluation.evaluatorName || evaluation.evaluatorEmail || "—"}</TableCell><TableCell className="note-preview">{evaluation.note}</TableCell><TableCell><span className="file-count"><Paperclip /> {fileCount}</span></TableCell><TableCell className="action-col">{institution && <Button variant="ghost" size="sm" onClick={() => onOpenEvaluation(institution)}><Eye /> Ochish</Button>}</TableCell></TableRow>; })}</TableBody></Table></TabsContent><TabsContent value="system" className="panel-content"><AdminSystemControl /></TabsContent></Tabs></section></>;
}

function CommissionCards() {
  return <section className="commission-grid">{commissions.map((commission) => { const Icon = iconByCommission[commission.id]; return <article key={commission.id} className="commission-card" style={{ "--commission": commission.color } as React.CSSProperties}><div className="commission-topline"><span>{commission.code}</span><Icon /></div><h3>{commission.title}</h3><div className="commission-foot"><span>{criteria.filter((item) => item.commission === commission.id).length} ta mezon</span><strong>{getCommissionMaxScore(commission.id)} ball</strong></div></article>; })}</section>;
}

function RankingTable({ ranking, onOpen, actionLabel }: { ranking: Array<{ institution: Institution; parts: Record<CommissionKey, number>; total: number; hasEvaluation: boolean; applicableCount: number; excludedDirections: CommissionKey[] }>; onOpen: (institution: Institution) => void; actionLabel: string }) {
  return <Table><TableHeader><TableRow><TableHead className="rank-col">#</TableHead><TableHead>Muassasa</TableHead>{commissions.map((commission) => <TableHead key={commission.id} className="score-col">{commission.short}</TableHead>)}<TableHead className="total-col">Jami</TableHead><TableHead>Holat</TableHead><TableHead /></TableRow></TableHeader><TableBody>{ranking.map((row, index) => { const status = scoreStatus(row.total, row.hasEvaluation); return <TableRow key={row.institution.id}><TableCell className="rank-col"><span className="rank-number">{index + 1}</span></TableCell><TableCell className="institution-cell"><strong>{row.institution.name}</strong><span>{row.institution.district} · {row.institution.type} · {row.applicableCount} mezon</span></TableCell>{commissions.map((commission) => <TableCell key={commission.id} className="score-col">{row.excludedDirections.includes(commission.id) ? <strong>N/A</strong> : <><strong>{row.parts[commission.id]}</strong><span>/{getCommissionMaxScore(commission.id)}</span></>}</TableCell>)}<TableCell className="total-col"><strong>{row.total}</strong><span>/100</span></TableCell><TableCell><span className={`status-pill ${status.className}`}>{status.label}</span></TableCell><TableCell className="action-col"><Button variant="ghost" size="sm" onClick={() => onOpen(row.institution)}>{actionLabel} <ChevronRight /></Button></TableCell></TableRow>; })}</TableBody></Table>;
}

function EvaluationSection({ commissionId, scores, notes, files, data, institution, roundDay, readOnly, onScore, onNote, onFile, onDeleteAttachment }: { commissionId: CommissionKey; scores: Record<string, number>; notes: Record<string, string>; files: Record<string, File | null>; data: DashboardData; institution: Institution | null; roundDay: number; readOnly: boolean; onScore: (criterionId: string, score: number) => void; onNote: (criterionId: string, note: string) => void; onFile: (criterionId: string, file: File | null) => void; onDeleteAttachment: (id: string) => void }) {
  const commission = commissions.find((item) => item.id === commissionId)!;
  const items = criteria.filter((item) => item.commission === commissionId);
  const filled = items.filter((criterion) => Object.prototype.hasOwnProperty.call(scores, criterion.id) || Boolean(notes[criterion.id]?.trim()) || data.evaluations.some((item) => item.institutionId === institution?.id && item.roundDay === roundDay && item.criterionId === criterion.id)).length;
  const directionScore = getCommissionDraftScore(commissionId, scores);

  return <TabsContent value={commissionId} className="evaluation-content evidence-content">
    <div className="evaluation-section-title" style={{ "--commission": commission.color } as React.CSSProperties}>
      <span>{commission.title.toUpperCase()} · {items.length} TA MEZON · {getCommissionMaxScore(commissionId)} BALL</span>
      <h3>{commission.title}</h3>
      <p>To‘ldirilgani: {filled}/{items.length} · Yo‘nalish natijasi: {directionScore}/{getCommissionMaxScore(commissionId)}</p>
    </div>
    <div className="evaluation-list evidence-list">
      {items.map((criterion, index) => {
        const evaluation = data.evaluations.find((item) => item.institutionId === institution?.id && item.roundDay === roundDay && item.criterionId === criterion.id);
        const attachments = data.attachments.filter((item) => item.institutionId === institution?.id && (item.roundDay === roundDay || item.source === "institution") && item.criterionId === criterion.id);
        const institutionFiles = attachments.filter((item) => item.source === "institution");
        const evaluatorFiles = attachments.filter((item) => item.source !== "institution");
        return <article key={criterion.id}>
          <div className="evaluation-copy"><span>{index + 1}</span><div>
            <h4>{criterion.title}</h4>
            <p>{criterion.detail}</p>
            <p><Clock3 /> {criterion.deadline} · {criterion.source}</p>
            {evaluation && <small>Baholovchi: {evaluation.evaluatorName || evaluation.evaluatorEmail || "—"} · {new Date(evaluation.updatedAt).toLocaleString("uz-UZ")}</small>}
            <div className={`institution-files-panel ${institutionFiles.length ? "has-files" : "empty"}`}>
              <div className="institution-files-title"><FileCheck2 /><strong>MUASSASA YUKLAGAN FAYLLAR</strong><span>{institutionFiles.length} ta</span></div>
              {institutionFiles.length ? <div className="institution-files-list">{institutionFiles.map((attachment) => <a key={attachment.id} href={`/api/files?id=${encodeURIComponent(attachment.id)}`} className="institution-file-card"><Paperclip /><div><strong>{attachment.filename}</strong><small>{formatBytes(attachment.sizeBytes)} · {attachment.submissionDate || "sana ko‘rsatilmagan"}</small><em>Mas’ul: {attachment.responsibleName || "—"} · {attachment.responsiblePhone || "—"}</em></div><span>Ochish</span></a>)}</div> : <p>Ushbu mezonga muassasa hali fayl yuklamagan.</p>}
            </div>
          </div></div>
          <div className="criterion-evidence">
            <div className="score-buttons" role="radiogroup" aria-label={`${criterion.title} bahosi`}>{scoreLabels.map((score) => <button type="button" role="radio" disabled={readOnly} aria-checked={scores[criterion.id] === score.value} key={score.value} className={`score-choice score-choice-${score.value} ${scores[criterion.id] === score.value ? "active" : ""}`} onClick={() => onScore(criterion.id, score.value)}><strong>{score.value}</strong><span>{score.label}</span><small>{(score.value / 2 * getCommissionMaxScore(commissionId) / Math.max(1, items.length)).toFixed(3)} KPI ball</small>{scores[criterion.id] === score.value && <Check />}</button>)}</div>
            <label className="criterion-note">Izoh (ixtiyoriy)<Textarea value={notes[criterion.id] ?? ""} readOnly={readOnly} onChange={(event) => onNote(criterion.id, event.target.value)} placeholder="Kerak bo‘lsa izoh yozing..." /></label>
            <div className="attachment-row"><div className="saved-files">{evaluatorFiles.map((attachment) => <span key={attachment.id}><Paperclip /><a href={`/api/files?id=${encodeURIComponent(attachment.id)}`}>{attachment.filename}</a><small>{formatBytes(attachment.sizeBytes)}</small>{!readOnly && (data.session?.role === "admin" || attachment.uploadedBy === data.session?.email) && <button type="button" onClick={() => void onDeleteAttachment(attachment.id)} title="Faylni o‘chirish"><Trash2 /></button>}</span>)}</div>{!readOnly && <label className="file-picker"><FileUp /><span>{files[criterion.id]?.name || "Asoslovchi fayl tanlash"}</span><small>30 MB gacha</small><Input type="file" onChange={(event) => onFile(criterion.id, event.target.files?.[0] ?? null)} /></label>}</div>
          </div>
        </article>;
      })}
    </div>
  </TabsContent>;
}

