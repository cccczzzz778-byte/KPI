"use client";

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
            <h2>Amaldagi baholovchi ballari</h2>
            <p>Qo‘yilgan ball va baholovchi izohi keyingi baholash o‘zgartirilguniga qadar saqlanadi.</p>
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
        <span><CheckCircle2 size={16} /> Amaldagi baholar: <strong>{items.length} ta mezon</strong></span>
        <span><MessageSquareText size={16} /> Izoh yozilgan: <strong>{feedbackCount} ta</strong></span>
      </div>

      {error ? <div className="institution-daily-feedback__error">{error}</div> : null}

      {loading ? (
        <div className="institution-daily-feedback__state">Bugungi baholashlar yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <div className="institution-daily-feedback__state">Hali baholovchi tomonidan ball yoki fikr yuborilmagan.</div>
      ) : (
        <div className="institution-daily-feedback__list">
          {items.map((item) => (
            <article className="institution-daily-feedback__row" key={item.criterionId}>
              <div className={"institution-daily-feedback__score score-" + Math.max(0, Math.min(2, Number(item.score)))}>
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
