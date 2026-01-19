import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { IntegrationCard, PosConnectionData, ProviderInfo } from '@/components/integrations/IntegrationCard';
import { HealthPanel } from '@/components/integrations/HealthPanel';
import { ConnectDialog } from '@/components/integrations/ConnectDialog';
import { MappingDialog } from '@/components/integrations/MappingDialog';
import { CsvImportDialog } from '@/components/integrations/CsvImportDialog';
import { Button } from '@/components/ui/button';
import { Plug } from 'lucide-react';

const PROVIDERS: ProviderInfo[] = [
  { id: 'revo', name: 'Revo', description: 'TPV para hostelería española', logo: '🔄', authTypes: ['api_key', 'username_password'] },
  { id: 'glop', name: 'Glop', description: 'Software TPV español', logo: '📊', authTypes: ['api_key', 'username_password'] },
  { id: 'square', name: 'Square', description: 'Pagos y TPV internacional', logo: '⬛', authTypes: ['oauth', 'api_key'] },
  { id: 'lightspeed', name: 'Lightspeed', description: 'POS para retail y restaurantes', logo: '⚡', authTypes: ['oauth'] },
  { id: 'csv', name: 'CSV Import', description: 'Importar datos desde archivo CSV', logo: '📄', authTypes: ['csv_only'] },
];

export default function Integrations() {
  const { locations } = useApp();
  const { toast } = useToast();
  const [connections, setConnections] = useState<PosConnectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [mappingDialog, setMappingDialog] = useState<{ open: boolean; provider: string; connectionId: string }>({ open: false, provider: '', connectionId: '' });
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  useEffect(() => { fetchConnections(); }, []);

  const fetchConnections = async () => {
    setLoading(true);
    const { data } = await supabase.from('pos_connections').select('id, location_id, provider, status, last_sync_at, config_json, locations(name)');
    const mapped: PosConnectionData[] = (data || []).map((c: any) => ({
      id: c.id, location_id: c.location_id, location_name: c.locations?.name || 'Unknown',
      provider: c.provider, status: c.status, last_sync_at: c.last_sync_at, config_json: c.config_json || {},
    }));
    setConnections(mapped);
    setLoading(false);
  };

  const handleConnect = async (data: { providerId: string; locationId: string; authType: string; schedule: string }) => {
    const { error } = await supabase.from('pos_connections').insert([{
      location_id: data.locationId,
      provider: data.providerId as any,
      status: 'disconnected',
      config_json: { auth_type: data.authType, schedule: data.schedule },
    }]);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Conectado', description: 'Conexión creada. Ejecuta sync para importar datos.' });
    fetchConnections();
  };

  const handleSync = async (connectionId: string, provider: string) => {
    setSyncing(connectionId);
    const conn = connections.find(c => c.id === connectionId);
    try {
      const { data, error } = await supabase.functions.invoke('pos_sync_dispatch', {
        body: { provider, location_id: conn?.location_id, connection_id: connectionId, mode: 'incremental' },
      });
      if (error) throw error;
      toast({ title: 'Sincronizado', description: `${data.result?.tickets?.inserted || 0} tickets importados` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error sync', description: err instanceof Error ? err.message : 'Error' });
    } finally { setSyncing(null); fetchConnections(); }
  };

  const handleDisconnect = async (connectionId: string) => {
    await supabase.from('pos_connections').delete().eq('id', connectionId);
    toast({ title: 'Desconectado' });
    fetchConnections();
  };

  const openConnectDialog = (providerId: string) => {
    setSelectedProvider(PROVIDERS.find(p => p.id === providerId) || null);
    setConnectDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Integrations</h1>
          <p className="text-muted-foreground">Conecta tu TPV y sincroniza datos automáticamente</p>
        </div>
        <Button onClick={() => setConnectDialogOpen(true)}><Plug className="h-4 w-4 mr-2" />Nueva Conexión</Button>
      </div>

      <HealthPanel />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDERS.map(provider => (
          <IntegrationCard
            key={provider.id}
            provider={provider}
            connections={connections.filter(c => c.provider === provider.id)}
            syncing={syncing}
            onConnect={openConnectDialog}
            onReconnect={(id) => handleSync(id, provider.id)}
            onSync={handleSync}
            onViewMapping={(id, p) => setMappingDialog({ open: true, provider: p, connectionId: id })}
            onDisconnect={handleDisconnect}
            onCsvImport={() => setCsvDialogOpen(true)}
          />
        ))}
      </div>

      <ConnectDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} provider={selectedProvider} locations={locations} onConnect={handleConnect} />
      <MappingDialog open={mappingDialog.open} onOpenChange={(o) => setMappingDialog(prev => ({ ...prev, open: o }))} provider={mappingDialog.provider} connectionId={mappingDialog.connectionId} />
      <CsvImportDialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen} locations={locations} onComplete={fetchConnections} />
    </div>
  );
}
