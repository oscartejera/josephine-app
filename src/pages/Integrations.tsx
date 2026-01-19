import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plug, RefreshCw, Upload, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface PosConnection {
  id: string;
  location_id: string;
  location_name: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
}

const providers = [
  { id: 'revo', name: 'Revo', description: 'TPV para hostelería española', logo: '🔄' },
  { id: 'glop', name: 'Glop', description: 'Software TPV español', logo: '📊' },
  { id: 'square', name: 'Square', description: 'Pagos y TPV internacional', logo: '⬛' },
  { id: 'lightspeed', name: 'Lightspeed', description: 'POS para retail y restaurantes', logo: '⚡' },
  { id: 'csv', name: 'CSV Import', description: 'Importar datos desde archivo CSV', logo: '📄' },
];

export default function Integrations() {
  const { locations } = useApp();
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pos_connections')
      .select(`
        id, location_id, provider, status, last_sync_at,
        locations(name)
      `);
    
    const mapped: PosConnection[] = (data || []).map((c: any) => ({
      id: c.id,
      location_id: c.location_id,
      location_name: c.locations?.name || 'Desconocido',
      provider: c.provider,
      status: c.status,
      last_sync_at: c.last_sync_at
    }));
    setConnections(mapped);
    setLoading(false);
  };

  const handleConnect = async () => {
    if (!selectedProvider || !selectedLocation) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona proveedor y local" });
      return;
    }
    
    const { error } = await supabase.from('pos_connections').insert([{
      location_id: selectedLocation,
      provider: selectedProvider as 'revo' | 'glop' | 'square' | 'lightspeed' | 'csv',
      status: 'disconnected' as const,
      config_json: {}
    }]);
    
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar" });
    } else {
      toast({ title: "Conectado", description: "Conexión creada. Configura las credenciales." });
      setConnectDialogOpen(false);
      fetchConnections();
    }
  };

  const handleSync = async (connectionId: string, provider: string) => {
    setSyncing(connectionId);
    
    // Simulate sync - in production this would call an edge function
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await supabase
      .from('pos_connections')
      .update({ last_sync_at: new Date().toISOString(), status: 'connected' })
      .eq('id', connectionId);
    
    toast({ title: "Sincronizado", description: `Datos de ${provider} sincronizados` });
    setSyncing(null);
    fetchConnections();
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // TODO: Implement CSV parsing and import
    toast({ title: "Archivo cargado", description: `${file.name} - Procesando...` });
    setCsvDialogOpen(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'syncing':
        return <Loader2 className="h-5 w-5 text-info animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-success/10 text-success">Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'syncing':
        return <Badge className="bg-info/10 text-info">Sincronizando</Badge>;
      default:
        return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Integrations</h1>
          <p className="text-muted-foreground">Conecta tu TPV y sincroniza datos automáticamente</p>
        </div>
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plug className="h-4 w-4 mr-2" />
              Nueva Conexión
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conectar TPV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Proveedor</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.filter(p => p.id !== 'csv').map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="mr-2">{p.logo}</span>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Local</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar local" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleConnect} className="w-full">Conectar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const providerConnections = connections.filter(c => c.provider === provider.id);
          const isConnected = providerConnections.some(c => c.status === 'connected');
          
          return (
            <Card key={provider.id} className={isConnected ? 'border-success/50' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.logo}</span>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription className="text-xs">{provider.description}</CardDescription>
                    </div>
                  </div>
                  {isConnected && <CheckCircle className="h-5 w-5 text-success" />}
                </div>
              </CardHeader>
              <CardContent>
                {providerConnections.length > 0 ? (
                  <div className="space-y-2">
                    {providerConnections.map(conn => (
                      <div key={conn.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(conn.status)}
                          <div>
                            <p className="text-sm font-medium">{conn.location_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {conn.last_sync_at 
                                ? `Último sync: ${format(new Date(conn.last_sync_at), 'dd/MM HH:mm')}`
                                : 'Nunca sincronizado'
                              }
                            </p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          disabled={syncing === conn.id}
                          onClick={() => handleSync(conn.id, provider.name)}
                        >
                          {syncing === conn.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    {provider.id === 'csv' ? (
                      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Upload className="h-4 w-4 mr-2" />
                            Importar CSV
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Importar CSV</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Local</Label>
                              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar local" />
                                </SelectTrigger>
                                <SelectContent>
                                  {locations.map(l => (
                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Archivo CSV</Label>
                              <Input 
                                type="file" 
                                accept=".csv"
                                ref={fileInputRef}
                                onChange={handleCsvUpload}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              El CSV debe contener columnas: date, item_name, quantity, price, category (opcional)
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          setConnectDialogOpen(true);
                        }}
                      >
                        Conectar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Conexiones</CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay conexiones configuradas. Conecta tu TPV para sincronizar datos automáticamente.
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map(conn => (
                <div key={conn.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-xl">
                      {providers.find(p => p.id === conn.provider)?.logo || '📡'}
                    </span>
                    <div>
                      <p className="font-medium">{conn.location_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{conn.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {getStatusBadge(conn.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {conn.last_sync_at 
                          ? format(new Date(conn.last_sync_at), 'dd/MM/yyyy HH:mm')
                          : 'Pendiente'
                        }
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={syncing === conn.id}
                      onClick={() => handleSync(conn.id, conn.provider)}
                    >
                      {syncing === conn.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
