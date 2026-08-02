
import React, { useState, useMemo } from 'react';
import { Stethoscope, Lock, ShieldCheck, Wrench, Wallet, Eye, Delete } from 'lucide-react';
import { AppUser, ROLE_LABELS, UserRole } from '../types';
import { getUsers, login } from '../services/authService';

interface LoginScreenProps {
  onLogin: (user: AppUser) => void;
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  ADMIN: <ShieldCheck className="w-5 h-5" />,
  TEHNICIAN: <Wrench className="w-5 h-5" />,
  CONTABIL: <Wallet className="w-5 h-5" />,
  VIZUALIZARE: <Eye className="w-5 h-5" />,
};

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const users = useMemo(() => getUsers(), []);
  const [selectedId, setSelectedId] = useState<string>(users.length === 1 ? users[0].id : '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const selectedUser = users.find(u => u.id === selectedId);

  const tryLogin = (fullPin: string) => {
    if (!selectedId) return;
    const user = login(selectedId, fullPin);
    if (user) {
      onLogin(user);
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1500);
    }
  };

  const pressDigit = (d: string) => {
    if (!selectedId || pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    // Auto-submit at 4+ digits if it matches, or at 6 regardless
    if (next.length >= 4) {
      const user = users.find(u => u.id === selectedId);
      if (user && user.pin === next) tryLogin(next);
      else if (next.length === 6) tryLogin(next);
    }
  };

  return (
    <div className="theme-static fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-[900]">
      <div className="w-full max-w-sm space-y-8 animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-2xl shadow-blue-600/30">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">MediTrack</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.25em] mt-1">Hospital Device Manager</p>
          </div>
        </div>

        {/* User selection */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Selecteaza utilizatorul</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
            {users.map(u => (
              <button key={u.id} onClick={() => { setSelectedId(u.id); setPin(''); }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition text-left ${selectedId === u.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}>
                <div className={`p-2 rounded-xl ${selectedId === u.id ? 'bg-white/20' : 'bg-white/5'}`}>
                  {ROLE_ICONS[u.role]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate">{u.name}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedId === u.id ? 'text-white/60' : 'text-white/30'}`}>{ROLE_LABELS[u.role]}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PIN pad */}
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Lock className={`w-4 h-4 ${error ? 'text-red-400' : 'text-white/30'}`} />
              <div className="flex gap-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`w-3 h-3 rounded-full transition ${error ? 'bg-red-500 animate-pulse' : i < pin.length ? 'bg-blue-400' : 'bg-white/15'}`} />
                ))}
                {pin.length > 4 && <span className="text-white/40 text-xs font-black">+{pin.length - 4}</span>}
              </div>
            </div>
            {error && <p className="text-center text-red-400 text-[10px] font-black uppercase tracking-widest">PIN incorect</p>}
            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => (
                key === '' ? <div key={i} /> :
                key === 'del' ? (
                  <button key={i} onClick={() => setPin(p => p.slice(0, -1))}
                    className="py-4 bg-white/5 hover:bg-white/10 text-white/50 rounded-2xl transition flex items-center justify-center active:scale-95">
                    <Delete className="w-5 h-5" />
                  </button>
                ) : (
                  <button key={i} onClick={() => pressDigit(key)}
                    className="py-4 bg-white/5 hover:bg-white/15 text-white text-lg font-black rounded-2xl transition active:scale-95">
                    {key}
                  </button>
                )
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[9px] text-white/20 font-bold uppercase tracking-widest">
          Prima utilizare: Administrator · PIN 1234
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
