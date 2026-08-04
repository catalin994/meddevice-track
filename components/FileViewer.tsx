
import React, { useEffect, useMemo, useState } from 'react';
import { X, Download, FileText, ArrowLeft, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import Portal from './Portal';
const PdfCanvasViewer = React.lazy(() => import('./PdfCanvasViewer'));
import { DeviceFile } from '../types';
import { resolveSource } from '../services/fileStorage';

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);

  // Stored files come from Storage (or the local cache); legacy ones are inline.
  // Everything downstream works from one Blob, whichever way it arrived.
  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setLoading(true); setFailed(false); setLoadError(''); setBlob(null);
    setBlobUrl(null); setPdfData(null);

    (async () => {
      const source = await resolveSource(file);
      if (cancelled) return;
      if (source.error) { setLoadError(source.error); setLoading(false); return; }

      let data: Blob | null = source.blob || null;
      if (!data && source.dataUrl) {
        const url = toBlobUrl(source.dataUrl);
        if (url?.startsWith('blob:')) {
          created = url;
          setBlobUrl(url);
          data = await fetch(url).then(r => r.blob()).catch(() => null);
        }
      } else if (data) {
        // The URL has to be created inside this effect: React mounts twice in
        // development and a memoised URL would be revoked and never remade.
        created = URL.createObjectURL(data);
        setBlobUrl(created);
      }

      if (cancelled) return;
      setBlob(data);
      if (data && (data.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
        setPdfData(await data.arrayBuffer().catch(() => null));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file.path, file.url, file.name]);

  const mime = useMemo(() => {
    if (blob?.type) return blob.type;
    if (/\.pdf$/i.test(file.name)) return 'application/pdf';
    if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)) return 'image/*';
    return '';
  }, [blob, file.name]);

  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';

  // Escape closes the viewer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // PDFs are rasterised by pdf.js (works identically on every browser), images
  // render directly. Anything else falls back to the download card.
  const canPreview = !failed && !loading && ((isImage && !!blobUrl) || (isPdf && !!pdfData));

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
             aria-label="Inchide">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-800 flex items-center justify-center p-2 sm:p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-white/50 text-xs font-bold">Se descarca fisierul...</p>
            </div>
          ) : canPreview ? (
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
                  {loadError ? 'Fisierul nu a putut fi descarcat'
                    : failed ? 'Previzualizare indisponibila'
                    : 'Acest tip de fisier nu poate fi afisat'}
                </p>
                <p className="text-white/50 text-xs max-w-xs">
                  {loadError || 'Descarca fisierul pentru a-l deschide cu o aplicatie de pe dispozitivul tau.'}
                </p>
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
