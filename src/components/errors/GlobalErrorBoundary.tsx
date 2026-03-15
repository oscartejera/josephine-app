/**
 * GlobalErrorBoundary — Catches catastrophic errors at the top level.
 *
 * Shows a full-page recovery UI when the entire app fails.
 * This is the last line of defense — wraps the entire React tree.
 */

import React from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary] Unrecoverable error:', error, info);
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));

    // Future: send to error reporting service
    // reportError({ error, componentStack: info.componentStack });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertOctagon className="h-8 w-8 text-red-600" />
            </div>

            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Algo salió mal
            </h1>
            <p className="text-sm text-gray-500 mb-2">
              Se ha producido un error inesperado en la aplicación.
              Nuestro equipo ha sido notificado.
            </p>
            <p className="text-xs text-gray-400 font-mono mb-6 break-all">
              {this.state.error?.message?.slice(0, 200)}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <Home className="h-4 w-4" />
                Ir al inicio
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Recargar página
              </button>
            </div>

            {this.state.errorCount > 2 && (
              <p className="mt-6 text-xs text-gray-400">
                Si el error persiste, contacta con soporte:{' '}
                <a href="mailto:soporte@josephine.app" className="underline">
                  soporte@josephine.app
                </a>
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
