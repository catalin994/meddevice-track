
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ScanLine, AlertCircle, CheckCircle, Loader2, RectangleVertical, RectangleHorizontal } from 'lucide-react';

import Portal from './Portal';
import { cropVideoToFrame, FRAME_ASPECT, Orientation } from './scanUtils';

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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
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
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
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

  const capturePage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const dataUrl = cropVideoToFrame(video, frameRef.current, canvas, 0.9);
    if (dataUrl) setPages(prev => [...prev, dataUrl]);
  }, []);

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
    <div className="fixed inset-0 z-[650] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 sm:p-5 bg-black/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl"><ScanLine className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-widest">{title}</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Paginile se combina intr-un singur PDF</p>
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
            <button onClick={() => { stopCamera(); onClose(); }} className="px-8 py-3 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest">Inchide</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

            {/* Orientation switch — the frame defines what gets saved */}
            <div className="absolute top-3 left-0 right-0 flex justify-center px-4 z-10">
              <div className="flex gap-1.5 p-1.5 bg-black/60 backdrop-blur-sm rounded-2xl">
                {([['portrait', 'Portret', RectangleVertical], ['landscape', 'Peisaj', RectangleHorizontal]] as [Orientation, string, any][]).map(([val, label, Icon]) => (
                  <button key={val} onClick={() => setOrientation(val)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${orientation === val ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'}`}>
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

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
                <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-bold tracking-widest uppercase whitespace-nowrap">
                  {pages.length === 0 ? 'Aliniaza documentul in cadru' : `Pagina ${pages.length + 1} — sau finalizeaza`}
                </p>
              </div>
            </div>

            {pages.length > 0 && (
              <div className="absolute left-3 bottom-28 flex flex-col gap-2 max-h-[50%] overflow-y-auto no-scrollbar">
                {pages.map((p, i) => (
                  <div key={i} className="relative group">
                    <img src={p} alt={`Pagina ${i + 1}`} className="w-14 h-14 object-contain bg-black/50 rounded-lg border-2 border-white/40 shadow-lg" />
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[9px] font-black rounded-full flex items-center justify-center">{i + 1}</span>
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
                title="Captureaza pagina">
                <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center relative">
                  <ScanLine className="w-7 h-7 text-white" />
                  {pages.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">{pages.length}</span>
                  )}
                </div>
              </button>
              {pages.length > 0 && (
                <button onClick={finish} disabled={isFinishing}
                  className="px-5 sm:px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl active:scale-95 transition flex items-center gap-2 disabled:opacity-60">
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
