
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertCircle, Maximize2, MoveHorizontal } from 'lucide-react';

interface PdfCanvasViewerProps {
  data: ArrayBuffer;
  onFail: () => void;
}

/**
 * Renders a PDF with pdf.js straight onto a canvas.
 *
 * Browsers vary wildly in whether they show a PDF inside an <iframe> — most
 * mobile browsers simply don't — so we rasterise the pages ourselves and get
 * identical behaviour everywhere.
 */
const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ data, onFail }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);
  // 'page' shows the whole sheet at once — what someone expects when they tap a
  // document. Fitting to width alone made an A4 page taller than a phone
  // screen, so the first thing anyone saw was the top third of it.
  const [fitMode, setFitMode] = useState<'page' | 'width'>('page');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Load the document once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
        // pdf.js takes ownership of the buffer, so hand it a copy
        const pdf = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setPageNum(1);
      } catch {
        if (!cancelled) { setError(true); onFail(); }
      }
    })();
    return () => { cancelled = true; };
  }, [data, onFail]);

  // Render the current page, fitted to the container width
  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container) return;

    setIsLoading(true);
    try {
      renderTaskRef.current?.cancel();
      const page = await pdf.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const availableW = container.clientWidth - 16;
      const availableH = container.clientHeight - 16;
      const scaleW = availableW > 0 ? availableW / unscaled.width : 1;
      const scaleH = availableH > 0 ? availableH / unscaled.height : 1;
      const fitScale = fitMode === 'page' ? Math.min(scaleW, scaleH) : scaleW;
      // Cap the device pixel ratio so very large pages don't exhaust memory
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: fitScale * zoom * dpr });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [pageNum, zoom, fitMode]);

  useEffect(() => { if (numPages > 0) renderPage(); }, [numPages, renderPage]);

  const toggleFit = useCallback(() => {
    setFitMode(m => (m === 'page' ? 'width' : 'page'));
    setZoom(1);
  }, []);

  // Re-fit on resize / orientation change
  useEffect(() => {
    const onResize = () => { if (numPages > 0) renderPage(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [numPages, renderPage]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/60 p-8">
        <AlertCircle className="w-10 h-10 text-amber-400" />
        <p className="text-sm">Documentul nu a putut fi randat.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div ref={containerRef} className="flex-1 overflow-auto flex">
        <div className="relative m-auto p-2" onDoubleClick={toggleFit}>
          <canvas ref={canvasRef} className="rounded-lg shadow-2xl bg-white" />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/60 rounded-lg">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Page + zoom controls */}
      <div className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 py-1">
        <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}
          className="p-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl transition active:scale-95" title="Pagina anterioara" aria-label="Pagina anterioara">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-white/70 text-[11px] font-black uppercase tracking-widest min-w-[80px] text-center">
          {numPages ? `${pageNum} / ${numPages}` : '—'}
        </span>
        <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}
          className="p-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl transition active:scale-95" title="Pagina urmatoare" aria-label="Pagina urmatoare">
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-white/15 mx-1" />
        <button
          onClick={toggleFit}
          className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition active:scale-95"
          title={fitMode === 'page' ? 'Potriveste pe latime' : 'Incadreaza toata pagina'}
          aria-label={fitMode === 'page' ? 'Potriveste pe latime' : 'Incadreaza toata pagina'}
        >
          {fitMode === 'page' ? <MoveHorizontal className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
        <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.5}
          className="p-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl transition active:scale-95" title="Micsoreaza" aria-label="Micsoreaza">
          <ZoomOut className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} disabled={zoom >= 4}
          className="p-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-xl transition active:scale-95" title="Mareste" aria-label="Mareste">
          <ZoomIn className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default PdfCanvasViewer;
