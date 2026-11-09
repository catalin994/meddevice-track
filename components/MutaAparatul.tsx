import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Loader2, X } from 'lucide-react';
import Portal from './Portal';
import DepartmentPicker from './DepartmentPicker';
import CampData from './CampData';
import useEscape from './useEscape';
import { MedicalDevice } from '../types';
import { aceeasiSectie } from '../services/mutari';

/**
 * Mutarea aparatului dintr-o secţie in alta.
 *
 * Pana acum se facea prin editarea fisei: se deschidea "Editeaza", se schimba
 * un camp, se salva. Functiona, dar nu spunea nicaieri ca s-a mutat ceva —
 * nici cand, nici de unde, nici de ce — si registrul de evidenta cere tocmai
 * asta. Mai rau, cine muta un aparat intra in formularul in care se pot
 * schimba si seria, si numarul de inventar, si starea.
 *
 * Aici se cer trei lucruri si numai trei: unde, din ce zi, si de ce. Ziua e
 * ceruta fiindca mutarea se trece in evidenta de obicei a doua zi, sau
 * vineri pentru toata saptamana; pusa automat pe ziua de azi, ar fi o data
 * falsa in registru. Motivul rămâne liber: e singurul lucru pe care nu-l stie
 * aplicatia.
 */

interface MutaAparatulProps {
  open: boolean;
  device: MedicalDevice;
  /** Toate sectiile cunoscute si cate aparate are fiecare. */
  sectii: string[];
  cateAparate?: Record<string, number>;
  busy?: boolean;
  onMuta: (catre: string, cand: string, nota: string) => void;
  onCancel: () => void;
}

const MutaAparatul: React.FC<MutaAparatulProps> = ({
  open, device, sectii, cateAparate = {}, busy = false, onMuta, onCancel,
}) => {
  const [catre, setCatre] = useState('');
  const [cand, setCand] = useState('');
  const [nota, setNota] = useState('');

  /* Formularul porneste curat la fiecare deschidere: o secţie rămasă din
     mutarea de ieri, pe alt aparat, s-ar salva fara sa fie citita. */
  useEffect(() => {
    if (!open) return;
    setCatre('');
    setCand(new Date().toISOString().split('T')[0]);
    setNota('');
  }, [open, device.id]);

  useEscape(onCancel, open && !busy);

  if (!open) return null;

  const gata = !!catre.trim() && !aceeasiSectie(catre, device.department) && !!cand;

  return (
    <Portal>
      <div className="fixed inset-0 z-[640] scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
        onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
        <div role="dialog" aria-modal="true" aria-label="Muta aparatul in alta sectie"
          className="hardware-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 animate-slide-up max-h-[92vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600 shrink-0" /> Muta aparatul
              </h3>
              <p className="text-[12px] font-semibold text-slate-500 mt-1">
                {device.name}{device.serialNumber ? ` · ${device.serialNumber}` : ''}
              </p>
            </div>
            <button onClick={onCancel} disabled={busy} aria-label="Inchide"
              className="p-2.5 bg-slate-50 text-slate-500 hover:text-slate-900 rounded-xl transition shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* De unde pleaca, scris, nu presupus: pe un aparat care a umblat
              mult, cine muta nu mai tine minte unde era trecut. */}
          <div className="mb-4 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="tech-label">Acum este la</span>
            <p className="text-[14px] font-black text-slate-800 mt-0.5">{device.department || 'Secţie netrecuta'}</p>
          </div>

          <div className="space-y-4">
            <DepartmentPicker
              value={catre}
              onChange={setCatre}
              options={sectii}
              counts={cateAparate}
              label="Unde se muta"
              placeholder="Alege secţia"
            />
            <div className="space-y-1">
              <label className="tech-label ml-1" htmlFor="muta-cand">Din ce zi</label>
              <CampData
                id="muta-cand"
                value={cand}
                onChange={setCand}
                eticheta="Data mutarii"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="tech-label ml-1" htmlFor="muta-nota">De ce se muta <span className="font-bold text-slate-400 normal-case tracking-normal">— nu e obligatoriu</span></label>
              <input id="muta-nota" value={nota} onChange={e => setNota(e.target.value)}
                placeholder="Ex. predat la Chirurgie pe baza de proces-verbal"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>

          {catre.trim() && aceeasiSectie(catre, device.department) && (
            <p className="mt-3 text-[12px] font-bold text-amber-700">
              Aparatul este deja la {device.department} — nu e nimic de mutat.
            </p>
          )}

          <div className="flex gap-2 mt-6">
            <button onClick={() => onMuta(catre.trim(), cand, nota.trim())} disabled={!gata || busy}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[12px] uppercase tracking-wide hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              {busy ? 'Se muta...' : 'Muta aparatul'}
            </button>
            <button onClick={onCancel} disabled={busy}
              className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[13px] hover:bg-slate-200 transition active:scale-95">
              Anuleaza
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default MutaAparatul;
