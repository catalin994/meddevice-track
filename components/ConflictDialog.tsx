import React from 'react';
import { AlertTriangle, User, Cloud } from 'lucide-react';
import Portal from './Portal';
import useEscape from './useEscape';
import { Diferenta } from '../services/conflicte';

/**
 * Cand doi oameni au scris pe acelasi rand.
 *
 * Nu incearca sa impace singura cele doua variante — n-are de unde sti care
 * are dreptate. Arata ce difera, spune cine a scris ultima data in cloud, si
 * lasa alegerea la om. Pana acum alegerea se facea singura, in favoarea celui
 * care apasa al doilea, si nimeni nu afla.
 */
const ConflictDialog: React.FC<{
  open: boolean;
  /** "aparatul", "factura" — ca sa se citeasca in propozitie. */
  ce: string;
  nume: string;
  diferente: Diferenta[];
  /** Cand a fost scrisa varianta din cloud. */
  candLui?: string;
  onAlege: (care: 'meu' | 'lui') => void;
}> = ({ open, ce, nume, diferente, candLui, onAlege }) => {
  useEscape(() => onAlege('lui'), open);
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[800] scrim flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-fade-in">
          <div className="p-6 sm:p-8 bg-amber-50 border-b border-amber-100 flex items-start gap-4 shrink-0">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Altcineva a modificat {ce} intre timp
              </h3>
              <p className="text-[13px] font-semibold text-amber-900/80 mt-1 leading-relaxed">
                <span className="font-black">{nume}</span> a fost schimbat in cloud dupa ce l-ai deschis
                {candLui ? `, ultima data ${candLui.slice(0, 16).replace('T', ' ')}` : ''}.
                Daca salvezi peste, ce a scris colegul se pierde.
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-8">
            {diferente.length === 0 ? (
              <p className="text-[13px] font-bold text-slate-500">
                Diferentele sunt in liste (documente, istoric, pozitii), nu in campurile simple.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-3 pb-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Camp</span>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-wide flex items-center gap-1">
                    <User className="w-3 h-3" /> Ce am scris eu
                  </span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> Ce e in cloud
                  </span>
                </div>
                {diferente.map(d => (
                  <div key={d.camp} className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[12px] font-black text-slate-900 break-words">{d.eticheta}</span>
                    <span className="text-[12px] font-bold text-blue-700 break-words">{d.alMeu}</span>
                    <span className="text-[12px] font-bold text-slate-600 break-words">{d.alLui}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0">
            <button onClick={() => onAlege('lui')}
              className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-slate-200 transition">
              Renunt, tin varianta din cloud
            </button>
            <button onClick={() => onAlege('meu')}
              className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-wide hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">
              Salvez ce am scris eu
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ConflictDialog;
