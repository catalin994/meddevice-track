import React, { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, Building2, FileSignature, ChevronDown, Search, FileText } from 'lucide-react';
import { MedicalDevice } from '../types';
import {
  situatiaBuletinelor, cateZile, RandBuletin, StareBuletin, PRAG_IMPLICIT,
} from '../services/situatieBuletine';
import { zi } from '../services/valabilitate';
import { scris } from '../services/loctiitori';

/**
 * Situatia buletinelor de verificare, pe Panou.
 *
 * Panoul avea o cifra — "Metrologie Expirata: 3" — si cifra e bine, dar spune
 * cate, nu care. Ca sa afli care, se deschidea aparat dupa aparat, si cu doua
 * mii de aparate asta inseamna ca nu aflai: aflai la control.
 *
 * Aici e lista, nu cifra. Sortata dupa cat de urgent e fiecare, cu numarul de
 * zile scris mare in dreapta, si cu drum direct la aparat. Patru grupe, fiecare
 * cu culoarea ei, si se poate sta pe una singura: expirate, care urmeaza, fara
 * buletin trecut, valabile.
 *
 * Grupa tacuta e a treia. Un aparat supus controlului caruia nu i s-a trecut
 * niciun buletin nu apare in nicio alarma, fiindca n-are nicio data care sa
 * ticaie — si tocmai el e cel despre care nu se stie daca e verificat sau nu.
 */

interface Props {
  devices: MedicalDevice[];
  onSelectDevice?: (id: string) => void;
}

/**
 * Grupa aleasa. Pe langa cele patru stari si "tot ce cere atentie", mai e una
 * taiata altfel: aparatele cu cererea de verificare intarziata. Ele sunt
 * imprastiate in celelalte grupe — unele cu buletinul inca valabil — si tocmai
 * de asta trebuie sa poata fi stranse la un loc.
 */
type Grupa = 'atentie' | 'cerere' | StareBuletin;

const cerereaIntarziata = (r: RandBuletin) =>
  r.stare !== 'expirat' && r.zileCerere !== null && r.zileCerere < 0;

const CULORI: Record<StareBuletin, { chenar: string; fundal: string; punct: string; scris: string; insigna: string }> = {
  expirat: { chenar: 'border-red-200', fundal: 'bg-red-50', punct: 'bg-red-600', scris: 'text-red-700', insigna: 'bg-red-600 text-white' },
  expira: { chenar: 'border-amber-200', fundal: 'bg-amber-50', punct: 'bg-amber-500', scris: 'text-amber-700', insigna: 'bg-amber-500 text-white' },
  lipsa: { chenar: 'border-slate-300', fundal: 'bg-slate-50', punct: 'bg-slate-500', scris: 'text-slate-700', insigna: 'bg-slate-600 text-white' },
  valabil: { chenar: 'border-emerald-200', fundal: 'bg-emerald-50', punct: 'bg-emerald-600', scris: 'text-emerald-700', insigna: 'bg-emerald-600 text-white' },
};

/** Cate randuri incap pe Panou fara sa impinga restul paginii afara. */
const PE_PANOU = 12;

const SituatieBuletine: React.FC<Props> = ({ devices, onSelectDevice }) => {
  const [prag, setPrag] = useState(PRAG_IMPLICIT);
  const [grupa, setGrupa] = useState<Grupa>('atentie');
  const [tot, setTot] = useState(false);
  const [cauta, setCauta] = useState('');

  const s = useMemo(() => situatiaBuletinelor(devices, prag), [devices, prag]);

  /*
   * Ce se arata cand nu s-a ales nimic: tot ce cere atentie, in ordinea ei.
   * Cele valabile sunt majoritatea si nu cer nimic de la nimeni; sunt la o
   * apasare distanta, dar nu stau in fata.
   */
  const alese = useMemo(() => {
    const dupaGrupa = grupa === 'atentie'
      ? s.randuri.filter(r => r.stare !== 'valabil')
      : grupa === 'cerere'
      ? s.randuri.filter(cerereaIntarziata)
      : s.randuri.filter(r => r.stare === grupa);
    const q = cauta.trim().toLowerCase();
    if (!q) return dupaGrupa;
    return dupaGrupa.filter(r => {
      const d = r.device;
      return `${d.name} ${d.serialNumber} ${d.inventoryNumber || ''} ${d.model} ${d.manufacturer} ${d.department}`
        .toLowerCase().includes(q);
    });
  }, [s, grupa, cauta]);

  const aratate = tot ? alese : alese.slice(0, PE_PANOU);

  /* Niciun aparat supus controlului: cartonasul n-are ce spune. */
  if (s.supuse === 0) return null;

  const chipuri: { cheie: Grupa; text: string; cate: number; clasa: string }[] = [
    { cheie: 'atentie', text: 'Cer atentie', cate: s.expirate.length + s.expira.length + s.lipsa.length,
      clasa: 'bg-slate-900 text-white border-slate-900' },
    { cheie: 'expirat', text: 'Expirate', cate: s.expirate.length,
      clasa: 'bg-red-600 text-white border-red-600' },
    { cheie: 'expira', text: `Expira in ${prag} zile`, cate: s.expira.length,
      clasa: 'bg-amber-500 text-white border-amber-500' },
    { cheie: 'lipsa', text: 'Fara buletin trecut', cate: s.lipsa.length,
      clasa: 'bg-slate-600 text-white border-slate-600' },
    { cheie: 'valabil', text: 'Valabile', cate: s.valabile.length,
      clasa: 'bg-emerald-600 text-white border-emerald-600' },
  ];

  return (
    <div className="hardware-card p-5 sm:p-8 rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Buletine de verificare</h3>
          <p className="text-[13px] font-semibold text-slate-500 mt-1">
            {s.supuse} {s.supuse === 1 ? 'aparat supus' : 'aparate supuse'} controlului metrologic
            {s.expirate.length > 0 && <> · <span className="text-red-600 font-bold">{s.expirate.length} fara drept de folosire</span></>}
          </p>
        </div>
        <div className={`p-3 rounded-2xl ${s.expirate.length > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {s.expirate.length > 0 ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
        </div>
      </div>

      {/*
        Cererea intarziata la un buletin care inca tine. E termenul care se
        rateaza: aparatul arata verde, si ziua in care trebuia depusa cererea a
        trecut de luni. Sta deasupra listei fiindca nu se vede din niciun rand.
      */}
      {s.cereriIntarziate > 0 && (
        <button type="button" onClick={() => { setGrupa('cerere'); setTot(false); }}
          aria-pressed={grupa === 'cerere'}
          className={`w-full flex items-start gap-2.5 px-4 py-3 rounded-2xl border mb-4 text-left transition active:scale-[0.995] ${
            grupa === 'cerere' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-amber-50 border-amber-200 hover:border-amber-300'
          }`}>
          <FileSignature className={`w-4 h-4 shrink-0 mt-0.5 ${grupa === 'cerere' ? 'text-white' : 'text-amber-700'}`} />
          <span className={`text-[12px] font-bold leading-snug ${grupa === 'cerere' ? 'text-white' : 'text-amber-800'}`}>
            {s.cereriIntarziate} {s.cereriIntarziate === 1 ? 'aparat are' : 'aparate au'} cererea de verificare intarziata,
            desi buletinul inca tine. {grupa === 'cerere' ? 'Sunt cele de mai jos.' : 'Apasa ca sa le vezi pe toate.'}
          </span>
        </button>
      )}

      {/* Grupele, ca niste butoane: una singura deodata, cu cifra pe ea. */}
      <div className="flex flex-wrap gap-2 mb-4">
        {chipuri.map(c => (
          <button key={c.cheie} type="button"
            onClick={() => { setGrupa(c.cheie); setTot(false); }}
            aria-pressed={grupa === c.cheie}
            className={`px-3 py-2 rounded-xl border text-[12px] font-bold transition active:scale-95 ${
              grupa === c.cheie ? c.clasa : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            {c.text} <span className="tabular-nums">{c.cate}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={cauta}
            onChange={e => { setCauta(e.target.value); setTot(false); }}
            placeholder="Cauta dupa denumire, serie, model sau sectie"
            aria-label="Cauta in buletinele de verificare"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        {/* Cat de departe se uita inainte. Un trimestru se poate planifica; o
            luna e deja prea tarziu ca sa mai grupezi cereri. */}
        <div className="flex items-center gap-1">
          {[30, 90, 180].map(z => (
            <button key={z} type="button" onClick={() => setPrag(z)}
              aria-pressed={prag === z}
              className={`px-3 py-2.5 rounded-xl text-[12px] font-black tabular-nums transition ${
                prag === z ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{z} zile</button>
          ))}
        </div>
      </div>

      {aratate.length === 0 ? (
        <div className="py-12 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-100 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">
            {cauta.trim() ? 'Niciun aparat nu se potriveste cautarii'
              : grupa === 'atentie' ? 'Niciun buletin expirat si niciunul care sa expire curand'
              : grupa === 'cerere' ? 'Nicio cerere de verificare intarziata'
              : 'Niciun aparat in grupa asta'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {aratate.map(r => (
            <RandLista key={r.device.id} r={r} onSelect={onSelectDevice} />
          ))}
        </ul>
      )}

      {alese.length > PE_PANOU && (
        <button type="button" onClick={() => setTot(v => !v)}
          className="w-full mt-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[12px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-2">
          {tot ? 'Arata mai putin' : `Arata toate cele ${alese.length}`}
          <ChevronDown className={`w-4 h-4 transition-transform ${tot ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};

/**
 * Un rand: aparatul in stanga, zilele in dreapta.
 *
 * Numarul de zile e scris mare si e singurul lucru aliniat la dreapta, ca sa
 * se poata citi coloana de zile de sus in jos fara sa fie citit si restul —
 * asta e miscarea pe care o face cineva care cauta ce arde.
 *
 * Pe telefon coloana aia nu incape: numele aparatului si zilele se bateau pe
 * aceeasi latime si castigau zilele, asa ca "Defibrilator Zoll AED Plus" iesea
 * "Defibrilator…" — adica exact ce cauti nu se vedea. Acolo zilele coboara pe
 * randul lor, sub aparat, si numele isi ia toata latimea.
 */
const RandLista: React.FC<{ r: RandBuletin; onSelect?: (id: string) => void }> = ({ r, onSelect }) => {
  const c = CULORI[r.stare];
  const d = r.device;
  const cerereTarzie = cerereaIntarziata(r);

  return (
    <li>
      <button type="button" onClick={() => onSelect?.(d.id)} disabled={!onSelect}
        className={`w-full text-left flex items-stretch gap-3 px-4 py-3 rounded-2xl border transition ${c.chenar} ${c.fundal} ${
          onSelect ? 'hover:shadow-lg hover:shadow-slate-200/50 cursor-pointer active:scale-[0.995]' : 'cursor-default'
        }`}>
        <span className={`w-1.5 rounded-full shrink-0 self-stretch min-h-[2.5rem] ${c.punct}`} />

        <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-black text-slate-900 truncate">
            {scris(d.name) || 'Fara denumire'}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {scris(d.serialNumber) && (
              <span className="text-[11px] font-bold text-slate-500 font-mono">{scris(d.serialNumber)}</span>
            )}
            {scris(d.model) && <span className="text-[11px] font-semibold text-slate-500">{scris(d.model)}</span>}
            {scris(d.department) && (
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3 h-3 shrink-0" />{scris(d.department)}
              </span>
            )}
            {/* De unde se stie termenul, cand nu e scris pe fisa: altfel
                randul pare sa stie ceva ce fisa nu arata. */}
            {r.dinHartie && (
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 truncate max-w-[16rem]">
                <FileText className="w-3 h-3 shrink-0" />dupa {r.hartia}
              </span>
            )}
          </span>
          {cerereTarzie && (
            <span className="block text-[11px] font-bold text-amber-700 mt-1">
              Cererea trebuia depusa pana la {zi(r.cerere)} — intarziata de {Math.abs(r.zileCerere!)} zile
            </span>
          )}
        </span>

        <span className="shrink-0 flex items-baseline gap-2 sm:block sm:text-right">
          {r.stare === 'lipsa' ? (
            <>
              <span className={`inline-block sm:block px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap ${c.insigna}`}>
                Fara buletin
              </span>
              <span className="text-[11px] font-semibold text-slate-500 sm:block sm:mt-1 whitespace-nowrap">netrecut</span>
            </>
          ) : (
            <>
              <span className={`text-[15px] font-black whitespace-nowrap tabular-nums sm:block ${c.scris}`}>
                {cateZile(r.zile!)}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap sm:block sm:mt-0.5">
                {zi(r.pana)}
              </span>
            </>
          )}
        </span>
        </span>
      </button>
    </li>
  );
};

export default SituatieBuletine;
