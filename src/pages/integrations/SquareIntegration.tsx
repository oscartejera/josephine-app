/**
 * Square Integration Page
 * Real OAuth flow + sync management with animated progress bar and splash screen.
 *
 * DB SCHEMA (current):
 *   integrations:          { id, org_id, provider, is_enabled, status, metadata, created_at }
 *   integration_accounts:  { id, integration_id, external_account_id, display_name, metadata, created_at, org_id, provider }
 *   integration_sync_runs: { id, integration_id, status(sync_status), started_at, finished_at, error, cursor, created_at }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Plug2, RefreshCw, Loader2, ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import SyncSplashScreen from '@/components/integrations/SyncSplashScreen';
import { useTranslation } from 'react-i18next';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Max time to wait for the sync Edge Function (ms). */
const SYNC_TIMEOUT_MS = 300_000; // 5 minutes (initial sync pulls up to 365 days)
const MANUAL_SYNC_TIMEOUT_MS = 180_000; // 3 minutes for manual re-syncs

/** Call an Edge Function with a timeout via AbortController. */
async function invokeEdgeFunction(name: string, body: Record<string, unknown>, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Edge Function ${name} failed (${resp.status})`);
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('La sincronización está tardando demasiado. Verifica el historial en unos minutos.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Types matching CURRENT DB schema
// ---------------------------------------------------------------------------
interface Integration {
  id: string;
  org_id: string;
  provider: string;
  is_enabled: boolean;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface IntegrationAccount {
  id: string;
  integration_id: string;
  external_account_id: string;
  display_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  org_id: string;
  provider: string;
}

/** sync_status enum: 'queued' | 'running' | 'success' | 'error' */
interface SyncRun {
  id: string;
  integration_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  created_at: string;
}

// Sync phases for the progress bar
const SYNC_PHASES = [
  { label: 'Conectando con Square...', target: 10, durationMs: 3_000 },
  { label: 'Importando locales...', target: 20, durationMs: 5_000 },
  { label: 'Importando catálogo...', target: 40, durationMs: 15_000 },
  { label: 'Importando pedidos...', target: 70, durationMs: 60_000 },
  { label: 'Procesando datos...', target: 90, durationMs: 40_000 },
];

/** True when the sync status represents a terminal state. */
function isSyncDone(status: string): boolean {
  return ['success', 'error', 'failed'].includes(status);
}

/** True when the sync status is a success. */
function isSyncSuccess(status: string): boolean {
  return status === 'success';
}

/** Human-readable label for each status. */
function statusLabel(status: string): string {
  switch (status) {
    case 'success': return 'OK';
    case 'running': return 'En curso';
    case 'queued': return 'En cola';
    case 'error':
    case 'failed': return 'Error';
    default: return status;
  }
}

/** Badge variant for each status. */
function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'success': return 'default';
    case 'running':
    case 'queued': return 'secondary';
    case 'error':
    case 'failed': return 'destructive';
    default: return 'outline';
  }
}

export default function SquareIntegration() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { group } = useApp();
  const orgId = group?.id || profile?.group_id || null;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [account, setAccount] = useState<IntegrationAccount | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Progress bar state
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncPhaseLabel, setSyncPhaseLabel] = useState('');
  const [syncComplete, setSyncComplete] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval>>();

  // Splash screen state
  const [showSplash, setShowSplash] = useState(false);
  const [splashMessage, setSplashMessage] = useState('');
  const splashSafetyTimer = useRef<ReturnType<typeof setTimeout>>();

  /** Show splash with an auto-dismiss safety net. */
  const showSplashScreen = useCallback((msg: string, maxMs = 8_000) => {
    setSplashMessage(msg);
    setShowSplash(true);
    if (splashSafetyTimer.current) clearTimeout(splashSafetyTimer.current);
    splashSafetyTimer.current = setTimeout(() => {
      setShowSplash(false);
    }, maxMs);
  }, []);

  const hideSplashScreen = useCallback(() => {
    if (splashSafetyTimer.current) clearTimeout(splashSafetyTimer.current);
    setShowSplash(false);
  }, []);

  const startProgressAnimation = useCallback(() => {
    setSyncProgress(0);
    setSyncComplete(false);
    let phase = 0;
    let current = 0;
    let elapsedInPhase = 0;
    setSyncPhaseLabel(SYNC_PHASES[0].label);

    progressTimer.current = setInterval(() => {
      const { target, durationMs } = SYNC_PHASES[phase] ?? { target: 90, durationMs: 40_000 };
      const prevTarget = phase > 0 ? SYNC_PHASES[phase - 1].target : 0;
      elapsedInPhase += 300;

      const phaseProgress = Math.min(elapsedInPhase / durationMs, 0.95);
      current = prevTarget + (target - prevTarget) * phaseProgress;
      setSyncProgress(Math.min(Math.round(current), 90));

      if (phaseProgress >= 0.95 && phase < SYNC_PHASES.length - 1) {
        phase++;
        elapsedInPhase = 0;
        setSyncPhaseLabel(SYNC_PHASES[phase].label);
      }
    }, 300);
  }, []);

  const completeProgressAnimation = useCallback(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setSyncProgress(100);
    setSyncPhaseLabel('Sincronización completada');
    setSyncComplete(true);
  }, []);

  const stopProgressAnimation = useCallback(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setSyncProgress(0);
    setSyncComplete(false);
    setSyncPhaseLabel('');
  }, []);

  const resetSyncState = useCallback(() => {
    stopProgressAnimation();
    setSyncing(false);
    hideSplashScreen();
  }, [stopProgressAnimation, hideSplashScreen]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (splashSafetyTimer.current) clearTimeout(splashSafetyTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load integration, accounts, and sync runs using CURRENT DB schema
  // ---------------------------------------------------------------------------
  const loadIntegration = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1) Find the Square integration for this org (any status — so reconnect works)
    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('org_id', orgId)
      .eq('provider', 'square')
      .order('created_at', { ascending: false })
      .limit(1);

    if (integrations && integrations.length > 0) {
      const integ = integrations[0] as unknown as Integration;
      setIntegration(integ);

      // 2) Load accounts: integration_accounts WHERE integration_id = integ.id
      const { data: accounts } = await supabase
        .from('integration_accounts')
        .select('*')
        .eq('integration_id', integ.id)
        .order('created_at', { ascending: false });

      if (accounts && accounts.length > 0) {
        setAccount(accounts[0] as unknown as IntegrationAccount);
      } else {
        setAccount(null);
      }

      // 3) Load sync runs: integration_sync_runs WHERE integration_id = integ.id
      const { data: runs } = await supabase
        .from('integration_sync_runs')
        .select('*')
        .eq('integration_id', integ.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setSyncRuns((runs || []) as unknown as SyncRun[]);
    } else {
      setIntegration(null);
      setAccount(null);
      setSyncRuns([]);
    }

    setLoading(false);
  }, [orgId]);

  // Initial load
  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  // ---------------------------------------------------------------------------
  // OAuth callback: ?connected=true → trigger first sync + poll
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('Square conectado correctamente', {
        description: 'Sincronización inicial en curso...',
      });
      setSyncing(true);
      startProgressAnimation();
      setSearchParams({});

      // Immediately invalidate queries so the badge updates Demo→POS
      queryClient.invalidateQueries();

      // Fire-and-forget: trigger INITIAL sync (365 days of POS history)
      if (orgId) {
        invokeEdgeFunction('square-sync', {
          org_id: orgId,
          lookback_days: 365,
          is_initial_sync: true,
        }, SYNC_TIMEOUT_MS).catch((err) => {
          console.warn('Auto-sync trigger failed (will poll for result):', err.message);
        });
      }

      // Poll integration_sync_runs until terminal state
      const poll = setInterval(async () => {
        await loadIntegration();

        if (!orgId) return;

        const { data: integ } = await supabase
          .from('integrations')
          .select('id')
          .eq('org_id', orgId)
          .eq('provider', 'square')
          .limit(1)
          .single();

        if (!integ) return;

        const { data: runs } = await supabase
          .from('integration_sync_runs')
          .select('status, error')
          .eq('integration_id', integ.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const latest = runs?.[0];
        if (!latest) return; // no run yet, keep polling

        if (isSyncDone(latest.status)) {
          clearInterval(poll);
          if (isSyncSuccess(latest.status)) {
            completeProgressAnimation();
            toast.success('Datos importados correctamente');
            setTimeout(() => {
              showSplashScreen('Cargando tus datos de Square...');
              queryClient.invalidateQueries();
              setTimeout(() => {
                hideSplashScreen();
                setSyncing(false);
              }, 2500);
            }, 1500);
          } else {
            resetSyncState();
            toast.error('Error en la sincronización inicial', {
              description: latest.error || 'Error desconocido',
            });
          }
        }
      }, 3000);

      // Safety timeout — data is likely already synced; finish gracefully
      const safetyId = setTimeout(() => {
        clearInterval(poll);
        completeProgressAnimation();
        queryClient.invalidateQueries();
        setTimeout(() => {
          hideSplashScreen();
          setSyncing(false);
          toast.info('Datos disponibles. Puedes sincronizar manualmente si necesitas actualizar.');
        }, 1500);
      }, 30_000);

      return () => {
        clearInterval(poll);
        clearTimeout(safetyId);
      };
    }

    if (searchParams.get('error')) {
      toast.error('Error conectando Square', {
        description: searchParams.get('error'),
      });
      setSearchParams({});
    }
  }, [searchParams]);

  // ---------------------------------------------------------------------------
  // Connect with Square (OAuth start)
  // ---------------------------------------------------------------------------
  const handleConnect = async () => {
    if (!orgId) {
      toast.error('No se encontró la organización. Recarga la página.');
      return;
    }

    setConnecting(true);

    try {
      // Reuse existing integration (any status) or create one via upsert
      let integrationId = integration?.id;

      if (!integrationId) {
        const { data: newInteg, error } = await supabase
          .from('integrations')
          .upsert(
            {
              org_id: orgId,
              provider: 'square',
              status: 'pending',
              is_enabled: true,
            },
            { onConflict: 'org_id,provider' }
          )
          .select()
          .single();

        if (error) throw new Error(error.message);
        integrationId = newInteg.id;
        setIntegration(newInteg as unknown as Integration);
      }

      const data = await invokeEdgeFunction('square-oauth-start', {
        integrationId,
        environment: 'production',
        appUrl: window.location.origin,
      });

      window.location.href = data.authUrl;
    } catch (err: any) {
      console.error('OAuth start error:', err);
      toast.error('Error iniciando conexión', { description: err.message });
      setConnecting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Manual sync
  // ---------------------------------------------------------------------------
  const handleSync = async () => {
    if (!orgId) return;
    setSyncing(true);
    startProgressAnimation();

    // Detect if this is the first-ever sync (no initial_sync_done flag)
    const isFirstSync = !(integration?.metadata as any)?.initial_sync_done;
    const lookbackDays = isFirstSync ? 365 : 30;
    const timeoutMs = isFirstSync ? SYNC_TIMEOUT_MS : MANUAL_SYNC_TIMEOUT_MS;

    console.log(`[SquareIntegration] Sync: first=${isFirstSync} lookback=${lookbackDays}d`);

    try {
      const data = await invokeEdgeFunction(
        'square-sync',
        {
          org_id: orgId,
          lookback_days: lookbackDays,
          is_initial_sync: isFirstSync,
          sync_type: isFirstSync ? 'initial' : 'manual',
        },
        timeoutMs,
      );

      if (data.message === 'Sync already running') {
        stopProgressAnimation();
        toast.info('Sincronización en curso', {
          description: 'Ya hay una sincronización activa. Espera a que termine.',
        });
        setSyncing(false);
        return;
      }

      // Sync completed
      completeProgressAnimation();

      if (data.stats) {
        toast.success('Sincronización completada', {
          description: `${data.stats.locations || 0} locales, ${data.stats.items || 0} productos, ${data.stats.orders || 0} pedidos`,
        });
      } else {
        toast.success('Sincronización completada');
      }

      // Refresh all data via splash
      setTimeout(() => {
        showSplashScreen('Actualizando datos...');
        queryClient.invalidateQueries();
        loadIntegration().then(() => {
          setTimeout(() => {
            hideSplashScreen();
            setSyncing(false);
          }, 2000);
        });
      }, 1500);
    } catch (err: any) {
      console.error('Sync error:', err);
      stopProgressAnimation();
      toast.error('Error sincronizando', { description: err.message });
      setSyncing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------
  const handleDisconnect = async () => {
    if (!integration) return;

    showSplashScreen('Desconectando Square...');

    try {
      await supabase
        .from('integrations')
        .update({ status: 'disabled' })
        .eq('id', integration.id);

      setIntegration(null);
      setAccount(null);
      setSyncRuns([]);

      queryClient.invalidateQueries();

      setTimeout(() => {
        hideSplashScreen();
        toast.info('Square desconectado. Mostrando datos de demostración.');
      }, 2500);
    } catch (err: any) {
      console.error('Disconnect error:', err);
      hideSplashScreen();
      toast.error('Error al desconectar', { description: err.message });
    }
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isConnected = integration?.status === 'active' && !!account;
  const isConnectedNoAccount = integration?.status === 'active' && !account;

  // Detect if a sync is currently in progress from DB (not user-initiated)
  const latestRun = syncRuns[0] ?? null;
  const isRunningFromDB = latestRun && ['queued', 'running'].includes(latestRun.status);

  // Splash screen overlay
  if (showSplash) {
    return <SyncSplashScreen message={splashMessage} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/integrations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <span className="text-3xl">🔷</span>
              Square POS
            </h1>
            <p className="text-muted-foreground">Sincronización automática con Square</p>
          </div>
        </div>

        {isConnected ? (
          <Badge variant="default" className="gap-2 bg-green-600">
            <CheckCircle className="h-4 w-4" />
            Conectado
          </Badge>
        ) : isConnectedNoAccount ? (
          <Badge variant="secondary" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Conectado (sin cuenta)
          </Badge>
        ) : (
          <Button onClick={handleConnect} size="lg" disabled={connecting}>
            <Plug2 className="h-4 w-4 mr-2" />
            {connecting ? 'Redirigiendo a Square...' : 'Conectar con Square'}
          </Button>
        )}
      </div>

      {/* Animated sync progress bar */}
      {syncing && syncProgress > 0 && (
        <Card className="animate-fade-in">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-2">
                {syncComplete ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {syncPhaseLabel}
              </span>
              <span className="text-muted-foreground">{syncProgress}%</span>
            </div>
            <Progress
              value={syncProgress}
              className={`h-3 transition-all duration-300 ${syncComplete ? '[&>div]:bg-green-500' : ''}`}
            />
          </CardContent>
        </Card>
      )}

      {!isConnected && !isConnectedNoAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Conecta tu cuenta de Square</CardTitle>
            <CardDescription>
              Sincroniza productos, pedidos y pagos automáticamente desde Square POS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Josephine sincronizará:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Locales y ubicaciones</li>
              <li>Catálogo de productos (items y categorías)</li>
              <li>Pedidos y transacciones (hasta 1 año de histórico)</li>
              <li>Métodos de pago y cantidades</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Los datos se normalizan al modelo canónico (CDM) para análisis unificado.
            </p>
          </CardContent>
        </Card>
      )}

      {(isConnected || isConnectedNoAccount) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Estado de la conexión</CardTitle>
              {account && (
                <CardDescription>
                  {account.display_name && (
                    <span className="mr-2">{account.display_name}</span>
                  )}
                  Merchant ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{account.external_account_id}</code>
                </CardDescription>
              )}
              {isConnectedNoAccount && (
                <CardDescription className="text-amber-600">
                  La integración está activa pero no se encontró una cuenta de Square.
                  Intenta desconectar y volver a conectar.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={handleSync} disabled={syncing || !!isRunningFromDB}>
                {syncing || isRunningFromDB ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {syncing ? 'Sincronizando...' : isRunningFromDB ? 'Sincronización en curso...' : 'Sincronizar ahora'}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                Desconectar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historial de sincronización
              </CardTitle>
            </CardHeader>
            <CardContent>
              {syncRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Conectado, sin sincronizaciones todavía. Haz clic en "Sincronizar ahora" para importar datos.
                </p>
              ) : (
                <div className="space-y-3">
                  {syncRuns.map((run) => (
                    <div key={run.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant(run.status)}>
                          {statusLabel(run.status)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(run.started_at || run.created_at).toLocaleString('es-ES')}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {run.finished_at && (
                          <span className="text-xs">
                            {Math.round(
                              (new Date(run.finished_at).getTime() - new Date(run.started_at || run.created_at).getTime()) / 1000
                            )}s
                          </span>
                        )}
                        {run.error && (
                          <span className="text-destructive ml-2">{run.error}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
