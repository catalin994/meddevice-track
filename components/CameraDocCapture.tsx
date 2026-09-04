
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ScanLine, AlertCircle, CheckCircle, Loader2, RectangleVertical, RectangleHorizontal, Sparkles, Hand, RotateCcw, Check } from 'lucide-react';

import Portal from './Portal';
import useEscape from './useEscape';
import { cropVideoToFrame, cropVideoToRect, cropVideoToQuad, analyzeFrame, rectIoU, visibleSourceRect, sourceRectToDisplay, FRAME_ASPECT, Orientation, DocRect, Colturi } from './scanUtils';

interface CameraDocCaptureProps {
  title?: string;
  onCapture: (pdfDataUrl: string, pageCount: number) => Promise<void> | void;
  onClose: () => void;
}

// Lightweight multi-page camera capture — merges pages into one PDF and
// hands it back to the caller. No OCR, no device matching.
const CameraDocCapture: React.FC<CameraDocCaptureProps> = ({ title = 'Scaneaza Document', onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [cameraError, setCameraError] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  // Auto page detection
  const [autoMode, setAutoMode] = useState(true);
  // Two rectangles for the same sheet: one on the sensor (used for the crop),
  // one over the preview (used for the outline). object-cover makes them differ.
  const [detected, setDetected] = useState<DocRect | null>(null);
  const [detectedOnScreen, setDetectedOnScreen] = useState<DocRect | null>(null);
  const [holdProgress, setHoldProgress] = useState(0); // 0..1 while framing settles
  const [isBlurry, setIsBlurry] = useState(false);
  const [justCaptured, setJustCaptured] = useState(false);
  // Auto-captured page awaiting the user's keep/retake decision
  const [pendingPage, setPendingPage] = useState<string | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastRectRef = useRef<DocRect | null>(null);
  const smoothRectRef = useRef<DocRect | null>(null);
  /** Colturile ultimei detectii, pentru taierea care indreapta pagina. */
  const colturiRef = useRef<Colturi | null>(null);
  // Sharpness is compared against the best seen recently rather than a fixed
  // number: a blank sheet has little detail even when perfectly still, so an
  // absolute floor would refuse to photograph it.
  const sharpPeakRef = useRef<number>(0);
  const stableSinceRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const detectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Escape inchide scanerul, si opreste camera odata cu el
  useEscape(() => { stopCamera(); onClose(); });

  // The overlay renders through a Portal, so the <video> can mount *after*
  // getUserMedia resolves (instant when the camera is already authorised).
  // Attaching from the ref callback covers both orderings.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NotSupportedError' });
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        const name = err?.name || '';
        if (name === 'AbortError') return;
        if (!active) return;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') setCameraError('Permisiunea pentru camera a fost refuzata.');
        else if (name === 'NotFoundError') setCameraError('Nu a fost gasita nicio camera pe acest dispozitiv.');
        else if (name === 'NotReadableError') setCameraError('Camera este folosita de alta aplicatie.');
        else setCameraError(`Eroare camera: ${name || 'necunoscuta'}`);
      }
    };
    start();
    return () => { active = false; stopCamera(); };
  }, [stopCamera]);

  /**
   * Where the sheet is *now*, not where the outline says it is.
   *
   * The outline is smoothed over several readings so it doesn't jitter, which
   * means it trails the sheet by up to a couple of frames — enough, on a hand
   * that is still settling, to crop the page where it used to be. Measure once
   * more at the moment of the shot and use that, unless it disagrees so badly
   * that it must have found something else.
   */
  const rectForCapture = useCallback((): DocRect | null => {
    const video = videoRef.current;
    const held = lastRectRef.current;
    if (!video || !held || video.readyState < 2) return held;
    if (!workCanvasRef.current) workCanvasRef.current = document.createElement('canvas');
    const view = visibleSourceRect(
      video.videoWidth, video.videoHeight,
      video.clientWidth, video.clientHeight,
    );
    const a = analyzeFrame(video, workCanvasRef.current, view);
    // Colturile proaspete se tin minte odata cu dreptunghiul: taierea se face
    // pe ele, si trebuie sa fie ale aceleiasi priviri.
    if (a.rect && rectIoU(a.rect, held) > 0.6) {
      colturiRef.current = a.colturi;
      return a.rect;
    }
    return held;
  }, []);

  const grabFrame = useCallback((): string => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return '';
    // In auto mode use the detected sheet; otherwise fall back to the guide frame
    const rect = autoMode ? rectForCapture() : null;
    if (!rect) return cropVideoToFrame(video, frameRef.current, canvas);
    /*
     * Cu colturile, pagina se taie dupa ele si iese dreapta. Fara — cand masca
     * n-a dat patru colturi curate — ramane taierea dreptunghiulara de pana
     * acum, care e mai buna decat nimic.
     */
    const colturi = colturiRef.current;
    if (colturi) {
      const dreapta = cropVideoToQuad(video, colturi, canvas);
      if (dreapta) return dreapta;
    }
    return cropVideoToRect(video, rect, canvas);
  }, [autoMode, rectForCapture]);

  const resetDetection = useCallback((cooldownMs = 1500) => {
    cooldownUntilRef.current = Date.now() + cooldownMs;
    stableSinceRef.current = 0;
    colturiRef.current = null;
    lastRectRef.current = null;
    smoothRectRef.current = null;
    sharpPeakRef.current = 0;
    setHoldProgress(0);
    setIsBlurry(false);
    setDetected(null);
    setDetectedOnScreen(null);
  }, []);

  // Manual shutter — commits straight away, the press is the confirmation
  const capturePage = useCallback(() => {
    const dataUrl = grabFrame();
    if (!dataUrl) return;
    setPages(prev => [...prev, dataUrl]);
    setJustCaptured(true);
    setTimeout(() => setJustCaptured(false), 450);
    resetDetection(1800);
  }, [grabFrame, resetDetection]);

  // Auto capture — hands the shot to the review step instead of committing it
  const captureForReview = useCallback(() => {
    const dataUrl = grabFrame();
    if (!dataUrl) return;
    setPendingPage(dataUrl);
    setJustCaptured(true);
    setTimeout(() => setJustCaptured(false), 450);
    resetDetection(0);
  }, [grabFrame, resetDetection]);

  const keepPendingPage = useCallback(() => {
    if (!pendingPage) return;
    setPages(prev => [...prev, pendingPage]);
    setPendingPage(null);
    resetDetection(1500); // pause so turning the page doesn't trigger a shot
  }, [pendingPage, resetDetection]);

  const retakePendingPage = useCallback(() => {
    setPendingPage(null);
    resetDetection(700);
  }, [resetDetection]);

  // Detection loop — samples the frame a few times a second and auto-captures
  // once the same sheet has stayed put for a moment.
  useEffect(() => {
    // Detection pauses while a shot is waiting for the user's decision
    if (!autoMode || cameraError || pendingPage) {
      setDetected(null);
      setHoldProgress(0);
      return;
    }
    if (!workCanvasRef.current) workCanvasRef.current = document.createElement('canvas');
    const HOLD_MS = 800;

    detectTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      const work = workCanvasRef.current;
      if (!video || !work || video.readyState < 2) return;

      if (Date.now() < cooldownUntilRef.current) { setDetected(null); setHoldProgress(0); return; }

      // Look only where the user is looking
      const view = visibleSourceRect(
        video.videoWidth, video.videoHeight,
        video.clientWidth, video.clientHeight,
      );
      const { rect, colturi, sharpness } = analyzeFrame(video, work, view);

      if (!rect) {
        colturiRef.current = null;
        lastRectRef.current = null;
        smoothRectRef.current = null;
        stableSinceRef.current = 0;
        setDetected(null);
        setDetectedOnScreen(null);
        setHoldProgress(0);
        setIsBlurry(false);
        return;
      }

      // Smooth the outline. The raw rectangle wobbles by a pixel or two every
      // frame, which both looks nervous and keeps the stability test from ever
      // being satisfied.
      const prevSmooth = smoothRectRef.current;
      const smooth: DocRect = prevSmooth
        ? {
            x: prevSmooth.x + (rect.x - prevSmooth.x) * 0.4,
            y: prevSmooth.y + (rect.y - prevSmooth.y) * 0.4,
            w: prevSmooth.w + (rect.w - prevSmooth.w) * 0.4,
            h: prevSmooth.h + (rect.h - prevSmooth.h) * 0.4,
          }
        : rect;
      smoothRectRef.current = smooth;
      colturiRef.current = colturi;
      setDetected(smooth);
      setDetectedOnScreen(sourceRectToDisplay(
        smooth,
        video.videoWidth, video.videoHeight,
        video.clientWidth, video.clientHeight,
      ));

      // Peak decays, so moving to a genuinely less detailed page re-baselines
      // instead of blocking capture forever.
      sharpPeakRef.current = Math.max(sharpness, sharpPeakRef.current * 0.94);
      const blurry = sharpness < sharpPeakRef.current * 0.55;
      setIsBlurry(blurry);

      const prev = lastRectRef.current;
      lastRectRef.current = smooth;

      if (blurry) { stableSinceRef.current = 0; setHoldProgress(0); return; }

      if (prev && rectIoU(prev, smooth) > 0.93) {
        if (!stableSinceRef.current) stableSinceRef.current = Date.now();
        const held = Date.now() - stableSinceRef.current;
        setHoldProgress(Math.min(1, held / HOLD_MS));
        if (held >= HOLD_MS) captureForReview();
      } else {
        stableSinceRef.current = 0;
        setHoldProgress(0);
      }
    }, 180);

    return () => { if (detectTimerRef.current) clearInterval(detectTimerRef.current); };
  }, [autoMode, cameraError, pendingPage, captureForReview]);

  const finish = useCallback(async () => {
    if (pages.length === 0) return;
    setIsFinishing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      for (const dataUrl of pages) {
        const jpg = await doc.embedJpg(dataUrl);
        const page = doc.addPage([jpg.width, jpg.height]);
        page.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
      }
      const bytes = await doc.save();
      const base64 = btoa(Array.from(new Uint8Array(bytes)).map(b => String.fromCharCode(b)).join(''));
      stopCamera();
      await onCapture(`data:application/pdf;base64,${base64}`, pages.length);
      onClose();
    } catch {
      setCameraError('Generarea PDF-ului a esuat. Incearca din nou.');
      setIsFinishing(false);
    }
  }, [pages, stopCamera, onCapture, onClose]);

  return (
    <Portal>
    <div className="theme-static fixed inset-0 z-[650] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 sm:p-5 bg-black/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl"><ScanLine className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-white font-black text-sm tracking-tight">{title}</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide">Paginile se combina intr-un singur PDF</p>
          </div>
        </div>
        <button onClick={() => { stopCamera(); onClose(); }} className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-400" />
            <p className="text-white/60 text-sm text-center max-w-xs">{cameraError}</p>
            <button onClick={() => { stopCamera(); onClose(); }} className="px-8 py-3 bg-white text-black rounded-2xl font-black text-sm tracking-tight">Inchide</button>
          </div>
        ) : (
          <>
            <video ref={attachVideo} className="w-full h-full object-cover" playsInline muted />

            {/* Mode + orientation switches */}
            <div className="absolute top-3 left-0 right-0 flex flex-col items-center gap-2 px-3 z-10">
              <div className="flex gap-1.5 p-1.5 bg-black/60 backdrop-blur-sm rounded-2xl">
                <button onClick={() => setAutoMode(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition ${autoMode ? 'bg-emerald-600 text-white' : 'text-white/50 hover:text-white'}`}>
                  <Sparkles className="w-4 h-4" /> Auto
                </button>
                <button onClick={() => setAutoMode(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition ${!autoMode ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'}`}>
                  <Hand className="w-4 h-4" /> Manual
                </button>
              </div>
              {!autoMode && (
                <div className="flex gap-1.5 p-1.5 bg-black/60 backdrop-blur-sm rounded-2xl">
                  {([['portrait', 'Portret', RectangleVertical], ['landscape', 'Peisaj', RectangleHorizontal]] as [Orientation, string, any][]).map(([val, label, Icon]) => (
                    <button key={val} onClick={() => setOrientation(val)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition ${orientation === val ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'}`}>
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AUTO: live outline around the detected sheet */}
            {autoMode && (
              <div className="absolute inset-0 pointer-events-none">
                {detectedOnScreen ? (
                  <div
                    className="absolute border-4 rounded-lg transition-all duration-150 border-emerald-400"
                    style={{
                      left: `${detectedOnScreen.x * 100}%`,
                      top: `${detectedOnScreen.y * 100}%`,
                      width: `${detectedOnScreen.w * 100}%`,
                      height: `${detectedOnScreen.h * 100}%`,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                      opacity: 0.4 + holdProgress * 0.6,
                    }}
                  >
                    {holdProgress > 0 && (
                      <div className="absolute -bottom-1 left-0 h-1.5 bg-emerald-400 rounded-full transition-all duration-150" style={{ width: `${holdProgress * 100}%` }} />
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="px-5 py-3 bg-black/60 rounded-2xl">
                      <p className="text-white/70 text-xs font-bold tracking-wide uppercase">Cauta documentul...</p>
                    </div>
                  </div>
                )}
                <p className="absolute bottom-40 left-0 right-0 text-center text-white/80 text-[13px] font-bold tracking-normal px-6">
                  {detected
                    ? (isBlurry ? 'Imagine neclara — tine telefonul nemiscat'
                       : holdProgress > 0 ? 'Tine telefonul nemiscat...' : 'Document detectat')
                    : 'Aseaza documentul pe o suprafata contrastanta'}
                </p>
              </div>
            )}

            {/* MANUAL: fixed guide frame */}
            {!autoMode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  ref={frameRef}
                  className={`border-2 border-white/40 rounded-lg relative transition-all duration-300 ${orientation === 'portrait' ? 'h-[62%] max-h-[70vh]' : 'w-[88%] max-w-xl'}`}
                  style={{ aspectRatio: FRAME_ASPECT[orientation] }}
                >
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                  <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-bold tracking-wide uppercase whitespace-nowrap">
                    {pages.length === 0 ? 'Aliniaza documentul in cadru' : `Pagina ${pages.length + 1} — sau finalizeaza`}
                  </p>
                </div>
              </div>
            )}

            {/* Capture flash */}
            {justCaptured && <div className="absolute inset-0 bg-white/70 pointer-events-none animate-fade-in" />}

            {/* Review step — the auto shot waits here for a decision */}
            {pendingPage && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col z-20 animate-fade-in">
                <div className="shrink-0 px-5 pt-5 pb-3 text-center">
                  <p className="text-emerald-400 text-[10px] font-black uppercase tracking-wide">Pagina {pages.length + 1} scanata</p>
                  <p className="text-white font-black text-base tracking-tight mt-1">Pastrezi aceasta pagina?</p>
                </div>

                <div className="flex-1 min-h-0 px-5 flex items-center justify-center">
                  <img src={pendingPage} alt={`Pagina ${pages.length + 1}`} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10" />
                </div>

                <div className="shrink-0 p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={retakePendingPage}
                      className="flex items-center justify-center gap-2 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[13px] font-bold tracking-normal transition active:scale-95">
                      <RotateCcw className="w-5 h-5" /> Refa
                    </button>
                    <button onClick={keepPendingPage}
                      className="flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[13px] font-bold tracking-normal transition active:scale-95 shadow-xl shadow-emerald-600/20">
                      <Check className="w-5 h-5" /> Pastreaza
                    </button>
                  </div>
                  <p className="text-center text-white/40 text-[10px] font-bold uppercase tracking-wide">
                    Dupa confirmare poti scana pagina urmatoare
                  </p>
                </div>
              </div>
            )}

            {pages.length > 0 && (
              <div className="absolute left-3 bottom-28 flex flex-col gap-2 max-h-[50%] overflow-y-auto no-scrollbar">
                {pages.map((p, i) => (
                  <div key={i} className="relative group">
                    <img src={p} alt={`Pagina ${i + 1}`} className="w-14 h-14 object-contain bg-black/50 rounded-lg border-2 border-white/40 shadow-lg" />
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">{i + 1}</span>
                    <button onClick={() => setPages(prev => prev.filter((_, x) => x !== i))}
                      className="absolute inset-0 bg-red-600/70 rounded-lg opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-4 px-4">
              <button onClick={capturePage} disabled={isFinishing}
                className="w-20 h-20 bg-white rounded-full border-4 border-blue-500 shadow-2xl active:scale-95 transition-transform flex items-center justify-center disabled:opacity-50"
                title="Captureaza pagina" aria-label="Captureaza pagina">
                <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center relative">
                  <ScanLine className="w-7 h-7 text-white" />
                  {pages.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">{pages.length}</span>
                  )}
                </div>
              </button>
              {pages.length > 0 && (
                <button onClick={finish} disabled={isFinishing}
                  className="px-5 sm:px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[13px] font-bold tracking-normal shadow-2xl active:scale-95 transition flex items-center gap-2 disabled:opacity-60">
                  {isFinishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  {isFinishing ? 'Se salveaza...' : `Salveaza (${pages.length} pag.)`}
                </button>
              )}
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
    </Portal>
  );
};

export default CameraDocCapture;
