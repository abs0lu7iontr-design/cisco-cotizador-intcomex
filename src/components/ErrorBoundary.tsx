import React from 'react';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  resetKeys?: ReadonlyArray<unknown>;
  maxRetries?: number;
  onReset?: () => void;
  onReturnToSafeView?: () => void;
  safeViewLabel?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  lastErrorSignature: string | null;
}

export function shouldAllowErrorBoundaryRetry(
  retryCount: number,
  maxRetries: number = 3
): boolean {
  return retryCount < Math.max(1, maxRetries);
}

export function haveResetKeysChanged(
  prevKeys?: ReadonlyArray<unknown>,
  nextKeys?: ReadonlyArray<unknown>
): boolean {
  if (prevKeys === nextKeys) return false;
  if (!prevKeys || !nextKeys) return Boolean(prevKeys) !== Boolean(nextKeys);
  if (prevKeys.length !== nextKeys.length) return true;
  for (let i = 0; i < prevKeys.length; i++) {
    if (!Object.is(prevKeys[i], nextKeys[i])) {
      return true;
    }
  }
  return false;
}

interface TypedReactComponent<P, S> {
  new (props: P): {
    readonly props: P;
    state: S;
    setState: (
      updater: Partial<S> | ((prevState: S) => Partial<S>),
      callback?: () => void
    ) => void;
    render(): React.ReactNode;
  };
}

const BaseReactComponent =
  React.Component as unknown as TypedReactComponent<ErrorBoundaryProps, ErrorBoundaryState>;

export class ErrorBoundary extends BaseReactComponent {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    retryCount: 0,
    lastErrorSignature: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorSignature: `${error?.name || 'Error'}:${error?.message || ''}`,
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && haveResetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({
        hasError: false,
        error: null,
        retryCount: 0,
        lastErrorSignature: null,
      });
    }
  }

  public handleReset = (): void => {
    const maxRetries = this.props.maxRetries ?? 3;
    if (!shouldAllowErrorBoundaryRetry(this.state.retryCount, maxRetries)) {
      return;
    }
    this.setState(
      (prevState) => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1,
      }),
      () => {
        this.props.onReset?.();
      }
    );
  };

  public handleReturnToSafeView = (): void => {
    this.setState(
      {
        hasError: false,
        error: null,
        retryCount: 0,
        lastErrorSignature: null,
      },
      () => {
        this.props.onReturnToSafeView?.();
      }
    );
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      const maxRetries = this.props.maxRetries ?? 3;
      const canRetry = shouldAllowErrorBoundaryRetry(this.state.retryCount, maxRetries);

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="p-6 my-4 bg-slate-900/90 border border-rose-600/40 rounded-2xl text-slate-200 shadow-xl space-y-3"
        >
          <div className="flex items-center space-x-2.5 text-rose-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{this.props.fallbackTitle || 'Error en el componente visual'}</span>
          </div>
          <p className="text-xs text-slate-400 font-mono bg-slate-950/80 p-3 rounded-xl border border-slate-800 break-words">
            {this.state.error?.message || 'Se produjo un error inesperado al renderizar esta sección.'}
          </p>
          {!canRetry && (
            <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3 py-2 rounded-xl">
              Se alcanzó el límite de reintentos automáticos ({maxRetries}) para evitar un bucle de error determinista. Tus datos y cotización activa permanecen intactos en memoria.
            </p>
          )}
          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            {canRetry && (
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  Reintentar Sección
                  {this.state.retryCount > 0 ? ` (${this.state.retryCount}/${maxRetries})` : ''}
                </span>
              </button>
            )}
            {this.props.onReturnToSafeView && (
              <button
                type="button"
                onClick={this.handleReturnToSafeView}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center space-x-2 border border-emerald-500/40 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{this.props.safeViewLabel || 'Volver a Vista Segura (Conservar Cotización)'}</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

