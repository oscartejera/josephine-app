/**
 * Lightspeed Integration Page
 * OAuth flow + sync management
 * Pattern: Adapted from SquareIntegration.tsx
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import {
    Zap, Plug2, RefreshCw, CheckCircle, XCircle, AlertCircle,
    ChevronLeft, Loader2, ExternalLink, Unplug
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Integration {
    id: string;
    org_id: string;
    provider: string;
    is_enabled: boolean;
    status: string;
    metadata: Record<string, unknown> | null;
}

interface IntegrationAccount {
    id: string;
    display_name: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

interface SyncRun {
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    error: string | null;
    cursor: string | null;
}

function statusLabel(status: string): string {
    switch (status) {
        case 'active': return 'Conectado';
        case 'inactive': return 'Desconectado';
        case 'pending': return 'Pendiente';
        case 'running': return 'Sincronizando';
        case 'success': return 'Completado';
        case 'failed': case 'error': return 'Error';
        default: return status;
    }
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'active': case 'success': return 'default';
        case 'running': case 'pending': return 'secondary';
        case 'failed': case 'error': return 'destructive';
        default: return 'outline';
    }
}

export default function LightspeedIntegration() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { selectedLocationId } = useApp();

    const [integration, setIntegration] = useState<Integration | null>(null);
    const [account, setAccount] = useState<IntegrationAccount | null>(null);
    const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Load integration data
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Get or create Lightspeed integration
            let { data: int } = await supabase
                .from('integrations')
                .select('*')
                .eq('provider', 'lightspeed')
                .single();

            if (!int) {
                // Auto-create one
                const { data: newInt } = await (supabase
                    .from('integrations')
                    .insert({
                        provider: 'lightspeed',
                        is_enabled: false,
                        status: 'inactive',
                    } as any)
                    .select()
                    .single() as any);
                int = newInt;
            }

            setIntegration(int as any);

            if (int) {
                // Get account
                const { data: acc } = await supabase
                    .from('integration_accounts')
                    .select('*')
                    .eq('provider', 'lightspeed')
                    .limit(1)
                    .single();
                setAccount(acc as any);

                // Get sync runs
                const { data: runs } = await supabase
                    .from('integration_sync_runs')
                    .select('*')
                    .eq('integration_id', int.id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                setSyncRuns((runs || []) as any);
            }
        } catch (e) {
            console.error('Load Lightspeed data error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Show success toast if just connected
    useEffect(() => {
        if (searchParams.get('connected') === 'true') {
            toast.success('¡Lightspeed conectado correctamente!');
        }
    }, [searchParams]);

    // Connect with Lightspeed (OAuth start)
    const handleConnect = async () => {
        if (!integration) return;
        setConnecting(true);
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/lightspeed-oauth-start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    integrationId: integration.id,
                    appUrl: window.location.origin,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to start OAuth');
            }

            const { authUrl } = await response.json();
            window.location.href = authUrl;
        } catch (e: any) {
            toast.error('Error al iniciar conexión: ' + e.message);
            setConnecting(false);
        }
    };

    // Manual sync
    const handleSync = async () => {
        if (!integration) return;
        setSyncing(true);
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/lightspeed-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    integrationId: integration.id,
                    lookback_days: 30,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Sync failed');
            }

            toast.success('Sincronización completada');
            loadData();
        } catch (e: any) {
            toast.error('Error en sincronización: ' + e.message);
        } finally {
            setSyncing(false);
        }
    };

    // Disconnect
    const handleDisconnect = async () => {
        if (!integration) return;
        if (!confirm('¿Desconectar Lightspeed? Los datos sincronizados se mantendrán.')) return;

        await supabase.from('integrations').update({
            status: 'inactive',
            is_enabled: false,
        }).eq('id', integration.id);

        toast.success('Lightspeed desconectado');
        loadData();
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const isConnected = integration?.status === 'active';

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/integrations')}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <Zap className="h-6 w-6 text-yellow-500" />
                        Lightspeed Restaurant
                    </h1>
                    <p className="text-muted-foreground">
                        Sincroniza ventas, menú y empleados desde Lightspeed POS
                    </p>
                </div>
                {integration && (
                    <Badge variant={statusVariant(integration.status)} className="text-sm">
                        {statusLabel(integration.status)}
                    </Badge>
                )}
            </div>

            {/* Connection Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plug2 className="h-5 w-5" />
                        Conexión
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isConnected && account ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                                <CheckCircle className="h-6 w-6 text-emerald-500" />
                                <div>
                                    <p className="font-medium">{account.display_name || 'Lightspeed Business'}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Conectado el {format(new Date(account.created_at), "d MMM yyyy", { locale: es })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={handleSync} disabled={syncing}>
                                    <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                                </Button>
                                <Button variant="outline" onClick={handleDisconnect} className="text-red-600">
                                    <Unplug className="h-4 w-4 mr-2" />
                                    Desconectar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-muted-foreground">
                                Conecta tu cuenta de Lightspeed Restaurant para sincronizar automáticamente tus datos de ventas, menú y empleados.
                            </p>
                            <Button size="lg" onClick={handleConnect} disabled={connecting}>
                                {connecting ? (
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                ) : (
                                    <Zap className="h-5 w-5 mr-2" />
                                )}
                                {connecting ? 'Conectando...' : 'Conectar con Lightspeed'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Sync History */}
            {syncRuns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <RefreshCw className="h-5 w-5" />
                            Historial de Sincronización
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {syncRuns.map(run => {
                                let stats: Record<string, number> = {};
                                try { stats = JSON.parse(run.cursor || '{}'); } catch { }
                                return (
                                    <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {run.status === 'success' ? (
                                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                            ) : run.status === 'running' ? (
                                                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
                                            )}
                                            <div>
                                                <p className="text-sm font-medium">{statusLabel(run.status)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(run.started_at), "d MMM HH:mm", { locale: es })}
                                                    {stats.sales != null && ` · ${stats.sales} ventas`}
                                                    {stats.items != null && ` · ${stats.items} productos`}
                                                </p>
                                            </div>
                                        </div>
                                        {run.error && (
                                            <span className="text-xs text-red-500 max-w-[200px] truncate" title={run.error}>
                                                {run.error}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle>¿Qué se sincroniza?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong>Ventas</strong> — Transacciones diarias, tickets, pagos</li>
                        <li><strong>Menú</strong> — Productos, categorías, precios</li>
                        <li><strong>Empleados</strong> — Staff, roles, turnos</li>
                    </ul>
                    <p>Los datos se normalizan al modelo canónico de Josephine (CDM) para análisis unificado.</p>
                </CardContent>
            </Card>
        </div>
    );
}
