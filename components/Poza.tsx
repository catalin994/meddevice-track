import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { resolveSource } from '../services/fileStorage';

/**
 * O poza, oriunde ar fi tinuta.
 *
 * Pozele vin din doua locuri. Cele vechi stau inline in rand, ca sir base64,
 * fiindca asa au fost salvate de la inceput. Cele noi stau in stocare si randul
 * tine numai calea catre ele. Amandoua trebuie sa se vada la fel, si niciun
 * ecran n-are de ce sa stie care e care — altfel fiecare loc in care se arata
 * o poza ar trebui sa invete amandoua felurile, si l-ar invata gresit.
 *
 * Ce vine din stocare se cere o data si ramane in cache-ul local, deci a doua
 * oara se deschide si fara semnal.
 */

export interface SursaPozei {
  /** Calea in stocare. */
  path?: string;
  /** Copia inline, pentru randurile vechi si pentru cele urcate fara semnal. */
  url?: string;
}

interface Props {
  sursa: SursaPozei;
  alt: string;
  /** Clasele imaginii. Invelisul si le pune ecranul care o foloseste. */
  className?: string;
  /** Ce se arata cand nu e nicio poza. Fara el, nu se arata nimic. */
  gol?: React.ReactNode;
}

const Poza: React.FC<Props> = ({ sursa, alt, className = '', gol = null }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [starea, setStarea] = useState<'goala' | 'incarc' | 'gata' | 'rea'>('goala');

  useEffect(() => {
    let viu = true;
    let obiect: string | null = null;

    if (!sursa.path && !sursa.url) { setSrc(null); setStarea('goala'); return; }

    /* Inline se vede pe loc: n-are rost nicio asteptare pentru un sir pe
       care il avem deja in mana. */
    if (!sursa.path && sursa.url) { setSrc(sursa.url); setStarea('gata'); return; }

    setStarea('incarc');
    resolveSource(sursa).then(r => {
      if (!viu) return;
      if (r.blob) {
        obiect = URL.createObjectURL(r.blob);
        setSrc(obiect);
        setStarea('gata');
      } else if (r.dataUrl) {
        setSrc(r.dataUrl);
        setStarea('gata');
      } else {
        setSrc(null);
        setStarea('rea');
      }
    }).catch(() => { if (viu) { setSrc(null); setStarea('rea'); } });

    return () => {
      viu = false;
      /* Fara asta, fiecare deschidere a unei fise lasa in urma cateva
         megaocteti pe care browserul nu-i mai elibereaza niciodata. */
      if (obiect) URL.revokeObjectURL(obiect);
    };
  }, [sursa.path, sursa.url]);

  if (starea === 'goala') return <>{gol}</>;

  if (starea === 'incarc') {
    return (
      <div className={`flex items-center justify-center bg-slate-50 ${className}`}>
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  /* Poza care n-a putut fi adusa nu se ascunde: altfel ar parea ca aparatul
     n-are poza, si cineva ar face alta peste cea care exista. */
  if (starea === 'rea' || !src) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400 ${className}`}
        title="Poza nu a putut fi adusa. Verifica internetul.">
        <ImageOff className="w-5 h-5" />
        <span className="text-[9px] font-bold uppercase tracking-wide">fara semnal</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" loading="lazy" />;
};

export default Poza;

/** Sursa pozei unui aparat: stocarea intai, randul vechi pe urma. */
export const pozaAparatului = (d: { imagePath?: string; image?: string }): SursaPozei =>
  ({ path: d.imagePath, url: d.image });

/** Sursa pozei unui consumabil. */
export const pozaConsumabilului = (c: { photoPath?: string; photoUrl?: string }): SursaPozei =>
  ({ path: c.photoPath, url: c.photoUrl });
