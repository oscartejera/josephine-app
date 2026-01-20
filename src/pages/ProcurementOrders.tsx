import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, MoreHorizontal, FileText, CreditCard, RotateCcw, Building2, Phone, Mail, CheckCircle, Database, Loader2, Package, Calendar, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SupplierWithStats {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalValue: number;
  lastOrderDate: string | null;
}

interface PurchaseOrder {
  id: string;
  status: string;
  created_at: string;
  supplier_id: string;
  supplier_name: string;
  line_count: number;
  total_value: number;
}

interface OrderLine {
  id: string;
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
}

export default function ProcurementOrders() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'place-order' | 'orders' | 'invoices' | 'credits'>('orders');
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);

  // Fetch suppliers and orders from database
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch suppliers with order counts
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, email, phone');

      if (suppliersError) throw suppliersError;

      // Fetch all orders with supplier info
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          status,
          created_at,
          supplier_id,
          suppliers (name)
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch order line totals
      const { data: linesData, error: linesError } = await supabase
        .from('purchase_order_lines')
        .select('purchase_order_id, quantity, unit_cost');

      if (linesError) throw linesError;

      // Calculate order totals and line counts
      const orderTotals = new Map<string, { lineCount: number; totalValue: number }>();
      linesData?.forEach(line => {
        const existing = orderTotals.get(line.purchase_order_id) || { lineCount: 0, totalValue: 0 };
        orderTotals.set(line.purchase_order_id, {
          lineCount: existing.lineCount + 1,
          totalValue: existing.totalValue + (line.quantity * (line.unit_cost || 0))
        });
      });

      // Build orders list with totals
      const formattedOrders: PurchaseOrder[] = (ordersData || []).map(order => {
        const totals = orderTotals.get(order.id) || { lineCount: 0, totalValue: 0 };
        return {
          id: order.id,
          status: order.status || 'draft',
          created_at: order.created_at,
          supplier_id: order.supplier_id,
          supplier_name: (order.suppliers as any)?.name || 'Unknown Supplier',
          line_count: totals.lineCount,
          total_value: totals.totalValue
        };
      });

      setOrders(formattedOrders);

      // Calculate supplier stats
      const supplierStats = new Map<string, { ordersCount: number; totalValue: number; lastOrderDate: string | null }>();
      formattedOrders.forEach(order => {
        const existing = supplierStats.get(order.supplier_id) || { ordersCount: 0, totalValue: 0, lastOrderDate: null };
        supplierStats.set(order.supplier_id, {
          ordersCount: existing.ordersCount + 1,
          totalValue: existing.totalValue + order.total_value,
          lastOrderDate: existing.lastOrderDate || order.created_at
        });
      });

      // Build suppliers with stats
      const formattedSuppliers: SupplierWithStats[] = (suppliersData || []).map(supplier => {
        const stats = supplierStats.get(supplier.id) || { ordersCount: 0, totalValue: 0, lastOrderDate: null };
        return {
          id: supplier.id,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          ordersCount: stats.ordersCount,
          totalValue: stats.totalValue,
          lastOrderDate: stats.lastOrderDate
        };
      });

      // Sort by orders count descending
      formattedSuppliers.sort((a, b) => b.ordersCount - a.ordersCount);

      setSuppliers(formattedSuppliers);
    } catch (error) {
      console.error('Error fetching procurement data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates for purchase_orders
    const channel = supabase
      .channel('purchase-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_orders'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          // Refetch data when any change occurs
          fetchData();
          
          if (payload.eventType === 'INSERT') {
            toast.success('New order received!', {
              description: 'The orders list has been updated.',
              icon: <CheckCircle className="h-5 w-5 text-success" />,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check if we came from a successful order placement
  useEffect(() => {
    if (location.state?.orderSuccess) {
      toast.success('Order sent to supplier!', {
        description: `Order ${location.state.orderId} has been submitted successfully.`,
        duration: 5000,
        icon: <CheckCircle className="h-5 w-5 text-success" />,
      });
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch order lines when viewing order details
  const handleViewOrder = async (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsLoadingLines(true);
    
    try {
      const { data, error } = await supabase
        .from('purchase_order_lines')
        .select(`
          id,
          inventory_item_id,
          quantity,
          unit_cost,
          inventory_items (name)
        `)
        .eq('purchase_order_id', order.id);

      if (error) throw error;

      const formattedLines: OrderLine[] = (data || []).map(line => ({
        id: line.id,
        inventory_item_id: line.inventory_item_id,
        item_name: (line.inventory_items as any)?.name || 'Unknown Item',
        quantity: line.quantity,
        unit_cost: line.unit_cost || 0
      }));

      setOrderLines(formattedLines);
    } catch (error) {
      console.error('Error fetching order lines:', error);
      setOrderLines([]);
    } finally {
      setIsLoadingLines(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Received</Badge>;
      case 'sent':
        return <Badge className="bg-info/10 text-info hover:bg-info/20">Sent</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLastOrderLabel = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return null;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Procurement</h1>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <span>Insights</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Suppliers & Orders</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </Badge>
          ) : suppliers.length > 0 && (
            <Badge variant="outline" className="gap-1.5 text-success border-success/30">
              <Database className="h-3 w-3" />
              Live Data
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Add Supplier</DropdownMenuItem>
              <DropdownMenuItem>Import Invoices</DropdownMenuItem>
              <DropdownMenuItem>Export Data</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4 max-w-[500px]">
          <TabsTrigger value="place-order" onClick={() => window.location.href = '/procurement'}>
            Place order
          </TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="credits">Credit notes</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6 space-y-6">
          {/* Suppliers Section */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Suppliers</h2>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-14 h-14 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-64" />
                        </div>
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : suppliers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No suppliers found</p>
                  <p className="text-sm text-muted-foreground mt-1">Place an order to add suppliers</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {suppliers.map((supplier) => (
                  <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-bold text-primary">{supplier.name[0]}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-semibold text-foreground">{supplier.name}</h3>
                              {supplier.ordersCount > 0 && (
                                <Badge className="bg-success/10 text-success hover:bg-success/20">Active</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              {supplier.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3.5 w-3.5" />
                                  {supplier.email}
                                </span>
                              )}
                              {supplier.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5" />
                                  {supplier.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center px-4">
                            <p className="text-2xl font-bold text-foreground">{supplier.ordersCount}</p>
                            <p className="text-xs text-muted-foreground">Orders</p>
                          </div>
                          <div className="text-center px-4 border-l border-border">
                            <p className="text-2xl font-bold text-foreground">€{supplier.totalValue.toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">Total Value</p>
                          </div>
                          <div className="flex gap-2 pl-4 border-l border-border">
                            <Button size="sm" onClick={() => window.location.href = `/procurement?supplier=${supplier.id}`}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              New Order
                            </Button>
                          </div>
                        </div>
                      </div>
                      {supplier.lastOrderDate && (
                        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                          Last order: {getLastOrderLabel(supplier.lastOrderDate)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders Section */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Orders</h2>
            {isLoading ? (
              <Card>
                <CardContent className="p-0">
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No orders yet</p>
                  <Button className="mt-4" onClick={() => window.location.href = '/procurement'}>
                    Place First Order
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Order ID</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            {order.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-medium">{order.supplier_name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(order.created_at), 'd MMM yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>{order.line_count} items</TableCell>
                          <TableCell className="font-semibold">€{order.total_value.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleViewOrder(order)}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Invoice management coming soon. Connect your accounting software to sync invoices automatically.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Credit Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Credit note tracking coming soon. Request credits for damaged or incorrect deliveries.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Package className="h-5 w-5" />
              Order Details
              {selectedOrder && getStatusBadge(selectedOrder.status)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Order ID</p>
                  <p className="font-mono font-medium">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">{selectedOrder.supplier_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedOrder.created_at), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold text-lg">€{selectedOrder.total_value.toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Order Lines</h4>
                {isLoadingLines ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : orderLines.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No line items found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">{line.item_name}</TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">€{line.unit_cost.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            €{(line.quantity * line.unit_cost).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
