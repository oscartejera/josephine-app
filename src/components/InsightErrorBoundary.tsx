/**
 * InsightErrorBoundary — Catches runtime errors per Insight page.
 *
 * Instead of showing an infinite spinner or white page, shows a
 * clear error message with the RPC name and error details.
 * The user can retry or navigate away.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    pageName: string;
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class InsightErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[InsightErrorBoundary] ${this.props.pageName}:`, error, info);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            const isRpcError = this.state.error?.name === 'RpcContractError';

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
                    <div className="rounded-full bg-amber-100 p-4 mb-4">
                        <AlertTriangle className="h-8 w-8 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {this.props.pageName} — Error al cargar datos
                    </h3>
                    <p className="text-sm text-gray-500 max-w-md mb-1">
                        {isRpcError
                            ? 'Los datos del servidor no coinciden con el formato esperado. Esto suele pasar tras un cambio en la base de datos.'
                            : 'Se produjo un error inesperado al cargar esta sección.'}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mb-6 max-w-lg break-all">
                        {this.state.error?.message?.slice(0, 200)}
                    </p>
                    <Button
                        onClick={this.handleRetry}
                        variant="outline"
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Reintentar
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
