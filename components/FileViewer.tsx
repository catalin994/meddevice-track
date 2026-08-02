
import React, { useEffect, useMemo, useState } from 'react';
import { X, Download, FileText, ArrowLeft, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import Portal from './Portal';
const PdfCanvasViewer = React.lazy(() => import('./PdfCanvasViewer'));
import { DeviceFile } from '../types';

interface FileViewerProps {
  file: DeviceFile;
  onClose: () => void;
  onDownload: (file: DeviceFile) => void;
}

// Turns a data: URL into a blob: URL. Browsers refuse to render data: URLs
// inside an <iframe>, and very long ones are slow — a blob URL avoids both.
const toBlobUrl = (dataUrl: string): string | null => {
  try {
    if (!dataUrl.startsWith('data:')) return dataUrl;
    const [meta, b64] = dataUrl.split(',');
    const mime = meta.match(/data:(.*?);/)?.[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
};

const FileViewer: React.FC<FileViewerProps> = ({ file, onClose, onDownload }) => {
  const [failed, setFailed] = useState(false);

  const mime = useMemo(() => {
    if (file.url.startsWith('data:')) return file.url.match(/data:(.*?);/)?.[1] || '';
    if (/\.pdf$/i.test(file.name)) return 'application/pdf';
    if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)) return 'image/*';
    return '';
  }, [file]);

  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';

  // The URL must be created *inside* the effect that revokes it: React 18 dev
  // mounts twice, and a memoised URL would be revoked by the first unmount and
  // never recreated, leaving the preview blank.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = toBlobUrl(file.url);
    setBlobUrl(url);
    setFailed(false);
    return () => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [file.url]);

  // Raw bytes for the canvas PDF renderer
  const pdfData = useMemo(() => {
    if (!isPdf || !file.url.startsWith('data:')) return null;
    try {
      const b64 = file.url.split(',')[1];
      return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    } catch {
      return null;
    }
  }, [isPdf, file.url]);

  // Escape closes the viewer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // PDFs are rasterised by pdf.js (works identically on every browser), images
  // render directly. Anything else falls back to the download card.
  const canPreview = !failed && ((isImage && !!blobUrl) || (isPdf && !!pdfData));

  return (
    <Portal>
      <div className="theme-static fixed inset-0 z-[700] bg-slate-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-slate-950 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition active:scale-95 shrink-0"
            title="Inapoi la aplicatie"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-[11px] font-black uppercase tracking-widest">Inapoi</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-white text-xs sm:text-sm font-black truncate">{file.name}</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{file.dateAdded}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onDownload(file)}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition active:scale-95"
              title="Descarca fisierul"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline text-[11px] font-black uppercase tracking-widest">Descarca</span>
            </button>
            <button
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition active:scale-95"
              title="Inchide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-800 flex items-center justify-center p-2 sm:p-4">
          {canPreview ? (
            isImage ? (
              <img src={blobUrl!} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onError={() => setFailed(true)} />
            ) : (
              <React.Suspense fallback={<Loader2 className="w-8 h-8 text-white animate-spin" />}>
                <PdfCanvasViewer data={pdfData!} onFail={() => setFailed(true)} />
              </React.Suspense>
            )
          ) : (
            <div className="flex flex-col items-center gap-5 text-center p-8">
              <div className="p-6 bg-white/5 rounded-3xl">
                {failed ? <AlertCircle className="w-14 h-14 text-amber-400" /> : <FileText className="w-14 h-14 text-white/40" />}
              </div>
              <div className="space-y-1">
                <p className="text-white font-black text-sm uppercase tracking-widest">
                  {failed ? 'Previzualizare indisponibila' : 'Acest tip de fisier nu poate fi afisat'}
                </p>
                <p className="text-white/50 text-xs max-w-xs">Descarca fisierul pentru a-l deschide cu o aplicatie de pe dispozitivul tau.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => onDownload(file)} className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition active:scale-95">
                  <Download className="w-5 h-5" /> Descarca
                </button>
                {blobUrl && (
                  <a href={blobUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition active:scale-95">
                    <ExternalLink className="w-5 h-5" /> Deschide in tab nou
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default FileViewer;
