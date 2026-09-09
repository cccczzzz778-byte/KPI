import fs from 'node:fs';
import path from 'node:path';

function writeFile(relative, content) {
  const target = path.join(process.cwd(), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  console.log(`PATCH33: created ${relative}`);
}

function patchFile(relative, patcher) {
  const target = path.join(process.cwd(), relative);
  if (!fs.existsSync(target)) throw new Error(`PATCH33: ${relative} not found`);
  const original = fs.readFileSync(target, 'utf8');
  const updated = patcher(original);
  if (updated === original) throw new Error(`PATCH33: no changes applied to ${relative}`);
  fs.writeFileSync(target, updated, 'utf8');
  console.log(`PATCH33: patched ${relative}`);
}

const route = String.raw`import { criteria } from "@/lib/kpi-data";
import { getKpiDatabase } from "@/lib/netlify-db";
import { AccessError, accessErrorResponse, requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

function requireInstitution(session: Awaited<ReturnType<typeof requireAppUser>>) {
  if (session.role !== "institution" || !session.institutionId) {
    throw new AccessError("Bu bo‘lim faqat muassasa kabineti uchun.", 403);
  }
}

function criterionTitle(criterionId: unknown) {
  const id = String(criterionId || "");
  return criteria.find((item) => String(item.id) === id)?.label || id || "Mezon ko‘rsatilmagan";
}

export async function GET(request: Request) {
  try {
    const session = await requireAppUser(request);
    requireInstitution(session);

    const db = getKpiDatabase();
    const result = await db.pool.query(
      ` + "`" + `SELECT criterion_id AS "criterionId",
              score,
              note,
              evaluator_name AS "evaluatorName",
              TO_CHAR(evaluation_date, 'YYYY-MM-DD') AS "evaluationDate",
              updated_at AS "updatedAt"
         FROM daily_evaluations
        WHERE institution_id = $1
          AND evaluation_date = (NOW() AT TIME ZONE 'Asia/Tashkent')::date
        ORDER BY updated_at DESC` + "`" + `,
      [session.institutionId],
    );

    const items = result.rows.map((row) => ({
      ...row,
      score: Number(row.score || 0),
      note: String(row.note || ""),
      evaluatorName: String(row.evaluatorName || ""),
      criterionTitle: criterionTitle(row.criterionId),
    }));

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return Response.json({ today, items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
`;

const component = String.raw`"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageSquareText, RefreshCw } from "lucide-react";

type FeedbackItem = {
  criterionId: string;
  criterionTitle: string;
  score: number;
  note: string;
  evaluatorName: string;
  evaluationDate: string;
  updatedAt: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function InstitutionDailyFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/institution/feedback", { cache: "no-store" });
      const payload = await response.json() as { today?: string; items?: FeedbackItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Baholovchi fikrlarini yuklab bo‘lmadi.");
      setToday(payload.today || "");
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Baholovchi fikrlarini yuklashda xatolik yuz berdi.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30000);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const feedbackCount = useMemo(() => items.filter((item) => item.note.trim()).length, [items]);

  return (
    <section className="institution-daily-feedback">
      <div className="institution-daily-feedback__head">
        <div className="institution-daily-feedback__title">
          <div className="institution-daily-feedback__icon"><MessageSquareText size={23} /></div>
          <div>
            <h2>Bugungi baholovchi fikrlari</h2>
            <p>Bu bo‘lim faqat bugungi baholar va baholovchi yozgan izohlarni ko‘rsatadi. Kun almashganda yangi kun uchun qaytadan boshlanadi.</p>
          </div>
        </div>
        <div className="institution-daily-feedback__tools">
          <span className="institution-daily-feedback__date">{today || "Bugun"}</span>
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Yangilash
          </button>
        </div>
      </div>

      <div className="institution-daily-feedback__summary">
        <span><CheckCircle2 size={16} /> Bugun baholangan: <strong>{items.length} ta mezon</strong></span>
        <span><MessageSquareText size={16} /> Izoh yozilgan: <strong>{feedbackCount} ta</strong></span>
      </div>

      {error ? <div className="institution-daily-feedback__error">{error}</div> : null}

      {loading ? (
        <div className="institution-daily-feedback__state">Bugungi baholashlar yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <div className="institution-daily-feedback__state">Bugun hali baholovchi tomonidan ball yoki fikr yuborilmagan.</div>
      ) : (
        <div className="institution-daily-feedback__list">
          {items.map((item) => (
            <article className="institution-daily-feedback__row" key={item.criterionId}>
              <div className={`institution-daily-feedback__score score-${Math.max(0, Math.min(2, Number(item.score)))}`}>
                <strong>{item.score}</strong><small>ball</small>
              </div>
              <div className="institution-daily-feedback__content">
                <strong className="institution-daily-feedback__criterion">{item.criterionTitle}</strong>
                <div className={item.note.trim() ? "institution-daily-feedback__note" : "institution-daily-feedback__note is-empty"}>
                  {item.note.trim() || "Baholovchi izoh yozmagan."}
                </div>
                <div className="institution-daily-feedback__meta">
                  {item.evaluatorName ? <span>Baholovchi: {item.evaluatorName}</span> : null}
                  {item.updatedAt ? <span>Vaqt: {formatTime(item.updatedAt)}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
`;

writeFile('app/api/institution/feedback/route.ts', route);
writeFile('components/institution-daily-feedback.tsx', component);

patchFile('components/institution-portal.tsx', (source) => {
  let updated = source;
  const importLine = 'import { InstitutionDailyFeedback } from "@/components/institution-daily-feedback";';
  if (!updated.includes('InstitutionDailyFeedback')) {
    if (updated.includes('"use client";')) updated = updated.replace('"use client";', '"use client";\n\n' + importLine);
    else if (updated.includes("'use client';")) updated = updated.replace("'use client';", "'use client';\n\n" + importLine);
    else throw new Error('PATCH33: institution portal use-client anchor not found');
  }

  if (!updated.includes('<InstitutionDailyFeedback />')) {
    const anchor = '<InstitutionSubmissionManager />';
    if (!updated.includes(anchor)) throw new Error('PATCH33: submission manager anchor not found');
    updated = updated.replace(anchor, '<InstitutionDailyFeedback />\n      ' + anchor);
  }
  return updated;
});

const cssPath = path.join(process.cwd(), 'app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* PATCH33_INSTITUTION_DAILY_FEEDBACK */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.institution-daily-feedback{width:min(1080px,calc(100% - 32px));max-width:1080px;margin:18px auto;padding:18px;border:1px solid #d9e8f2;border-radius:18px;background:#fff;box-shadow:0 8px 26px rgba(45,92,126,.07);box-sizing:border-box}\n.institution-daily-feedback__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}\n.institution-daily-feedback__title{display:flex;gap:12px;align-items:flex-start;min-width:0;flex:1 1 560px}\n.institution-daily-feedback__icon{width:44px;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:#eaf8ff;color:#137fae}\n.institution-daily-feedback h2{margin:0;color:#153c59;font-size:18px;line-height:1.25}.institution-daily-feedback p{margin:6px 0 0;color:#688196;font-size:13px;line-height:1.5}\n.institution-daily-feedback__tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.institution-daily-feedback__date{padding:8px 11px;border-radius:10px;background:#eff8fd;color:#2f6f96;font-weight:800;font-size:12px}.institution-daily-feedback__tools button{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:8px 11px;border:1px solid #cfe1ed;border-radius:10px;background:#fff;color:#176f9d;font-weight:800;cursor:pointer}.institution-daily-feedback__tools button:disabled{opacity:.55;cursor:default}\n.institution-daily-feedback .spin{animation:institutionFeedbackSpin .8s linear infinite}@keyframes institutionFeedbackSpin{to{transform:rotate(360deg)}}\n.institution-daily-feedback__summary{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.institution-daily-feedback__summary span{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#f2f9fd;color:#4e7188;font-size:12px}.institution-daily-feedback__summary strong{color:#173d59}\n.institution-daily-feedback__list{display:grid;gap:10px;margin-top:14px}.institution-daily-feedback__row{display:grid;grid-template-columns:58px minmax(0,1fr);gap:12px;padding:13px;border:1px solid #e0ebf2;border-radius:14px;background:#fbfdff}.institution-daily-feedback__score{width:56px;height:56px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#eef4f7;color:#45677d}.institution-daily-feedback__score strong{font-size:22px;line-height:1}.institution-daily-feedback__score small{margin-top:3px;font-size:10px;font-weight:800;text-transform:uppercase}.institution-daily-feedback__score.score-1{background:#fff7df;color:#956c16}.institution-daily-feedback__score.score-2{background:#eaf8ef;color:#247345}.institution-daily-feedback__score.score-0{background:#fff0f0;color:#a53a3a}\n.institution-daily-feedback__criterion{display:block;color:#173d59;font-size:13px;line-height:1.4}.institution-daily-feedback__note{margin-top:7px;padding:10px 11px;border-left:3px solid #4aa7cf;border-radius:8px;background:#f1f9fd;color:#254b64;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.institution-daily-feedback__note.is-empty{border-left-color:#c7d5de;background:#f7f9fa;color:#80909c;font-style:italic}.institution-daily-feedback__meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:7px;color:#8497a5;font-size:11px}\n.institution-daily-feedback__state,.institution-daily-feedback__error{margin-top:14px;padding:15px;border:1px dashed #ccdde8;border-radius:12px;background:#fbfdff;color:#607a8f;text-align:center}.institution-daily-feedback__error{border-style:solid;border-color:#f1c8c8;background:#fff7f7;color:#a12c2c;text-align:left}\n@media(max-width:720px){.institution-daily-feedback{width:calc(100% - 20px);padding:14px}.institution-daily-feedback__tools{width:100%}.institution-daily-feedback__tools button{margin-left:auto}.institution-daily-feedback__row{grid-template-columns:50px minmax(0,1fr);padding:11px}.institution-daily-feedback__score{width:48px;height:48px}.institution-daily-feedback__score strong{font-size:19px}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH33: institution daily feedback styling added.');
}

console.log('PATCH33: institutions can now see only today’s evaluator scores and comments; the view resets automatically each Tashkent day.');
