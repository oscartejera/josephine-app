/**
 * Square Integration Page  
 * Configuración y estado de integración con Square
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings as SettingsIcon,
  Calendar,
  AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

export default function SquareIntegration() {
  const [integration, setIntegration] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    setLoading(true);
    
    try {
      // Get Square integration
      const { data: integrations } = await supabase
        .from('integrations')
        .select('*, integration_accounts(*)')
        .eq('provider', 'square')
        .limit(1);

      if (integrations && integrations.length > 0) {
        setIntegration(integrations[0]);
        setAccount(integrations[0].integration_accounts?.[0] || null);

        // Get recent sync runs
        if (integrations[0].integration_accounts?.[0]) {
          const { data: runs } = await supabase
            .from('integration_sync_runs')
            .select('*')
            .eq('integration_account_id', integrations[0].integration_accounts[0].id)
            .order('started_at', { ascending: false })
            .limit(5);

          setSyncRuns(runs || []);
        }
      }
    } catch (error) {
      console.error('Error loading integration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      // Create integration if doesn't exist
      let integrationId = integration?.id;

      if (!integrationId) {
        const { data, error } = await supabase
          .from('integrations')
          .insert({
            org_id: 'demo-org', // TODO: Get from auth
            provider: 'square',
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;
        integrationId = data.id;
      }

      // Call OAuth start
      const { data, error } = await supabase.functions.invoke('square-oauth-start', {
        body: { integrationId, environment: 'sandbox' },
      });

      if (error) throw error;

      // Redirect to Square OAuth
      window.location.href = data.authUrl;
    } catch (error: any) {
      toast.error('Error al conectar: ' + error.message);
    }
  };

  const handleSync = async () => {
    if (!account) return;

    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('square-sync', {
        body: { accountId: account.id },
      });

      if (error) throw error;

      toast.success('Sincronización completada');
      loadIntegration();
    } catch (error: any) {
      toast.error('Error en sincronización: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const isConnected = integration && account;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <span className="text-3xl">🔷</span>
            Square POS
          </h1>
          <p className="text-muted-foreground">
            Sincronización automática con Square
          </p>
        </div>

        {isConnected ? (
          <Badge variant="default" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Conectado
          </Badge>
        ) : (
          <Button onClick={handleConnect} size="lg">
            Conectar con Square
          </Button>
        )}
      </div>

      {isConnected && (
        <>
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de la Cuenta</CardTitle>
              <CardDescription>
                Entorno: <strong>{account.environment}</strong> • 
                Merchant ID: <strong>{account.external_account_id}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Syncs */}
          <Card>
            <CardHeader>
              <CardTitle>Sincronizaciones Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {run.status === 'ok' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : run.status === 'error' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        )}
                        <span className="font-medium">
                          {new Date(run.started_at).toLocaleString('es-ES')}
                        </span>
                      </div>
                      {run.stats && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {run.stats.locations || 0} ubicaciones • 
                          {run.stats.items || 0} productos • 
                          {run.stats.orders || 0} pedidos
                        </p>
                      )}
                      {run.error_text && (
                        <p className="text-sm text-red-500 mt-1">{run.error_text}</p>
                      )}
                    </div>
                    <Badge variant={run.status === 'ok' ? 'default' : run.status === 'error' ? 'destructive' : 'secondary'}>
                      {run.status}
                    </Badge>
                  </div>
                ))}

                {syncRuns.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No hay sincronizaciones todavía
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
