/**
 * ModuleErrorBoundary — Inline error boundary for page sections.
 *
 * Shows a compact error card instead of taking over the whole page.
 * Auto-retries with exponential backoff (1s → 2s → 4s, max 3 retries).
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  moduleName: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  retrying: boolean;
}

const MAX_RETRIES = 3;

export class ModuleErrorBoundary extends React.Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, retrying: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ModuleErrorBoundary] ${this.props.moduleName}:`, error, info);
    this.scheduleRetry();
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  scheduleRetry = () => {
    if (this.state.retryCount >= MAX_RETRIES) return;

    const delay = Math.pow(2, this.state.retryCount) * 1000; // 1s, 2s, 4s
    this.setState({ retrying: true });

    this.retryTimer = setTimeout(() => {
      this.setState(prev => ({
        hasError: false,
        error: null,
        retryCount: prev.retryCount + 1,
        retrying: false,
      }));
    }, delay);
  };

  handleManualRetry = () => {
    this.setState({ hasError: false, error: null, retryCount: 0, retrying: false });
  };

  render() {
    if (this.state.hasError) {
      const canAutoRetry = this.state.retryCount < MAX_RETRIES;

      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                Error en {this.props.moduleName}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {this.state.retrying && canAutoRetry
                  ? t('common.autoRetrying', { current: this.state.retryCount + 1, max: MAX_RETRIES })
                  : this.state.retryCount >= MAX_RETRIES
                    ? t('common.autoRetriesExhausted')
                    : this.state.error?.message?.slice(0, 120)}
              </p>
            </div>
            <button
              onClick={this.handleManualRetry}
              disabled={this.state.retrying}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 transition-colors shrink-0"
            >
              {this.state.retrying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
