"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";

export type PreviewFile = {
  id: string;
  filename: string;
  contentType?: string;
  institutionName?: string;
  criterionTitle?: string;
};

function cleanFilename(value: string) {
  return String(value || "Fayl").replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

function isPdf(file: PreviewFile) {
  const type = String(file.contentType || "").toLowerCase();
  return type === "application/pdf" || /\.pdf$/i.test(file.filename);
}

function isImage(file: PreviewFile) {
  const type = String(file.contentType || "").toLowerCase();
  return type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.filename);
}

function PdfCanvas({ file }: { file: PreviewFile }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<any>(null);
  const loadingTaskRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hostWidth, setHostWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const update = () => setHostWidth(element.clientWidth || 0);
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPageNumber(1);
    setPageCount(0);
    setZoom(1);
    setRotation(0);

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({
          url: `/api/files/raw?id=${encodeURIComponent(file.id)}`,
          withCredentials: true,
          disableRange: true,
          disableStream: true,
          useSystemFonts: true,
        } as any);
        loadingTaskRef.current = task;
        const document: any = await task.promise;
        if (cancelled) {
          try { await document?.destroy?.(); } catch {}
          return;
        }
        documentRef.current = document;
        setPageCount(Number(document.numPages || 0));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "PDF faylni ochib bo‘lmadi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try { renderTaskRef.current?.cancel?.(); } catch {}
      try { loadingTaskRef.current?.destroy?.(); } catch {}
      try { documentRef.current?.destroy?.(); } catch {}
      renderTaskRef.current = null;
      loadingTaskRef.current = null;
      documentRef.current = null;
    };
  }, [file.id, reloadKey]);

  useEffect(() => {
    const document = documentRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas || !hostWidth || !pageCount) return;
    let cancelled = false;
    setRendering(true);
    setError("");

    void (async () => {
      try {
        try { renderTaskRef.current?.cancel?.(); } catch {}
        const page: any = await document.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1, rotation });
        const available = Math.max(260, hostWidth - 24);
        const fitScale = Math.max(0.35, Math.min(2.2, available / base.width));
        const viewport = page.getViewport({ scale: fitScale * zoom, rotation });
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("PDF canvas ishga tushmadi.");

        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const task = page.render({
          canvasContext: context,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        } as any);
        renderTaskRef.current = task;
        await task.promise;
      } catch (reason: any) {
        if (!cancelled && reason?.name !== "RenderingCancelledException") {
          setError(reason instanceof Error ? reason.message : "PDF sahifasini ko‘rsatib bo‘lmadi.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      try { renderTaskRef.current?.cancel?.(); } catch {}
    };
  }, [pageNumber, pageCount, zoom, rotation, hostWidth]);

  return <div className="kpi-pdf-viewer">
    <div className="kpi-pdf-toolbar">
      <div className="kpi-pdf-page-controls">
        <button type="button" disabled={pageNumber <= 1 || loading} onClick={() => setPageNumber((value) => Math.max(1, value - 1))} aria-label="Oldingi sahifa"><ChevronLeft size={18} /></button>
        <strong>{pageCount ? `${pageNumber} / ${pageCount}` : "—"}</strong>
        <button type="button" disabled={!pageCount || pageNumber >= pageCount || loading} onClick={() => setPageNumber((value) => Math.min(pageCount || 1, value + 1))} aria-label="Keyingi sahifa"><ChevronRight size={18} /></button>
      </div>
      <div className="kpi-pdf-zoom-controls">
        <button type="button" disabled={zoom <= 0.75} onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))} aria-label="Kichraytirish"><ZoomOut size={18} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, Number((value + 0.25).toFixed(2))))} aria-label="Kattalashtirish"><ZoomIn size={18} /></button>
        <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="Aylantirish"><RotateCw size={18} /></button>
      </div>
    </div>

    <div className="kpi-pdf-stage" ref={hostRef}>
      {(loading || rendering) && <div className="kpi-preview-loading"><Loader2 className="animate-spin" size={24} /><span>{loading ? "PDF yuklanmoqda..." : "Sahifa tayyorlanmoqda..."}</span></div>}
      {error && <div className="kpi-preview-error"><strong>PDF ochilmadi</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Qayta urinish</button></div>}
      <canvas ref={canvasRef} className={loading || error ? "kpi-pdf-canvas is-hidden" : "kpi-pdf-canvas"} />
    </div>
  </div>;
}

export function FilePreviewModal({ file, onClose }: { file: PreviewFile; onClose: () => void }) {
  const title = useMemo(() => cleanFilename(file.filename), [file.filename]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return <div className="kpi-file-preview-overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="kpi-file-preview-modal">
      <div className="kpi-file-preview-head">
        <div className="kpi-file-preview-title">
          <strong title={title}>{title}</strong>
          {(file.institutionName || file.criterionTitle) && <span>{[file.institutionName, file.criterionTitle].filter(Boolean).join(" · ")}</span>}
        </div>
        <button type="button" className="kpi-preview-close" onClick={onClose} aria-label="Yopish"><X size={22} /></button>
      </div>

      <div className="kpi-file-preview-body">
        {isPdf(file) ? <PdfCanvas file={file} /> : isImage(file) ? <div className="kpi-image-viewer"><img src={`/api/files/raw?id=${encodeURIComponent(file.id)}`} alt={title} /></div> : <div className="kpi-preview-error"><strong>Bu format sayt ichida ko‘rsatilmaydi</strong><span>Word, Excel, ZIP va RAR fayllarini yuklab olib ochish mumkin.</span></div>}
      </div>

      <div className="kpi-file-preview-foot">
        <span className="kpi-preview-hint">PDF va rasmlar sayt ichida ko‘rsatiladi.</span>
        <a href={`/api/files?id=${encodeURIComponent(file.id)}`}><Download size={17} /> Yuklab olish</a>
      </div>
    </div>
  </div>;
}
