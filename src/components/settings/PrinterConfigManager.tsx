import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, RefreshCw, Check, X, Trash2, TestTube, Loader2, AlertCircle, Wifi } from 'lucide-react';
import { toast } from 'sonner';

interface PrinterConfig {
  id: string;
  location_id: string;
  destination: 'kitchen' | 'bar' | 'prep' | 'receipt';
  printnode_printer_id: string;
  printer_name: string;
  is_active: boolean;
  auto_print: boolean;
}

interface PrintNodePrinter {
  id: number;
  name: string;
  description: string;
  state: string;
  computer: {
    name: string;
  };
}

interface PrintNodeCredentials {
  id: string;
  api_key_encrypted: string;
  is_active: boolean;
  last_verified_at: string | null;
}

const DESTINATIONS = [
  { value: 'kitchen', label: 'Cocina', icon: '🍳' },
  { value: 'bar', label: 'Bar', icon: '🍹' },
  { value: 'prep', label: 'Preparación', icon: '📦' },
  { value: 'receipt', label: 'Recibos', icon: '🧾' },
] as const;

export function PrinterConfigManager() {
  const { locations, group } = useApp();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    locations.length > 0 ? locations[0].id : null
  );
  
  const [credentials, setCredentials] = useState<PrintNodeCredentials | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<PrintNodePrinter[]>([]);
  const [printerConfigs, setPrinterConfigs] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);

  // Load credentials and configs on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      loadPrinterConfigs();
    }
  }, [selectedLocationId]);

  useEffect(() => {
    if (credentials?.api_key_encrypted) {
      loadAvailablePrinters();
    }
  }, [credentials]);

  const loadCredentials = async () => {
    const { data } = await supabase
      .from('printnode_credentials')
      .select('*')
      .single();
    
    if (data) {
      setCredentials(data);
    }
  };

  const loadPrinterConfigs = async () => {
    if (!selectedLocationId) return;
    
    const { data } = await supabase
      .from('printer_config')
      .select('*')
      .eq('location_id', selectedLocationId);
    
    setPrinterConfigs((data as PrinterConfig[]) || []);
  };

  const loadAvailablePrinters = async () => {
    if (!credentials?.api_key_encrypted) return;
    
    setLoadingPrinters(true);
    try {
      const response = await fetch('https://api.printnode.com/printers', {
        headers: {
          'Authorization': `Basic ${btoa(credentials.api_key_encrypted + ':')}`
        }
      });
      
      if (response.ok) {
        const printers = await response.json();
        setAvailablePrinters(printers);
        
        // Update last verified
        await supabase
          .from('printnode_credentials')
          .update({ last_verified_at: new Date().toISOString() })
          .eq('id', credentials.id);
      } else if (response.status === 401) {
        toast.error('API Key de PrintNode inválida');
        setCredentials(null);
      }
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('Error al conectar con PrintNode');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Introduce una API Key');
      return;
    }

    setLoading(true);
    try {
      // Verify the API key first
      const response = await fetch('https://api.printnode.com/whoami', {
        headers: {
          'Authorization': `Basic ${btoa(apiKey + ':')}`
        }
      });

      if (!response.ok) {
        toast.error('API Key inválida. Verifica tu clave de PrintNode.');
        return;
      }

      // Save to database
      const { data: existing } = await supabase
        .from('printnode_credentials')
        .select('id')
        .single();

      if (existing) {
        await supabase
          .from('printnode_credentials')
          .update({ 
            api_key_encrypted: apiKey, 
            is_active: true,
            last_verified_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        const { data: groupData } = await supabase
          .from('profiles')
          .select('group_id')
          .single();
        
        if (groupData) {
          await supabase
            .from('printnode_credentials')
            .insert({
              group_id: groupData.group_id,
              api_key_encrypted: apiKey,
              is_active: true,
              last_verified_at: new Date().toISOString()
            });
        }
      }

      toast.success('PrintNode conectado correctamente');
      setShowApiKeyDialog(false);
      setApiKey('');
      loadCredentials();
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const assignPrinter = async (destination: string, printerId: string | null) => {
    if (!selectedLocationId) return;
    
    setLoading(true);
    try {
      if (!printerId) {
        // Remove config
        await supabase
          .from('printer_config')
          .delete()
          .eq('location_id', selectedLocationId)
          .eq('destination', destination);
        
        toast.success('Impresora desasignada');
      } else {
        const printer = availablePrinters.find(p => String(p.id) === printerId);
        if (!printer) return;

        // Upsert config
        await supabase
          .from('printer_config')
          .upsert({
            location_id: selectedLocationId,
            destination,
            printnode_printer_id: printerId,
            printer_name: printer.name,
            is_active: true,
            auto_print: true,
          }, {
            onConflict: 'location_id,destination'
          });
        
        toast.success(`Impresora asignada a ${destination}`);
      }
      
      loadPrinterConfigs();
    } catch (error) {
      console.error('Error assigning printer:', error);
      toast.error('Error al asignar impresora');
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoPrint = async (configId: string, enabled: boolean) => {
    await supabase
      .from('printer_config')
      .update({ auto_print: enabled })
      .eq('id', configId);
    
    loadPrinterConfigs();
    toast.success(enabled ? 'Impresión automática activada' : 'Impresión automática desactivada');
  };

  const testPrint = async (config: PrinterConfig) => {
    if (!credentials?.api_key_encrypted) return;
    
    setTestingPrinter(config.id);
    try {
      const testContent = `
========================================
       PRUEBA DE IMPRESORA
========================================
Destino: ${config.destination.toUpperCase()}
Impresora: ${config.printer_name}
Fecha: ${new Date().toLocaleString('es-ES')}
----------------------------------------
Si puedes leer esto, la impresora
esta configurada correctamente.
========================================
`;

      const response = await fetch('https://api.printnode.com/printjobs', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(credentials.api_key_encrypted + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printerId: parseInt(config.printnode_printer_id),
          title: 'Test Print - Josephine',
          contentType: 'raw_base64',
          content: btoa(testContent),
          source: 'Josephine POS - Test',
        }),
      });

      if (response.ok) {
        toast.success('Prueba enviada a la impresora');
      } else {
        toast.error('Error al enviar prueba');
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      toast.error('Error de conexión con PrintNode');
    } finally {
      setTestingPrinter(null);
    }
  };

  const disconnectPrintNode = async () => {
    if (!credentials) return;
    
    await supabase
      .from('printnode_credentials')
      .update({ is_active: false })
      .eq('id', credentials.id);
    
    setCredentials(null);
    setAvailablePrinters([]);
    toast.success('PrintNode desconectado');
  };

  const getConfigForDestination = (destination: string) => {
    return printerConfigs.find(c => c.destination === destination);
  };

  const getPrinterStatus = (printer: PrintNodePrinter) => {
    if (printer.state === 'online') return { label: 'Online', variant: 'default' as const, color: 'text-emerald-500' };
    if (printer.state === 'offline') return { label: 'Offline', variant: 'secondary' as const, color: 'text-muted-foreground' };
    return { label: printer.state, variant: 'outline' as const, color: 'text-amber-500' };
  };

  return (
    <div className="space-y-6">
      {/* PrintNode Connection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Printer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">PrintNode</CardTitle>
                <CardDescription>Servicio de impresión en la nube</CardDescription>
              </div>
            </div>
            {credentials?.is_active ? (
              <Badge variant="default" className="gap-1">
                <Wifi className="h-3 w-3" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="secondary">Desconectado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {credentials?.is_active ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {availablePrinters.length} impresora(s) disponible(s)
                {credentials.last_verified_at && (
                  <span className="ml-2">
                    • Verificado: {new Date(credentials.last_verified_at).toLocaleDateString('es-ES')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadAvailablePrinters}
                  disabled={loadingPrinters}
                >
                  {loadingPrinters ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowApiKeyDialog(true)}>
                  Cambiar API Key
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnectPrintNode} className="text-destructive">
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecta tu cuenta de PrintNode para enviar comandas automáticamente a tus impresoras térmicas.
              </p>
              <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Printer className="h-4 w-4 mr-2" />
                    Conectar PrintNode
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Conectar PrintNode</DialogTitle>
                    <DialogDescription>
                      Introduce tu API Key de PrintNode. La encontrarás en tu{' '}
                      <a 
                        href="https://app.printnode.com/app/apikeys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        dashboard de PrintNode
                      </a>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={saveApiKey} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Conectar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Printer Assignments per Location */}
      {credentials?.is_active && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Asignación de Impresoras</CardTitle>
            <CardDescription>
              Configura qué impresora usar para cada destino en cada local
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location Selector */}
            <div className="flex items-center gap-4">
              <Label>Local:</Label>
              <Select 
                value={selectedLocationId || ''} 
                onValueChange={setSelectedLocationId}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecciona un local" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Destination Assignments */}
            {selectedLocationId && (
              <div className="grid gap-4">
                {DESTINATIONS.map(dest => {
                  const config = getConfigForDestination(dest.value);
                  
                  return (
                    <div 
                      key={dest.value} 
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{dest.icon}</span>
                        <div>
                          <p className="font-medium">{dest.label}</p>
                          {config && (
                            <p className="text-sm text-muted-foreground">
                              {config.printer_name}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {config && (
                          <>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={config.auto_print}
                                onCheckedChange={(checked) => toggleAutoPrint(config.id, checked)}
                              />
                              <Label className="text-sm text-muted-foreground">Auto</Label>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testPrint(config)}
                              disabled={testingPrinter === config.id}
                            >
                              {testingPrinter === config.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <TestTube className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        
                        <Select
                          value={config?.printnode_printer_id || ''}
                          onValueChange={(value) => assignPrinter(dest.value, value || null)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Seleccionar impresora" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">
                              <span className="text-muted-foreground">Sin asignar</span>
                            </SelectItem>
                            {availablePrinters.map(printer => {
                              const status = getPrinterStatus(printer);
                              return (
                                <SelectItem key={printer.id} value={String(printer.id)}>
                                  <div className="flex items-center gap-2">
                                    <span className={status.color}>●</span>
                                    <span>{printer.name}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {availablePrinters.length === 0 && credentials?.is_active && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-500">No hay impresoras disponibles</p>
                  <p className="text-sm text-muted-foreground">
                    Asegúrate de tener el cliente de PrintNode instalado y tus impresoras conectadas.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
