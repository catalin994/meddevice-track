import React, { useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, Building2, FileSignature, CheckCircle2,
  Loader2, Wand2, ChevronDown,
} from 'lucide-react';
import { MedicalDevice } from '../types';
import { situatiaBuletinelor, cateZile, StareBuletin } from '../services/situatieBuletine';
import { CATEGORII_CU_METROLOGIE } from '../services/termene';
import { zi } from '../services/valabilitate';
import { scris } from '../services/loctiitori';
import ConfirmDialog from './ConfirmDialog';

/**
 * Aparatele care au nevoie de buletin de verificare periodica.
 *
 * Pe ecranul de control, pana acum, se vedea numai ce lipseste. Dar prima
 * intrebare a celui care vine in control nu e "ce va lipseste", e "cate
 * aparate aveti supuse verificarii periodice si care sunt" — si raspunsul la
 * ea nu statea nicaieri intreg.
 *
 * Aici sta: cate sunt, in ce stare e buletinul fiecaruia, si cand trebuie
 * depusa cererea urmatoare.
 *
 * Partea a doua a cartonasului e cea care face treaba. Un aparat e intrebat de
 * verificare numai daca are bifa "supus controlului" pusa pe el. Bifa se pune
 * singura la adaugare, dupa categorie — dar aparatele intrate printr-un import
 * Excel, sau adaugate inainte sa existe regula, n-au primit-o. Ele nu apar in
 * nicio alarma, in niciun plan si in nicio alta cerinta: scapa tacut din toata
 * evidenta, si tocmai de asta nu le vede nimeni pana la control. Aici se vad,
 * si se pot insemna pe toate deodata.
 *
 * Insemnarea nu se face singura, nici macar cand categoria e limpede: lista
 * categoriilor e un semn, nu o hotarare, iar ultimul cuvant il are serviciul
 * tehnic. Aplicatia arata si propune; apasa omul.
 */

interface Props {
  devices: MedicalDevice[];
  onSelectDevice?: (id: string) => void;
  /** Pune bifa pe mai multe aparate deodata. Fara ea, cartonasul doar arata. */
  onInsemneaza?: (devices: MedicalDevice[]) => Promise<void> | void;
}

const CULORI: Record<StareBuletin, { chenar: string; fundal: string; dunga: string; scris: string }> = {
  expirat: { chenar: 'border-red-200', fundal: 'bg-red-50', dunga: 'bg-red-600', scris: 'text-red-700' },
  expira: { chenar: 'border-amber-200', fundal: 'bg-amber-50', dunga: 'bg-amber-500', scris: 'text-amber-700' },
  lipsa: { chenar: 'border-slate-300', fundal: 'bg-slate-50', dunga: 'bg-slate-500', scris: 'text-slate-700' },
  valabil: { chenar: 'border-emerald-200', fundal: 'bg-emerald-50', dunga: 'bg-emerald-600', scris: 'text-emerald-700' },
};

const PE_ECRAN = 10;

const SupuseVerificarii: React.FC<Props> = ({ devices, onSelectDevice, onInsemneaza }) => {
  const [tot, setTot] = useState(false);
  const [intreb, setIntreb] = useState(false);
  const [lucrez, setLucrez] = useState(false);

  const s = useMemo(() => situatiaBuletinelor(devices), [devices]);

  /* Aparatele care ar trebui sa poarte buletin, dar n-au bifa pusa. */
  const neinsemnate = useMemo(
    () => devices.filter(d =>
      d.status !== 'Retired' && !d.metrologyRequired && CATEGORII_CU_METROLOGIE.includes(d.category))
      .sort((a, b) => (a.department || '').localeCompare(b.department || '', 'ro')
        || (a.name || '').localeCompare(b.name || '', 'ro')),
    [devices]);

  const aratate = tot ? s.randuri : s.randuri.slice(0, PE_ECRAN);

  const insemneaza = async () => {
    if (!onInsemneaza) return;
    setLucrez(true);
    try {
      await onInsemneaza(neinsemnate.map(d => ({ ...d, metrologyRequired: true })));
      setIntreb(false);
    } finally {
      setLucrez(false);
    }
  };

  return (
    <div className="hardware-card rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
            Aparatele supuse verificarii periodice
          </h3>
          <p className="text-[12px] font-semibold text-slate-500 mt-1">
            Prima intrebare la control: cate sunt si care. Mai jos, cu starea buletinului fiecaruia.
          </p>
        </div>
        <div className={`p-3 rounded-2xl ${s.expirate.length > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>

      {/* Cifrele dupa care se raspunde pe loc, fara sa fie deschis nimic. */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
        {[
          { e: 'Supuse', n: s.supuse, c: 'text-slate-900' },
          { e: 'Valabile', n: s.valabile.length, c: 'text-emerald-700' },
          { e: 'Expira in 90 zile', n: s.expira.length, c: 'text-amber-700' },
          { e: 'Expirate', n: s.expirate.length, c: 'text-red-700' },
          { e: 'Fara buletin', n: s.lipsa.length, c: 'text-slate-700' },
        ].map(x => (
          <div key={x.e} className="px-3 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className={`text-2xl font-black tabular-nums leading-none ${x.c}`}>{x.n}</p>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mt-1.5 leading-tight">{x.e}</p>
          </div>
        ))}
      </div>

      {/*
        Aparatele neinsemnate. Stau deasupra listei fiindca sunt singura parte
        a cartonasului la care e ceva de facut — si fiindca, pana se face,
        cifrele de mai sus sunt mai mici decat adevarul.
      */}
      {neinsemnate.length > 0 && (
        <div className="px-4 py-4 rounded-2xl bg-amber-50 border border-amber-200 mb-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-amber-900 leading-snug">
                {neinsemnate.length} {neinsemnate.length === 1 ? 'aparat pare sa aiba' : 'aparate par sa aiba'} nevoie
                de buletin, dar {neinsemnate.length === 1 ? 'nu e insemnat' : 'nu sunt insemnate'}
              </p>
              <p className="text-[12px] font-semibold text-amber-800 leading-snug mt-1">
                Fara bifa nu sunt intrebate de nimic: nu apar in situatia buletinelor, nici in planul
                verificarilor, nici in cerintele de mai jos. Categoria e un semn, nu o hotarare —
                verifica lista inainte sa le insemnezi.
              </p>
              <ul className="mt-3 space-y-1.5">
                {neinsemnate.slice(0, 6).map(d => (
                  <li key={d.id}>
                    <button type="button" onClick={() => onSelectDevice?.(d.id)}
                      className="w-full text-left flex flex-wrap items-baseline gap-x-2 px-3 py-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 transition">
                      <span className="text-[13px] font-black text-slate-900">{scris(d.name) || 'Fara denumire'}</span>
                      {scris(d.serialNumber) && (
                        <span className="text-[11px] font-bold text-slate-500 font-mono">{scris(d.serialNumber)}</span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-500">{scris(d.category)}</span>
                      {scris(d.department) && (
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{scris(d.department)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {neinsemnate.length > 6 && (
                  <li className="text-[11px] font-black uppercase tracking-wide text-amber-700 px-1">
                    si inca {neinsemnate.length - 6}
                  </li>
                )}
              </ul>
              {onInsemneaza && (
                <button type="button" onClick={() => setIntreb(true)} disabled={lucrez}
                  className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-amber-700 transition active:scale-95 disabled:opacity-50">
                  {lucrez ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Insemneaza-le pe toate
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {s.supuse === 0 ? (
        <div className="py-10 text-center">
          <ShieldCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-slate-500">
            Niciun aparat insemnat ca supus verificarii periodice.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {aratate.map(r => {
              const c = CULORI[r.stare];
              const d = r.device;
              const cerereTarzie = r.stare !== 'expirat' && r.zileCerere !== null && r.zileCerere < 0;
              return (
                <li key={d.id}>
                  <button type="button" onClick={() => onSelectDevice?.(d.id)}
                    className={`w-full text-left flex items-stretch gap-3 px-4 py-3 rounded-2xl border transition ${c.chenar} ${c.fundal} hover:shadow-lg hover:shadow-slate-200/50 active:scale-[0.995]`}>
                    <span className={`w-1.5 rounded-full shrink-0 self-stretch min-h-[2.5rem] ${c.dunga}`} />
                    <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-black text-slate-900 truncate">
                          {scris(d.name) || 'Fara denumire'}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {scris(d.serialNumber) && (
                            <span className="text-[11px] font-bold text-slate-500 font-mono">{scris(d.serialNumber)}</span>
                          )}
                          {scris(d.department) && (
                            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3 shrink-0" />{scris(d.department)}
                            </span>
                          )}
                          {r.numar && (
                            <span className="text-[11px] font-semibold text-slate-500">buletin {r.numar}</span>
                          )}
                        </span>
                        {cerereTarzie && (
                          <span className="block text-[11px] font-bold text-amber-700 mt-1 flex items-center gap-1">
                            <FileSignature className="w-3 h-3 shrink-0" />
                            Cererea trebuia depusa pana la {zi(r.cerere)}
                          </span>
                        )}
                        {!cerereTarzie && r.cerere && r.stare !== 'expirat' && (
                          <span className="block text-[11px] font-semibold text-slate-500 mt-1">
                            Cererea urmatoare, pana la {zi(r.cerere)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 flex items-baseline gap-2 sm:block sm:text-right">
                        {r.stare === 'lipsa' ? (
                          <span className="text-[12px] font-black text-slate-600 whitespace-nowrap">Fara buletin</span>
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
            })}
          </ul>

          {s.randuri.length > PE_ECRAN && (
            <button type="button" onClick={() => setTot(v => !v)}
              className="w-full mt-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[12px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-2">
              {tot ? 'Arata mai putin' : `Arata toate cele ${s.randuri.length}`}
              <ChevronDown className={`w-4 h-4 transition-transform ${tot ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      )}

      <ConfirmDialog
        open={intreb}
        tone="neutral"
        icon={<CheckCircle2 className="w-6 h-6" />}
        title="Insemneaza aparatele ca supuse verificarii"
        body={
          <>
            Se pune bifa "supus controlului" pe <strong>{neinsemnate.length}</strong>{' '}
            {neinsemnate.length === 1 ? 'aparat' : 'aparate'}, dupa categoria lor.
            De aici incolo intra in situatia buletinelor, in planul verificarilor si in
            cerintele controlului.
            <br /><br />
            Nu se trece niciun buletin si nicio data: bifa spune doar ca aparatul are nevoie
            de verificare, nu ca a fost verificat. Se poate scoate oricand, de pe fisa
            fiecarui aparat.
          </>
        }
        confirmLabel="Insemneaza-le"
        busyLabel="Se salveaza..."
        busy={lucrez}
        onConfirm={insemneaza}
        onCancel={() => setIntreb(false)}
      />
    </div>
  );
};

export default SupuseVerificarii;
