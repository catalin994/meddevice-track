
import React, { useEffect, useRef, useState, useCallback } from 'react';
import useEscape from './useEscape';
import { X, QrCode, Camera, AlertCircle, CheckCircle } from 'lucide-react';

interface QRScannerProps {
  onScan: (deviceId: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'found' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  // Stop camera cleanly
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // Escape inchide scanerul, si opreste camera odata cu el
  useEscape(() => { stopCamera(); onClose(); });

  useEffect(() => {
    let active = true;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error(), { name: 'NotSupportedError' });
        }
        // Try back camera first (mobile), fall back to any camera
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('scanning');
        }
      } catch (err: any) {
        if (active) {
          const name = err?.name || '';
          // AbortError = play() interrupted by a re-render — camera is fine, ignore
          if (name === 'AbortError') return;
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setErrorMsg('Permisiunea pentru camera a fost refuzata. Apasa pe pictograma camerei din bara de adrese a browserului, seteaza Permite, apoi incearca din nou.');
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setErrorMsg('Nu a fost gasita nicio camera pe acest dispozitiv.');
          } else if (name === 'NotReadableError' || name === 'TrackStartError') {
            setErrorMsg('Camera este folosita de alta aplicatie. Inchide celelalte aplicatii care folosesc camera si incearca din nou.');
          } else if (name === 'NotSupportedError') {
            setErrorMsg('Browserul tau nu suporta accesul la camera. Foloseste Chrome sau Safari si asigura-te ca pagina este pe HTTPS sau localhost.');
          } else {
            setErrorMsg(`Eroare camera (${name || err?.message || 'necunoscuta'}). Asigura-te ca permisiunea pentru camera este activata si ca pagina este pe HTTPS sau localhost.`);
          }
          setStatus('error');
        }
      }
    };

    start();
    return () => { active = false; stopCamera(); };
  }, [stopCamera]);

  // Scan loop — runs after camera is ready
  useEffect(() => {
    if (status !== 'scanning') return;
    let active = true;

    const runScan = async () => {
      const jsQR = (await import('jsqr')).default;

      const tick = () => {
        if (!active) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
          animFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });

        if (code?.data) {
          const raw = code.data.trim();
          let id: string | null = null;

          try {
            // Normal case: a Biomedic deep link
            const url = new URL(raw);
            id = url.searchParams.get('id');
          } catch {
            // Not a URL — fall through to the plain-value forms below
          }

          // Also accept a bare id / serial, or an "id=..." fragment, so labels
          // printed by other tools (or older app versions) still work.
          if (!id) {
            const match = raw.match(/(?:^|[?&])id=([^&\s]+)/i);
            if (match) id = decodeURIComponent(match[1]);
            else if (/^[A-Za-z0-9_\-]{3,64}$/.test(raw)) id = raw;
          }

          if (id) {
            setStatus('found');
            stopCamera();
            setTimeout(() => onScan(id!), 600);
            return;
          }
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };

      animFrameRef.current = requestAnimationFrame(tick);
    };

    runScan();
    return () => { active = false; cancelAnimationFrame(animFrameRef.current); };
  }, [status, onScan, stopCamera]);

  return (
    <div className="theme-static fixed inset-0 z-[600] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-5 bg-black/70 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-xl">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Scaneaza QR Dispozitiv</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Scanare Biomedic</p>
          </div>
        </div>
        <button onClick={() => { stopCamera(); onClose(); }} className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera / State area */}
      <div className="flex-1 relative overflow-hidden">
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full text-white space-y-6 p-8">
            <div className="p-6 bg-red-500/10 rounded-full">
              <AlertCircle className="w-16 h-16 text-red-400" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-black text-lg uppercase tracking-tight">Camera Indisponibila</p>
              <p className="text-white/60 text-sm font-medium max-w-xs leading-relaxed">{errorMsg}</p>
            </div>
            <button onClick={() => { stopCamera(); onClose(); }} className="px-8 py-3 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest">
              Inchide
            </button>
          </div>
        )}

        {status === 'starting' && (
          <div className="flex flex-col items-center justify-center h-full text-white space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Se porneste camera...</p>
          </div>
        )}

        {status === 'found' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 space-y-4">
            <div className="p-6 bg-emerald-500/20 rounded-full animate-pulse">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <p className="text-white font-black text-xl uppercase tracking-tight">Dispozitiv Gasit!</p>
            <p className="text-white/60 text-sm font-bold">Se deschide pagina...</p>
          </div>
        )}

        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning frame overlay */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Dark overlay with cutout effect */}
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative w-72 h-72 z-10">
              {/* Transparent scan area */}
              <div className="absolute inset-0 bg-transparent" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />
              {/* Animated scan line */}
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-line" />
            </div>
            <p className="relative z-10 mt-8 text-white/80 text-sm font-bold tracking-widest uppercase">
              Indreapta camera spre codul QR
            </p>
            <div className="relative z-10 mt-3 flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm">
              <Camera className="w-4 h-4 text-white/60" />
              <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Se scaneaza...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
