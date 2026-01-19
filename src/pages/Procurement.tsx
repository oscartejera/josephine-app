import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Truck, Package, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface PurchaseOrder {
  id: string;
  supplier_name: string;
  status: string;
  created_at: string;
  total: number;
  lines_count: number;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  par_level: number | null;
  last_cost: number | null;
}

export default function Procurement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch suppliers
    const { data: suppliersData } = await supabase
      .from('suppliers')
      .select('id, name, email, phone')
      .order('name');
    setSuppliers(suppliersData || []);
    
    // Fetch purchase orders with totals
    const { data: ordersData } = await supabase
      .from('purchase_orders')
      .select(`
        id, status, created_at,
        suppliers(name),
        purchase_order_lines(quantity, unit_cost)
      `)
      .order('created_at', { ascending: false });
    
    const mappedOrders: PurchaseOrder[] = (ordersData || []).map((o: any) => ({
      id: o.id,
      supplier_name: o.suppliers?.name || 'Desconocido',
      status: o.status,
      created_at: o.created_at,
      total: (o.purchase_order_lines || []).reduce((sum: number, l: any) => sum + (l.quantity * (l.unit_cost || 0)), 0),
      lines_count: (o.purchase_order_lines || []).length
    }));
    setOrders(mappedOrders);
    
    // Fetch inventory items
    const { data: itemsData } = await supabase
      .from('inventory_items')
      .select('id, name, unit, current_stock, par_level, last_cost')
      .order('name');
    setInventoryItems(itemsData || []);
    
    setLoading(false);
  };

  const handleMarkReceived = async (orderId: string) => {
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'received' })
      .eq('id', orderId);
    
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar" });
    } else {
      toast({ title: "Recibido", description: "Pedido marcado como recibido" });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'received' } : o));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Borrador</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-info/10 text-info">Enviado</Badge>;
      case 'received':
        return <Badge variant="outline" className="bg-success/10 text-success">Recibido</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate suggested orders based on par levels
  const suggestedItems = inventoryItems.filter(item => 
    item.par_level && item.current_stock < item.par_level * 0.5
  ).map(item => ({
    ...item,
    suggested_qty: item.par_level ? item.par_level - item.current_stock : 0
  }));

  const totalPending = orders.filter(o => o.status === 'sent').reduce((sum, o) => sum + o.total, 0);
  const totalThisMonth = orders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Procurement</h1>
          <p className="text-muted-foreground">Gestión de proveedores y pedidos</p>
        </div>
        <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Pedido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Proveedor</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {suggestedItems.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Productos sugeridos (bajo stock)</Label>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                    {suggestedItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="font-medium">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Stock: {item.current_stock} / Par: {item.par_level}
                          </span>
                          <Badge>+{item.suggested_qty.toFixed(1)} {item.unit}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button className="w-full" onClick={() => {
                toast({ title: "Pedido creado", description: "El pedido ha sido creado como borrador" });
                setNewOrderOpen(false);
              }}>
                Crear Borrador
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Pendientes</p>
                <p className="text-2xl font-bold">€{totalPending.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Truck className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Recibido Este Mes</p>
                <p className="text-2xl font-bold">€{totalThisMonth.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Items Bajo Stock</p>
                <p className="text-2xl font-bold">{suggestedItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="receiving">Recepción</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-center">Líneas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{format(new Date(order.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{order.supplier_name}</TableCell>
                      <TableCell className="text-center">{order.lines_count}</TableCell>
                      <TableCell className="text-right">€{order.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        {order.status === 'sent' && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkReceived(order.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Recibido
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Proveedores</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.email || '-'}</TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost">Ver Pedidos</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receiving">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Pendientes de Recepción</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.filter(o => o.status === 'sent').length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay pedidos pendientes de recepción</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.filter(o => o.status === 'sent').map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{format(new Date(order.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-medium">{order.supplier_name}</TableCell>
                        <TableCell className="text-right">€{order.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handleMarkReceived(order.id)}>
                            Marcar Recibido
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
