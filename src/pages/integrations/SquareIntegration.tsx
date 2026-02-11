/**
 * Square Integration Page
 * Real OAuth flow + sync management
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Plug2, RefreshCw, Loader2, AlertCircle, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Call an Edge Function using the anon key (bypasses user JWT issues). */
async function invokeEdgeFunction(name: string, body: Record<string, unknown>) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Edge Function ${name} failed (${resp.status})`);
  return data;
}

interface Integration {
  id: string;
  status: string;
  provider: string;
  created_at: string;
}

interface IntegrationAccount {
  id: string;
  environment: string;
  external_account_id: string;
  metadata: any;
  created_at: string;
}

interface SyncRun {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  stats: any;
  error_text: string | null;
}

export default function SquareIntegration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [account, setAccount] = useState<IntegrationAccount | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Check for OAuth callback params — auto-sync is triggered server-side
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('Square conectado correctamente', {
        description: 'Sincronización inicial en curso...',
      });
      setSyncing(true);
      setSearchParams({});
      // Poll until sync completes (auto-triggered by OAuth callback)
      const poll = setInterval(async () => {
        await loadIntegration();
        const { data: runs } = await supabase
          .from('integration_sync_runs')
          .select('status')
          .order('started_at', { ascending: false })
          .limit(1);
        const latest = runs?.[0];
        if (latest && latest.status !== 'running') {
          clearInterval(poll);
          setSyncing(false);
          if (latest.status === 'ok') {
            toast.success('Datos importados correctamente', {
              description: 'Todas las páginas mostrarán tus datos de Square.',
            });
          } else {
            toast.error('Error en la sincronización inicial');
          }
        }
      }, 3000);
      // Safety timeout after 2 minutes
      setTimeout(() => { clearInterval(poll); setSyncing(false); }, 120_000);
      return () => clearInterval(poll);
    }
    if (searchParams.get('error')) {
      toast.error('Error conectando Square', {
        description: searchParams.get('error'),
      });
      setSearchParams({});
    }
  }, [searchParams]);

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    setLoading(true);

    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('provider', 'square')
      .in('status', ['active', 'pending'])
      .limit(1);

    if (integrations && integrations.length > 0) {
      const integ = integrations[0] as Integration;
      setIntegration(integ);

      const { data: accounts } = await supabase
        .from('integration_accounts')
        .select('*')
        .eq('integration_id', integ.id)
        .limit(1);

      if (accounts && accounts.length > 0) {
        setAccount(accounts[0] as IntegrationAccount);

        const { data: runs } = await supabase
          .from('integration_sync_runs')
          .select('*')
          .eq('integration_account_id', accounts[0].id)
          .order('started_at', { ascending: false })
          .limit(10);

        setSyncRuns((runs || []) as SyncRun[]);
      }
    }

    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);

    try {
      let integrationId = integration?.id;

      if (!integrationId) {
        const { data: newInteg, error } = await supabase
          .from('integrations')
          .insert({
            org_id: user?.id || '00000000-0000-0000-0000-000000000000',
            provider: 'square',
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        integrationId = newInteg.id;
        setIntegration(newInteg as Integration);
      }

      const data = await invokeEdgeFunction('square-oauth-start', {
        integrationId,
        environment: 'production',
        appUrl: window.location.origin,
      });

      // Replace the redirect_uri in the auth URL to point to the Vercel
      // API route instead of the Supabase Edge Function (which blocks
      // browser GET redirects that lack an Authorization header).
      const vercelCallbackUrl = `${window.location.origin}/api/square-callback`;
      const authUrl = new URL(data.authUrl);
      authUrl.searchParams.set('redirect_uri', vercelCallbackUrl);

      window.location.href = authUrl.toString();
    } catch (err: any) {
      console.error('OAuth start error:', err);
      toast.error('Error iniciando conexión', { description: err.message });
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!account) return;
    setSyncing(true);

    try {
      const data = await invokeEdgeFunction('square-sync', { accountId: account.id });

      toast.success('Sincronización completada', {
        description: `${data.stats?.locations || 0} locales, ${data.stats?.items || 0} productos, ${data.stats?.orders || 0} pedidos`,
      });

      await loadIntegration();
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error('Error sincronizando', { description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    await supabase.from('integrations').update({ status: 'disabled' }).eq('id', integration.id);
    setIntegration(null);
    setAccount(null);
    setSyncRuns([]);
    toast.info('Square desconectado');
  };

  const isConnected = integration?.status === 'active' && account;

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
            Conectado ({account.environment})
          </Badge>
        ) : (
          <Button onClick={handleConnect} size="lg" disabled={connecting}>
            <Plug2 className="h-4 w-4 mr-2" />
            {connecting ? 'Redirigiendo a Square...' : 'Conectar con Square'}
          </Button>
        )}
      </div>

      {!isConnected && (
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
              <li>Pedidos y transacciones (últimos 7 días)</li>
              <li>Métodos de pago y cantidades</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Los datos se normalizan al modelo canónico (CDM) para análisis unificado.
            </p>
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Estado de la conexión</CardTitle>
              <CardDescription>
                Merchant ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{account.external_account_id}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
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
                  No hay sincronizaciones aún. Haz clic en "Sincronizar ahora" para importar datos.
                </p>
              ) : (
                <div className="space-y-3">
                  {syncRuns.map((run) => (
                    <div key={run.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          run.status === 'ok' ? 'default' :
                          run.status === 'running' ? 'secondary' :
                          'destructive'
                        }>
                          {run.status === 'ok' ? 'OK' : run.status === 'running' ? 'En curso' : 'Error'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(run.started_at).toLocaleString('es-ES')}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {run.stats && typeof run.stats === 'object' && (
                          <span>
                            {run.stats.locations || 0} locales, {run.stats.items || 0} items, {run.stats.orders || 0} pedidos
                          </span>
                        )}
                        {run.error_text && (
                          <span className="text-destructive ml-2">{run.error_text}</span>
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
