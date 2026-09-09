import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any)<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    (this as any).setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 bg-slate-900/90 border border-rose-600/40 rounded-2xl text-slate-200 shadow-xl space-y-3">
          <div className="flex items-center space-x-2.5 text-rose-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{(this as any).props.fallbackTitle || 'Error en el componente visual'}</span>
          </div>
          <p className="text-xs text-slate-400 font-mono bg-slate-950/80 p-3 rounded-xl border border-slate-800 break-words">
            {this.state.error?.message || 'Se produjo un error inesperado al renderizar esta sección.'}
          </p>
          <div className="pt-1">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar Sección</span>
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
