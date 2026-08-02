
import React, { useState, useCallback } from 'react';
import { Stethoscope, Lock, Delete, Mail, KeyRound, Loader2, UserPlus, ArrowLeft, ShieldAlert, LogOut, Terminal, Copy, Check, X } from 'lucide-react';
import { AppUser } from '../types';
import {
  signIn, signUp, signOut,
  hasDeviceLock, setDeviceLock, verifyDeviceLock,
} from '../services/authService';
import { SECURITY_SQL } from '../services/authSql';

interface LoginScreenProps {
  onLogin: (user: AppUser) => void;
  /** Set when a session already exists and only the screen lock is in the way. */
  lockedUser?: AppUser | null;
}

type Mode = 'signin' | 'signup' | 'setPin' | 'unlock';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="theme-static fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-[900] overflow-y-auto">
    <div className="w-full max-w-sm space-y-8 animate-slide-up py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-blue-600 p-4 rounded-3xl shadow-2xl shadow-blue-600/30">
          <Stethoscope className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">MediTrack</h1>
          <p className="text-[11px] font-bold text-white/40 tracking-[0.2em] mt-1">Management echipamente medicale</p>
        </div>
      </div>
      {children}
    </div>
  </div>
);

const field =
  'w-full pl-11 pr-4 py-3.5 bg-white/5 border-2 border-white/10 rounded-2xl text-white text-[15px] font-semibold ' +
  'placeholder:text-white/25 outline-none focus:border-blue-500 transition-colors';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, lockedUser = null }) => {
  const [mode, setMode] = useState<Mode>(lockedUser ? 'unlock' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pending, setPending] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Reachable before signing in on purpose: on a fresh database nobody can
  // log in until this script has been run, so it cannot live behind the login.
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);

  const finish = useCallback((user: AppUser) => {
    // Offer the quick unlock once per device, then never ask again.
    if (hasDeviceLock()) { onLogin(user); return; }
    setPending(user);
    setPin('');
    setConfirmPin('');
    setMode('setPin');
  }, [onLogin]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const res = await signIn(email, password);
    setBusy(false);
    if (res.ok && res.user) finish(res.user);
    else setError(res.error || 'Autentificare esuata.');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const res = await signUp(email, password, name);
    setBusy(false);
    const message = res.error || '';
    if (res.ok && res.user) finish(res.user);
    else if (/Cont creat/i.test(message)) { setNotice(message); setMode('signin'); }
    else setError(message || 'Inregistrare esuata.');
  };

  const pressDigit = async (d: string) => {
    if (busy) return;
    const target = mode === 'setPin' && pin.length === 4 ? confirmPin : pin;
    if (target.length >= 4) return;
    const next = target + d;

    if (mode === 'unlock') {
      setPin(next);
      if (next.length === 4) {
        setBusy(true);
        const ok = await verifyDeviceLock(next);
        setBusy(false);
        if (ok && lockedUser) onLogin(lockedUser);
        else { setError('PIN incorect'); setPin(''); setTimeout(() => setError(''), 1500); }
      }
      return;
    }

    // setPin: first four digits, then four more to confirm
    if (pin.length < 4) {
      setPin(next);
      return;
    }
    setConfirmPin(next);
    if (next.length === 4) {
      if (next === pin) {
        setBusy(true);
        await setDeviceLock(next);
        setBusy(false);
        if (pending) onLogin(pending);
      } else {
        setError('PIN-urile nu se potrivesc');
        setPin(''); setConfirmPin('');
        setTimeout(() => setError(''), 1800);
      }
    }
  };

  const backspace = () => {
    if (mode === 'setPin' && pin.length === 4 && confirmPin.length > 0) setConfirmPin(c => c.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  };

  const shown = mode === 'setPin' && pin.length === 4 ? confirmPin : pin;

  /* ── PIN pad: unlock and first-time setup ─────────────────────────────── */
  if (mode === 'unlock' || mode === 'setPin') {
    const heading = mode === 'unlock'
      ? `Bine ai revenit, ${lockedUser?.name?.split(' ')[0] || ''}`
      : pin.length < 4 ? 'Alege un PIN de 4 cifre' : 'Confirma PIN-ul';
    const sub = mode === 'unlock'
      ? 'Introdu PIN-ul de pe acest telefon'
      : 'Il vei folosi ca sa redeschizi aplicatia pe acest telefon';

    return (
      <Shell>
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <p className="text-white font-bold text-[15px]">{heading}</p>
            <p className="text-white/40 text-xs font-semibold">{sub}</p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Lock className={`w-4 h-4 ${error ? 'text-red-400' : 'text-white/30'}`} />
            <div className="flex gap-2.5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-3.5 h-3.5 rounded-full transition ${
                  error ? 'bg-red-500' : i < shown.length ? 'bg-blue-400' : 'bg-white/15'
                }`} />
              ))}
            </div>
          </div>
          {error && <p className="text-center text-red-400 text-xs font-bold">{error}</p>}

          <div className="grid grid-cols-3 gap-2.5">
            {['1','2','3','4','5','6','7','8','9','','0','del'].map((key, i) =>
              key === '' ? <div key={i} /> :
              key === 'del' ? (
                <button key={i} onClick={backspace} aria-label="Sterge ultima cifra"
                  className="py-4 bg-white/5 hover:bg-white/10 text-white/50 rounded-2xl transition flex items-center justify-center active:scale-95">
                  <Delete className="w-5 h-5" />
                </button>
              ) : (
                <button key={i} onClick={() => pressDigit(key)}
                  className="py-4 bg-white/5 hover:bg-white/15 text-white text-xl font-bold rounded-2xl transition active:scale-95">
                  {key}
                </button>
              )
            )}
          </div>

          {mode === 'setPin' ? (
            <button onClick={() => pending && onLogin(pending)}
              className="w-full text-center text-white/40 hover:text-white/70 text-xs font-bold transition">
              Sari peste — cer parola de fiecare data
            </button>
          ) : (
            <button
              onClick={async () => { await signOut(); window.location.reload(); }}
              className="w-full flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Intra cu alt cont
            </button>
          )}
        </div>
      </Shell>
    );
  }

  /* ── Email + parola ───────────────────────────────────────────────────── */
  const isSignUp = mode === 'signup';
  return (
    <Shell>
      <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
        <p className="text-white/50 text-xs font-bold tracking-wide px-1">
          {isSignUp ? 'Cont nou' : 'Autentificare'}
        </p>

        {isSignUp && (
          <div className="relative">
            <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input required value={name} onChange={e => setName(e.target.value)}
              placeholder="Nume complet" autoComplete="name" className={field} />
          </div>
        )}

        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" autoComplete="email" inputMode="email" className={field} />
        </div>

        <div className="relative">
          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={isSignUp ? 'Parola (min. 6 caractere)' : 'Parola'}
            autoComplete={isSignUp ? 'new-password' : 'current-password'} className={field} />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs font-semibold leading-relaxed">{error}</p>
          </div>
        )}
        {notice && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <p className="text-emerald-300 text-xs font-semibold leading-relaxed">{notice}</p>
          </div>
        )}

        <button type="submit" disabled={busy}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition active:scale-95 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSignUp ? 'Creeaza contul' : 'Intra in aplicatie'}
        </button>

        <button type="button" onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(''); setNotice(''); }}
          className="w-full flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-xs font-bold transition pt-1">
          {isSignUp ? <><ArrowLeft className="w-3.5 h-3.5" /> Am deja cont</> : 'Nu ai cont? Inregistreaza-te'}
        </button>
      </form>

      {!isSignUp && (
        <p className="text-center text-[11px] text-white/25 font-semibold leading-relaxed px-4">
          Conturile noi trebuie aprobate de un administrator inainte de a vedea datele.
        </p>
      )}

      <button type="button" onClick={() => setShowSetup(true)}
        className="w-full flex items-center justify-center gap-2 text-white/25 hover:text-white/50 text-[11px] font-bold transition">
        <Terminal className="w-3.5 h-3.5" /> Prima instalare — script baza de date
      </button>

      {showSetup && (
        <div className="fixed inset-0 z-[950] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85dvh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <h2 className="text-white font-bold text-[15px]">Script pentru baza de date</h2>
                <p className="text-white/40 text-xs font-semibold mt-0.5">
                  Supabase Dashboard → SQL Editor → lipeste → RUN
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { navigator.clipboard.writeText(SECURITY_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiat' : 'Copiaza'}
                </button>
                <button onClick={() => setShowSetup(false)} aria-label="Inchide"
                  className="p-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar">
              <p className="text-[13px] text-amber-300 font-semibold mb-4 leading-relaxed">
                Primul cont inregistrat dupa rularea scriptului devine automat Administrator aprobat.
              </p>
              <pre className="text-[11px] font-mono text-blue-100 whitespace-pre-wrap break-all leading-relaxed">{SECURITY_SQL}</pre>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
};

export default LoginScreen;
