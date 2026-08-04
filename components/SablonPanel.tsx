import React, { useCallback, useEffect, useState } from 'react';
import { FileCog, Upload, Trash2, Check, Loader2, X } from 'lucide-react';
import Portal from './Portal';
import useEscape from './useEscape';
import {
  FelSablon, SursaSablon, SEMNE, punSablon, scoateSablon, sablonulFolosit,
} from '../services/sabloane';
import { semneleDin } from '../services/sablonWord';
import { notify } from '../services/notices';

/**
 * Ce sablon Word sta in spatele documentelor generate.
 *
 * Aplicatia vine cu formularele institutiei deja puse, asa ca panoul nu mai e
 * un pas obligatoriu — e locul unde se vede pe ce se genereaza si unde se poate
 * pune altceva, cand formularul se schimba.
 *
 * Spune si ce semne a gasit in fisier, ca sa se vada dintr-o privire daca unul
 * a fost scris gresit — altfel campul ar iesi gol pe hartie si nimeni n-ar sti
 * de ce.
 */
const SablonPanel: React.FC<{ fel: FelSablon; titlu: string }> = ({ fel, titlu }) => {
  const [deschis, setDeschis] = useState(false);
  const [sursa, setSursa] = useState<SursaSablon | null>(null);
  const [lucreaza, setLucreaza] = useState(false);
  const [gasite, setGasite] = useState<string[] | null>(null);
  useEscape(() => setDeschis(false), deschis);
  const are = sursa === null ? null : sursa !== 'niciunul';

  const verifica = useCallback(async () => {
    const { blob, sursa: s } = await sablonulFolosit(fel).catch(() => ({ blob: null, sursa: 'niciunul' as SursaSablon }));
    setSursa(s);
    setGasite(blob ? await semneleDin(blob).catch(() => []) : null);
  }, [fel]);

  useEffect(() => { verifica(); }, [verifica]);

  const incarca = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.docx')) {
      notify('Sablonul trebuie sa fie un fisier Word (.docx)', 'warning');
      return;
    }
    setLucreaza(true);
    try {
      const semne = await semneleDin(f);
      if (semne.length === 0) {
        notify('Fisierul nu contine niciun semn de forma {{...}} — verifica sablonul', 'warning');
        setLucreaza(false);
        return;
      }
      const ok = await punSablon(fel, f);
      setGasite(semne);
      setSursa('propriu');
      notify(ok
        ? `Sablon salvat — ${semne.length} semne recunoscute`
        : 'Sablon salvat local; se urca in cloud la urmatoarea sincronizare', ok ? 'success' : 'info');
    } catch (err: any) {
      notify(`Sablonul nu a putut fi citit${err?.message ? `: ${err.message}` : ''}`, 'error');
    } finally {
      setLucreaza(false);
    }
  }, [fel]);

  const sterge = useCallback(async () => {
    setLucreaza(true);
    await scoateSablon(fel);
    await verifica();
    setLucreaza(false);
    notify('Sablonul vostru a fost scos — documentele se genereaza pe formularul inclus', 'info');
  }, [fel, verifica]);

  const cunoscute = new Set(SEMNE[fel].map(s => s.semn));
  const necunoscute = (gasite || []).filter(s => !cunoscute.has(s));
  const lipsa = SEMNE[fel].filter(s => gasite && !gasite.includes(s.semn));

  return (
    <>
      <button
        onClick={() => setDeschis(true)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition border-2 ${
          are
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
        }`}
        title="Sablonul Word din care se genereaza documentele"
      >
        <FileCog className="w-4 h-4 shrink-0" />
        Sablon Word
        {are === true && <Check className="w-3.5 h-3.5 shrink-0" />}
      </button>

      {deschis && (
        <Portal>
          <div className="fixed inset-0 z-[620] scrim flex items-center justify-center p-0 sm:p-6">
            <div className="bg-white w-full max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-hidden flex flex-col rounded-none sm:rounded-[2.5rem] shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sablon Word</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{titlu}</p>
                </div>
                <button onClick={() => setDeschis(false)} aria-label="Inchide"
                  className="p-3 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-5">
                <div className={`px-5 py-4 rounded-2xl border-2 ${
                  are ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <p className={`text-[13px] font-bold ${are ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {sursa === 'propriu'
                      ? 'Se genereaza pe sablonul pus de voi. Documentele ies exact in formatul lui.'
                      : sursa === 'inclus'
                        ? 'Se genereaza pe formularul inclus in aplicatie — cu sigla, antetul si subsolul institutiei. Nu trebuie sa incarcati nimic.'
                        : 'Nu e pus niciun sablon. Documentele ies in formatul aplicatiei — corect, dar fara sigla si antetul institutiei.'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest cursor-pointer transition ${
                    lucreaza ? 'bg-slate-100 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                  }`}>
                    {lucreaza ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {sursa === 'propriu' ? 'Inlocuieste sablonul' : 'Pune sablonul vostru'}
                    <input type="file" accept=".docx" onChange={incarca} disabled={lucreaza} className="hidden" />
                  </label>
                  {sursa === 'propriu' && (
                    <button onClick={sterge} disabled={lucreaza}
                      title="Scoate sablonul vostru si revino la formularul inclus"
                      className="px-5 py-4 bg-slate-50 text-slate-600 border-2 border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:text-red-600 hover:border-red-200 transition flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" /> Scoate
                    </button>
                  )}
                </div>

                {necunoscute.length > 0 && (
                  <div className="px-5 py-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <p className="text-[13px] font-bold text-red-900">
                      Semne pe care aplicatia nu le cunoaste, deci vor ramane goale:{' '}
                      <span className="font-mono">{necunoscute.join(', ')}</span>
                    </p>
                  </div>
                )}
                {are && lipsa.length > 0 && (
                  <div className="px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl">
                    <p className="text-[13px] font-semibold text-slate-600">
                      Semne pe care aplicatia le poate completa, dar care nu apar in sablon:{' '}
                      <span className="font-mono text-slate-500">{lipsa.map(s => s.semn).join(', ')}</span>
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2">
                    Semnele pe care le completeaza aplicatia
                  </p>
                  <div className="border-2 border-slate-100 rounded-2xl divide-y divide-slate-50 overflow-hidden">
                    {SEMNE[fel].map(s => (
                      <div key={s.semn} className="flex items-center gap-3 px-4 py-2.5">
                        <code className={`text-[12px] font-mono font-bold shrink-0 ${
                          gasite?.includes(s.semn) ? 'text-emerald-700' : 'text-slate-500'
                        }`}>{`{{${s.semn}}}`}</code>
                        <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-slate-600">{s.ce}</span>
                        {gasite?.includes(s.semn) && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] font-semibold text-slate-500 mt-3 ml-1 leading-relaxed">
                    Sablonul e documentul vostru obisnuit, in care valorile care se schimba de la un act
                    la altul sunt inlocuite cu semnele de mai sus. Randul de tabel care poarta semne
                    <span className="font-mono"> rand.*</span> se repeta o data pentru fiecare pozitie.
                    Cel inclus in aplicatie e chiar formularul institutiei, deja pregatit asa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
};

export default SablonPanel;
