
import React, { useRef, useState, Suspense } from 'react';
import { X, Printer, QrCode, Loader2 } from 'lucide-react';
import { MedicalDevice } from '../types';

import Portal from './Portal';
const QRCodeCanvas = React.lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeCanvas })));

interface QRLabelSheetProps {
  devices: MedicalDevice[];
  onClose: () => void;
}

import { getDeviceUrl } from '../services/appUrl';

const deviceUrl = (id: string) => getDeviceUrl(id);

// Rendering thousands of QR canvases at once would freeze the page —
// cap one sheet and let the user filter the inventory into batches.
const MAX_LABELS = 150;

const QRLabelSheet: React.FC<QRLabelSheetProps> = ({ devices: allDevices, onClose }) => {
  const devices = allDevices.slice(0, MAX_LABELS);
  const truncated = allDevices.length - devices.length;
  const gridRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    if (!gridRef.current) return;
    setIsPrinting(true);

    // Collect rendered QR canvases as images and build a clean printable page
    const canvases = gridRef.current.querySelectorAll('canvas');
    const labels = devices.map((d, i) => {
      const canvas = canvases[i] as HTMLCanvasElement | undefined;
      const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
      return `
        <div class="label">
          <img src="${dataUrl}" alt="QR" />
          <p class="name">${escapeHtml(d.name)}</p>
          <p class="sn">SN: ${escapeHtml(d.serialNumber)}</p>
          <p class="dept">${escapeHtml(d.department)}</p>
        </div>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) { setIsPrinting(false); alert('Browserul a blocat fereastra de printare. Permite pop-up-urile si incearca din nou.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Etichete QR Biomedic</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; padding: 8mm; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
        .label { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 5mm 3mm; text-align: center; page-break-inside: avoid; }
        .label img { width: 30mm; height: 30mm; }
        .name { font-size: 9pt; font-weight: 800; margin-top: 2mm; word-break: break-word; }
        .sn { font-size: 8pt; font-family: monospace; color: #334155; margin-top: 1mm; }
        .dept { font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.5mm; }
        @media print { body { padding: 0; } }
      </style></head><body><div class="grid">${labels}</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); setIsPrinting(false); }, 500);
  };

  return (
    <Portal>
    <div className="theme-static fixed inset-0 z-[650] scrim flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl modal-shell overflow-hidden flex flex-col animate-slide-up">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 text-white rounded-2xl"><QrCode className="w-6 h-6" /></div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Etichete QR</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">
                {devices.length} dispozitive · gata de printat si lipit pe echipamente
                {truncated > 0 && <span className="text-amber-500"> · inca {truncated} nefiltrate — filtreaza inventarul pe transe</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handlePrint} disabled={isPrinting || devices.length === 0}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-xl shadow-blue-600/20 active:scale-95 flex items-center gap-2 disabled:opacity-50">
              {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Printeaza
            </button>
            <button onClick={onClose} className="p-3 bg-white text-slate-400 rounded-xl hover:text-slate-900 transition shadow-sm border border-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {devices.length === 0 ? (
            <p className="py-16 text-center text-xs font-bold text-slate-300 uppercase tracking-widest">Niciun dispozitiv de afisat — ajusteaza filtrele din inventar</p>
          ) : (
            <Suspense fallback={<div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>}>
              <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {devices.map(d => (
                  <div key={d.id} className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center">
                    <QRCodeCanvas value={deviceUrl(d.id)} size={110} level="M" includeMargin={false} />
                    <p className="text-[11px] font-black text-slate-900 mt-3 leading-tight line-clamp-2">{d.name}</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">SN: {d.serialNumber}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{d.department}</p>
                  </div>
                ))}
              </div>
            </Suspense>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
};

function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default QRLabelSheet;
