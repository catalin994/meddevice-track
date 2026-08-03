import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff, X, Database } from 'lucide-react';
import Portal from './Portal';
import { getStorageProblem, onStorageProblem, StorageProblem } from '../services/storageService';

/**
 * Two things the app has to be honest about once it works offline.
 *
 * A new version can't take over silently — swapping the bundle in the middle of
 * a scan would lose the pages already captured — so the user picks the moment.
 * And when the phone has no signal the app now keeps working from its local
 * copy, which is only reassuring if it says so; otherwise stale data looks
 * like fresh data.
 */
const AppStatusBar: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (err) => console.warn('[PWA] inregistrare esuata', err),
  });

  // The local database is where everything is read from and written to, so a
  // failure to open it has to be visible: the app would otherwise start empty
  // and swallow every save.
  const [storage, setStorage] = useState<StorageProblem | null>(getStorageProblem);
  useEffect(() => {
    const off = onStorageProblem(setStorage);
    return () => { off(); };
  }, []);

  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const online = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', down); };
  }, []);

  if (!needRefresh && !offline && !storage) return null;

  return (
    <Portal>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[800] w-[min(26rem,calc(100vw-2rem))] space-y-2">
        {storage && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-600 text-white rounded-2xl shadow-2xl">
            <Database className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1 text-[13px] font-semibold leading-snug">{storage.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 bg-white text-red-700 rounded-xl text-[12px] font-bold hover:bg-red-50 transition active:scale-95 shrink-0"
            >
              Reincarca
            </button>
          </div>
        )}

        {offline && (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
            <p className="text-[13px] font-semibold leading-snug">
              Fara internet — lucrezi pe datele salvate pe telefon. Se sincronizeaza singur cand revine semnalul.
            </p>
          </div>
        )}

        {needRefresh && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-2xl shadow-2xl">
            <RefreshCw className="w-4 h-4 shrink-0" />
            <p className="flex-1 text-[13px] font-semibold leading-snug">Versiune noua disponibila</p>
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-2 bg-white text-blue-700 rounded-xl text-[12px] font-bold hover:bg-blue-50 transition active:scale-95 shrink-0"
            >
              Reincarca
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              aria-label="Mai tarziu"
              className="p-2 hover:bg-white/15 rounded-lg transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Portal>
  );
};

export default AppStatusBar;
