import { useCallback, useRef, useState } from 'react';

/**
 * Fisiere lasate cu mouse-ul peste o zona din pagina.
 *
 * Aceeasi purtare peste tot unde aplicatia primeste un document — facturi,
 * contracte, referate, comenzi — ca sa nu ajunga fiecare ecran cu felul lui de
 * a se aprinde si cu bucata lui de cod de intrat prin foldere.
 *
 * Se foloseste asa:
 *
 *   const tragere = useTragere(fisiere => citeste(fisiere[0]));
 *   <div {...tragere.proprietati} className={tragere.peDeasupra ? '...' : '...'}>
 */
export interface Tragere {
  /** Adevarat cat timp un fisier e tinut deasupra zonei. */
  peDeasupra: boolean;
  /** Se imprastie pe elementul care primeste fisierele. */
  proprietati: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/** Numai o tragere de fisiere, nu un text selectat mutat prin pagina. */
const suntFisiere = (e: React.DragEvent) =>
  Array.from(e.dataTransfer?.types || []).includes('Files');

/**
 * Fisierele dintr-o tragere, inclusiv cele dintr-un folder.
 *
 * Cand se trage un folder, browserul nu da fisierele din el in `files`, ci un
 * singur "director" in `items`. Fara coborarea de mai jos, trasul unui folder
 * de facturi n-ar face nimic — si tocmai asa vin de obicei, un folder pe luna.
 */
export const fisiereleDinTragere = async (dt: DataTransfer): Promise<File[]> => {
  const items = Array.from(dt.items || []);
  const intrari = items
    .map(i => (i as any).webkitGetAsEntry?.())
    .filter(Boolean) as any[];
  if (intrari.length === 0) return Array.from(dt.files || []);

  const gasite: File[] = [];
  const coboara = async (intrare: any, cale: string): Promise<void> => {
    if (intrare.isFile) {
      const f: File = await new Promise((res, rej) => intrare.file(res, rej));
      // Calea din folder se pastreaza: listele de import o arata, ca sa se
      // stie din ce subfolder a venit fiecare document.
      if (cale) {
        try { Object.defineProperty(f, 'webkitRelativePath', { value: `${cale}/${f.name}` }); }
        catch { /* unele browsere nu lasa */ }
      }
      gasite.push(f);
      return;
    }
    if (!intrare.isDirectory) return;
    const reader = intrare.createReader();
    // readEntries da cel mult o suta odata; se citeste pana se goleste.
    for (;;) {
      const lot: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (lot.length === 0) break;
      for (const e of lot) await coboara(e, cale ? `${cale}/${intrare.name}` : intrare.name);
    }
  };
  try {
    for (const e of intrari) await coboara(e, '');
  } catch {
    return Array.from(dt.files || []);
  }
  return gasite.length ? gasite : Array.from(dt.files || []);
};

/**
 * @param primeste  ce se face cu fisierele lasate. Primeste cel putin unul.
 * @param unSingur  cand ecranul stie sa citeasca un singur document odata,
 *                  restul se ignora in loc sa se piarda tacut peste primul.
 */
export default function useTragere(
  primeste: (fisiere: File[]) => void,
  unSingur = false,
): Tragere {
  const [peDeasupra, setPeDeasupra] = useState(false);
  /*
   * Numaratoarea, nu un simplu adevarat/fals: dragenter si dragleave se
   * declanseaza si cand cursorul trece de pe cartela pe textul dinauntrul ei,
   * iar cu un steag simplu chenarul palpaia la fiecare rand peste care trecea
   * mana. Se numara intrarile si iesirile, si se stinge cand ajung egale.
   */
  const adancime = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!suntFisiere(e)) return;
    e.preventDefault();
    adancime.current += 1;
    setPeDeasupra(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!suntFisiere(e)) return;
    e.preventDefault();
    adancime.current = Math.max(0, adancime.current - 1);
    if (adancime.current === 0) setPeDeasupra(false);
  }, []);

  /* Fara asta, browserul deschide fisierul intr-un tab in loc sa-l dea paginii. */
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!suntFisiere(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    if (!suntFisiere(e)) return;
    e.preventDefault();
    adancime.current = 0;
    setPeDeasupra(false);
    const fisiere = await fisiereleDinTragere(e.dataTransfer);
    if (fisiere.length === 0) return;
    primeste(unSingur ? fisiere.slice(0, 1) : fisiere);
  }, [primeste, unSingur]);

  return { peDeasupra, proprietati: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
