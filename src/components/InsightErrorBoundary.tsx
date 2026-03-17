/**
 * InsightErrorBoundary — Catches runtime errors per Insight page.
 *
 * Instead of showing an infinite spinner or white page, shows a
 * clear error message with the RPC name and error details.
 * Auto-retries with exponential backoff (1s → 2s → 4s, max 3).
 * The user can also retry manually or navigate away.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface Props {
    pageName: string;
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    retryCount: number;
    retrying: boolean;
}

const MAX_RETRIES = 3;

export class InsightErrorBoundary extends React.Component<Props, State> {
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, retryCount: 0, retrying: false };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[InsightErrorBoundary] ${this.props.pageName}:`, error, info);
        this.scheduleAutoRetry();
    }

    componentWillUnmount() {
        if (this.retryTimer) clearTimeout(this.retryTimer);
    }

    scheduleAutoRetry = () => {
        if (this.state.retryCount >= MAX_RETRIES) return;

        const delay = Math.pow(2, this.state.retryCount) * 1000;
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

    handleRetry = () => {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.setState({ hasError: false, error: null, retryCount: 0, retrying: false });
    };

    render() {
        if (this.state.hasError) {
            const isRpcError = this.state.error?.name === 'RpcContractError';
            const autoRetriesExhausted = this.state.retryCount >{t('insightErrorBoundary.maxretriesReturn')}
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
                    <div className="rounded-full bg-amber-100 p-4 mb-4">
                        {this.state.retrying ? (
                            <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
                        ) : (
                            <AlertTriangle className="h-8 w-8 text-amber-600" />
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {this.state.retrying
                            ? `${this.props.pageName} — Reintentando…`
                            : t('common.errorLoadingData', { pageName: this.props.pageName })}
                    </h3>
                    <p className="text-sm text-gray-500 max-w-md mb-1">
                        {this.state.retrying
                            ? t('common.autoRetryCount', { current: this.state.retryCount + 1, max: MAX_RETRIES })
                            : isRpcError
                                ? 'Los datos del servidor no coinciden con el formato esperado. Esto suele pasar tras un cambio en la base de datos.'
                                : autoRetriesExhausted
                                    ? t('common.autoRetryExhausted')
                                    : t('common.unexpectedSectionError')}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mb-6 max-w-lg break-all">
                        {this.state.error?.message?.slice(0, 200)}
                    </p>
                    <Button
                        onClick={this.handleRetry}
                        variant="outline"
                        className="gap-2"
                        disabled={this.state.retrying}
                    >
                        <RefreshCw className="h-4 w-4" />
                        {t('insightErrorBoundary.reintentar')}
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
