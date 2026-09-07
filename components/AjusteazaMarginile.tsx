import React, { useRef, useState, useCallback } from 'react';
import { Check, X, Crop } from 'lucide-react';
import { Colturi, Punct } from './scanUtils';

/**
 * Corectarea de mana a celor patru colturi ale paginii.
 *
 * Cautarea automata nimereste aproape intotdeauna, dar nu intotdeauna: o foaie
 * pusa peste alte hartii, un birou de aceeasi culoare cu ea, un colt indoit —
 * si taierea intra in pagina sau lasa o fasie de masa. Pana acum, singurul
 * raspuns era "Refa", adica fotografiaza din nou si spera; iar daca biroul e
 * cel care incurca, a doua incercare iese la fel ca prima.
 *
 * Aici se vede cadrul intreg, asa cum l-a prins camera — nu doar cat s-a vazut
 * pe ecran, fiindca senzorul prinde mai mult decat arata previzualizarea, si
 * uneori coltul care lipseste e tocmai acolo. Se trag colturile unde trebuie si
 * se taie din nou, din aceeasi fotografie.
 */

interface Props {
  /** Cadrul intreg, asa cum a iesit din camera. */
  imagine: string;
  /** De unde se pleaca: colturile gasite automat, sau un patrulater de pornire. */
  colturi: Colturi;
  onRenunta: () => void;
  onGata: (colturi: Colturi) => void;
}

const AjusteazaMarginile: React.FC<Props> = ({ imagine, colturi, onRenunta, onGata }) => {
  const [puncte, setPuncte] = useState<Colturi>(colturi);
  /** Coltul tras acum, ca sa fie desenat mai mare si sa se vada lupa. */
  const [prins, setPrins] = useState<number | null>(null);
  const zonaRef = useRef<HTMLDivElement>(null);

  /** Unde a ajuns degetul, in coordonate de la zero la unu peste imagine. */
  const laImagine = useCallback((e: React.PointerEvent): Punct | null => {
    const z = zonaRef.current?.getBoundingClientRect();
    if (!z || !z.width || !z.height) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - z.left) / z.width)),
      y: Math.min(1, Math.max(0, (e.clientY - z.top) / z.height)),
    };
  }, []);

  const trage = useCallback((i: number) => (e: React.PointerEvent) => {
    const p = laImagine(e);
    if (!p) return;
    setPuncte(prev => prev.map((q, k) => k === i ? p : q) as Colturi);
  }, [laImagine]);

  const NUME = ['stanga sus', 'dreapta sus', 'dreapta jos', 'stanga jos'];

  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col z-30 animate-fade-in">
      <div className="shrink-0 px-5 pt-5 pb-3 text-center">
        <p className="text-blue-400 text-[10px] font-black uppercase tracking-wide">Marginile paginii</p>
        <p className="text-white font-black text-base tracking-tight mt-1">Trage colturile pe marginea foii</p>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-2 flex items-center justify-center">
        {/*
          Imaginea si colturile stau in aceeasi caseta, potrivita pe imagine.
          Casetei i se da latimea din inaltime prin object-contain, asa ca
          poligonul desenat peste ea cade exact peste ce se vede — altfel
          colturile ar sta alaturi de foaie pe un ecran de alta forma.
        */}
        <div ref={zonaRef} className="relative max-w-full max-h-full inline-block touch-none select-none">
          <img src={imagine} alt="Cadrul fotografiat" className="max-w-full max-h-[60vh] object-contain rounded-xl block" />

          <svg viewBox="0 0 100 100" preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="gauraTaierii">
                <rect x="0" y="0" width="100" height="100" fill="white" />
                <polygon fill="black" points={puncte.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} />
              </mask>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="rgba(2,6,23,0.6)" mask="url(#gauraTaierii)" />
            <polygon points={puncte.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
              fill="none" stroke="#60a5fa" strokeWidth="1.2"
              vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>

          {/*
            Manerele sunt butoane adevarate, nu forme din desen: pe un desen
            intins cu preserveAspectRatio="none" un cerc iese oval, si mai ales
            trebuie sa fie destul de mari cat un deget. Se pot muta si din
            tastatura, cu sagetile, pentru cine lucreaza pe calculator.
          */}
          {puncte.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Coltul din ${NUME[i]}`}
              onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setPrins(i); }}
              onPointerMove={e => { if (prins === i) trage(i)(e); }}
              onPointerUp={() => setPrins(null)}
              onPointerCancel={() => setPrins(null)}
              onKeyDown={e => {
                const pas = e.shiftKey ? 0.02 : 0.004;
                const d: Record<string, [number, number]> = {
                  ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas],
                };
                const m = d[e.key];
                if (!m) return;
                e.preventDefault();
                setPuncte(prev => prev.map((q, k) => k === i
                  ? { x: Math.min(1, Math.max(0, q.x + m[0])), y: Math.min(1, Math.max(0, q.y + m[1])) }
                  : q) as Colturi);
              }}
              className={`absolute rounded-full border-[3px] border-white bg-blue-500 shadow-lg transition-transform ${
 prins === i ? 'w-10 h-10 scale-110' : 'w-8 h-8'
              }`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onRenunta}
            className="flex items-center justify-center gap-2 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[13px] font-bold tracking-normal transition active:scale-95">
            <X className="w-5 h-5" /> Renunt
          </button>
          <button onClick={() => onGata(puncte)}
            className="flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-bold tracking-normal transition active:scale-95 shadow-xl shadow-blue-600/20">
            <Check className="w-5 h-5" /> Taie asa
          </button>
        </div>
        <p className="text-center text-white/40 text-[10px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5">
          <Crop className="w-3 h-3" /> Pagina se taie din nou din aceeasi fotografie
        </p>
      </div>
    </div>
  );
};

export default AjusteazaMarginile;
