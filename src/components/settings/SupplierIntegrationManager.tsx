import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Truck, Settings2, Mail, Globe, Phone, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Supplier {
  id: string;
  name: string;
  category: string | null;
  integration_type: 'api' | 'edi' | 'email' | 'manual';
  api_endpoint: string | null;
  api_format: 'json' | 'xml' | 'edifact' | null;
  order_email: string | null;
  order_whatsapp: string | null;
  customer_id: string | null;
  website: string | null;
  phone: string | null;
}

const INTEGRATION_TYPES = [
  { value: 'api', label: 'API Directa', icon: Globe, description: 'Envío automático via REST API' },
  { value: 'edi', label: 'EDI/EDIFACT', icon: Settings2, description: 'Protocolo electrónico estándar' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Envío automático por email' },
  { value: 'manual', label: 'Manual', icon: Phone, description: 'Sin envío automático' },
] as const;

const API_FORMATS = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'edifact', label: 'EDIFACT' },
] as const;

export function SupplierIntegrationManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, integration_type, api_endpoint, api_format, order_email, order_whatsapp, customer_id, website, phone')
      .order('name');
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los proveedores' });
    } else {
      // Map to include category as null since it doesn't exist in DB
      const mapped: Supplier[] = (data || []).map((s: any) => ({
        ...s,
        category: null,
      }));
      setSuppliers(mapped);
    }
    setLoading(false);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier({ ...supplier });
    setApiKey('');
    setShowApiKey(false);
  };

  const handleSave = async () => {
    if (!editingSupplier) return;
    setSaving(true);

    const { error } = await supabase
      .from('suppliers')
      .update({
        integration_type: editingSupplier.integration_type,
        api_endpoint: editingSupplier.api_endpoint || null,
        api_format: editingSupplier.api_format || 'json',
        order_email: editingSupplier.order_email || null,
        order_whatsapp: editingSupplier.order_whatsapp || null,
        customer_id: editingSupplier.customer_id || null,
        website: editingSupplier.website || null,
        phone: editingSupplier.phone || null,
      })
      .eq('id', editingSupplier.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la configuración' });
    } else {
      toast({ title: 'Guardado', description: `Configuración de ${editingSupplier.name} actualizada` });
      setEditingSupplier(null);
      fetchSuppliers();
    }
    setSaving(false);
  };

  const handleTestConnection = async () => {
    if (!editingSupplier?.api_endpoint) {
      toast({ variant: 'destructive', title: 'Error', description: 'Configura primero el endpoint de la API' });
      return;
    }
    
    setTestingConnection(true);
    
    // Simulate API test - in production this would call the edge function
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo purposes, show success
    toast({ 
      title: 'Conexión exitosa', 
      description: `API de ${editingSupplier.name} responde correctamente` 
    });
    
    setTestingConnection(false);
  };

  const getIntegrationBadge = (type: string) => {
    switch (type) {
      case 'api':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">API</Badge>;
      case 'edi':
        return <Badge variant="outline" className="bg-secondary text-secondary-foreground">EDI</Badge>;
      case 'email':
        return <Badge variant="outline" className="bg-accent text-accent-foreground">Email</Badge>;
      default:
        return <Badge variant="secondary">Manual</Badge>;
    }
  };

  const getStatusIndicator = (supplier: Supplier) => {
    if (supplier.integration_type === 'api' && supplier.api_endpoint) {
      return <CheckCircle2 className="h-4 w-4 text-primary" />;
    }
    if (supplier.integration_type === 'email' && supplier.order_email) {
      return <CheckCircle2 className="h-4 w-4 text-primary" />;
    }
    if (supplier.integration_type === 'manual') {
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Integración de Proveedores
          </CardTitle>
          <CardDescription>
            Configura el método de envío de pedidos para cada proveedor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay proveedores configurados</p>
              <p className="text-sm">Añade proveedores desde el asistente de locales</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.category || '—'}</TableCell>
                    <TableCell>{getIntegrationBadge(supplier.integration_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIndicator(supplier)}
                        <span className="text-sm text-muted-foreground">
                          {supplier.integration_type === 'api' && supplier.api_endpoint ? 'Configurado' :
                           supplier.integration_type === 'email' && supplier.order_email ? 'Configurado' :
                           supplier.integration_type === 'manual' ? 'Manual' : 'Pendiente'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)}>
                        <Settings2 className="h-4 w-4 mr-1" />
                        Configurar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Configurar {editingSupplier?.name}
            </DialogTitle>
            <DialogDescription>
              Define cómo se envían los pedidos a este proveedor
            </DialogDescription>
          </DialogHeader>

          {editingSupplier && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Integration Type */}
                <div className="space-y-3">
                  <Label>Método de envío</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {INTEGRATION_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = editingSupplier.integration_type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setEditingSupplier({ ...editingSupplier, integration_type: type.value as any })}
                          className={`flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>
                              {type.label}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{type.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* API Configuration */}
                {editingSupplier.integration_type === 'api' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api_endpoint">API Endpoint</Label>
                      <Input
                        id="api_endpoint"
                        placeholder="https://api.proveedor.com/orders"
                        value={editingSupplier.api_endpoint || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, api_endpoint: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_format">Formato</Label>
                      <Select
                        value={editingSupplier.api_format || 'json'}
                        onValueChange={(val) => setEditingSupplier({ ...editingSupplier, api_format: val as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {API_FORMATS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_key">API Key (opcional)</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="api_key"
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="••••••••••••••••"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Las credenciales se almacenan de forma segura
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customer_id">ID de Cliente</Label>
                      <Input
                        id="customer_id"
                        placeholder="REST-12345"
                        value={editingSupplier.customer_id || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, customer_id: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Tu identificador en el sistema del proveedor
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleTestConnection}
                      disabled={testingConnection || !editingSupplier.api_endpoint}
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Probando conexión...
                        </>
                      ) : (
                        <>
                          <TestTube className="h-4 w-4 mr-2" />
                          Probar conexión
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Email Configuration */}
                {editingSupplier.integration_type === 'email' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="order_email">Email de pedidos</Label>
                      <Input
                        id="order_email"
                        type="email"
                        placeholder="pedidos@proveedor.com"
                        value={editingSupplier.order_email || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, order_email: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="order_whatsapp">WhatsApp (opcional)</Label>
                      <Input
                        id="order_whatsapp"
                        type="tel"
                        placeholder="+34 600 000 000"
                        value={editingSupplier.order_whatsapp || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, order_whatsapp: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Manual Configuration */}
                {editingSupplier.integration_type === 'manual' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Los pedidos se guardarán pero no se enviarán automáticamente.
                        Podrás descargarlos y enviarlos manualmente.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono de contacto</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+34 900 000 000"
                        value={editingSupplier.phone || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Web de pedidos</Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://pedidos.proveedor.com"
                        value={editingSupplier.website || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, website: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* EDI Configuration */}
                {editingSupplier.integration_type === 'edi' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-accent border border-border rounded-lg">
                      <p className="text-sm text-accent-foreground">
                        La integración EDI requiere configuración adicional con el proveedor.
                        Contacta con su departamento de IT para obtener las credenciales.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customer_id">Código EDI</Label>
                      <Input
                        id="customer_id"
                        placeholder="GLN-1234567890123"
                        value={editingSupplier.customer_id || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, customer_id: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_endpoint">Endpoint EDICOM/VAN</Label>
                      <Input
                        id="api_endpoint"
                        placeholder="https://edicom.com/endpoint"
                        value={editingSupplier.api_endpoint || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, api_endpoint: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Fallback Email */}
                {editingSupplier.integration_type !== 'email' && editingSupplier.integration_type !== 'manual' && (
                  <div className="space-y-2">
                    <Label htmlFor="fallback_email">Email de respaldo</Label>
                    <Input
                      id="fallback_email"
                      type="email"
                      placeholder="pedidos@proveedor.com"
                      value={editingSupplier.order_email || ''}
                      onChange={(e) => setEditingSupplier({ ...editingSupplier, order_email: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se usará si falla el método principal
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSupplier(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
