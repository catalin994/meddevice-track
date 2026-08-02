
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Cpu, Receipt, CheckSquare, LayoutDashboard, List, CalendarRange, Wallet, Settings, CornerDownLeft, Tag } from 'lucide-react';
import { MedicalDevice, MedicalTask, Invoice, ViewState } from '../types';

interface CommandPaletteProps {
  devices: MedicalDevice[];
  tasks: MedicalTask[];
  invoices: Invoice[];
  canFinance: boolean;
  onNavigate: (view: ViewState) => void;
  onSelectDevice: (id: string) => void;
  onClose: () => void;
}

interface PaletteItem {
  key: string;
  group: 'Navigare' | 'Dispozitive' | 'Tichete' | 'Facturi';
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ devices, tasks, invoices, canFinance, onNavigate, onSelectDevice, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo((): PaletteItem[] => {
    const q = query.toLowerCase().trim();

    const nav: PaletteItem[] = ([
      ['DASHBOARD', 'Dashboard', <LayoutDashboard className="w-4 h-4" />],
      ['INVENTORY', 'Inventar', <List className="w-4 h-4" />],
      ['TASKS', 'Tichete service', <CheckSquare className="w-4 h-4" />],
      ['PLANNER', 'Mentenanta', <CalendarRange className="w-4 h-4" />],
      ...(canFinance ? [['FINANCE', 'Financiar', <Wallet className="w-4 h-4" />]] as any : []),
      ['SETTINGS', 'Configurare', <Settings className="w-4 h-4" />],
    ] as [ViewState, string, React.ReactNode][])
      .filter(([, label]) => !q || label.toLowerCase().includes(q))
      .map(([view, label, icon]) => ({
        key: `nav-${view}`,
        group: 'Navigare' as const,
        icon,
        title: label,
        subtitle: 'Deschide pagina',
        action: () => { onNavigate(view); onClose(); },
      }));

    if (!q) return nav;

    const matchedDevices: PaletteItem[] = devices
      .filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.serialNumber.toLowerCase().includes(q) ||
        d.model?.toLowerCase().includes(q) ||
        d.department?.toLowerCase().includes(q) ||
        (d.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 8)
      .map(d => ({
        key: `dev-${d.id}`,
        group: 'Dispozitive' as const,
        icon: <Cpu className="w-4 h-4" />,
        title: d.name,
        subtitle: `SN: ${d.serialNumber} · ${d.department}`,
        action: () => { onSelectDevice(d.id); onClose(); },
      }));

    const matchedTasks: PaletteItem[] = tasks
      .filter(t => t.title.toLowerCase().includes(q) || t.deviceName?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(t => ({
        key: `task-${t.id}`,
        group: 'Tichete' as const,
        icon: <CheckSquare className="w-4 h-4" />,
        title: t.title,
        subtitle: `${t.status} · ${t.department}`,
        action: () => { onNavigate('TASKS'); onClose(); },
      }));

    const matchedInvoices: PaletteItem[] = canFinance ? invoices
      .filter(i => i.invoiceNumber.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q))
      .slice(0, 5)
      .map(i => ({
        key: `inv-${i.id}`,
        group: 'Facturi' as const,
        icon: <Receipt className="w-4 h-4" />,
        title: `${i.invoiceNumber} · ${i.supplier}`,
        subtitle: `${i.amount.toLocaleString('ro-RO')} ${i.currency} · ${i.issueDate}`,
        action: () => { onNavigate('FINANCE'); onClose(); },
      })) : [];

    return [...matchedDevices, ...matchedTasks, ...matchedInvoices, ...nav];
  }, [query, devices, tasks, invoices, canFinance, onNavigate, onSelectDevice, onClose]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[activeIndex]?.action(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }, [items, activeIndex, onClose]);

  // Keep active item in view
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[700] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-300 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cauta dispozitive, facturi, tichete sau pagini..."
            className="flex-1 text-sm font-bold outline-none placeholder:text-slate-300 placeholder:font-medium"
          />
          <kbd className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase">Esc</kbd>
        </div>

        <div ref={listRef} className="palette-shell overflow-y-auto overscroll-contain p-2">
          {items.length === 0 && (
            <p className="py-10 text-center text-xs font-bold text-slate-300 uppercase tracking-widest">Niciun rezultat</p>
          )}
          {items.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <React.Fragment key={item.key}>
                {showGroup && (
                  <p className="px-3 pt-3 pb-1.5 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">{item.group}</p>
                )}
                <button
                  data-idx={idx}
                  onClick={item.action}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${idx === activeIndex ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <div className={`p-1.5 rounded-lg ${idx === activeIndex ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate">{item.title}</p>
                    {item.subtitle && <p className={`text-[10px] font-bold truncate ${idx === activeIndex ? 'text-white/60' : 'text-slate-400'}`}>{item.subtitle}</p>}
                  </div>
                  {idx === activeIndex && <CornerDownLeft className="w-3.5 h-3.5 shrink-0 text-white/60" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">↑↓ navigheaza</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">↵ deschide</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
