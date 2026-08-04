import React from 'react';

declare const __BUILD_ID__: string;

/**
 * The last line of defence.
 *
 * Without this, a single render error anywhere in the tree unmounts everything
 * and leaves a blank white page — no message, no way back. On a phone in a
 * ward that reads as "the app is broken", and the only recovery anyone will
 * find is closing the tab.
 *
 * The local database is untouched by a render crash, so reloading almost
 * always works and loses nothing.
 */

interface State {
  error: Error | null;
  info: string;
  copied: boolean;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, info: '', copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Biomedic] Eroare neasteptata:', error, info);
    this.setState({ info: info.componentStack || '' });
  }

  private report = () => {
    const { error, info } = this.state;
    const text = [
      `Biomedic — raport eroare`,
      `Versiune: ${typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'necunoscuta'}`,
      `Adresa: ${window.location.href}`,
      `Browser: ${navigator.userAgent}`,
      '',
      `${error?.name}: ${error?.message}`,
      error?.stack || '',
      info,
    ].join('\n');
    navigator.clipboard?.writeText(text).then(
      () => { this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 2500); },
      () => { /* clipboard blocked — the details are on screen anyway */ },
    );
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fixed inset-0 z-[1000] app-bg flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 py-8">
          <div className="w-16 h-16 mx-auto bg-red-50 border-2 border-red-100 rounded-3xl flex items-center justify-center">
            {/* No icon library here: if the crash came from a bad import, a
                dependency would take this screen down with it. */}
            <span className="text-3xl" role="img" aria-label="Atentie">⚠️</span>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-xl font-extrabold text-slate-900">Aplicatia s-a oprit neasteptat</h1>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">
              Datele salvate pe acest telefon sunt intacte — nu s-a pierdut nimic.
              O reincarcare rezolva aproape intotdeauna problema.
            </p>
          </div>

          <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Detaliu tehnic</p>
            <p className="text-xs font-mono text-slate-600 break-words">
              {error.name}: {error.message}
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition active:scale-95"
            >
              Reincarca aplicatia
            </button>
            <button
              onClick={this.report}
              className="w-full py-3.5 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-[13px] transition hover:bg-slate-50 active:scale-95"
            >
              {copied ? 'Copiat — trimite-l dezvoltatorului' : 'Copiaza detaliile erorii'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
