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
import { useAuth } from '@/contexts/AuthContext';
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
import { useTranslation } from 'react-i18next';

interface SupplierWithStats {
  id: string;
  name: string;
  email: string | null;
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
  unit_price: number;
}

export default function ProcurementOrders() {
  const { t } = useTranslation();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'place-order' | 'orders' | 'invoices' | 'credits'>{t('procurementOrders.ordersConstSuppliersSetsuppliersUsestate')}<SupplierWithStats[]>{t('procurementOrders.constOrdersSetordersUsestate')}<PurchaseOrder[]>{t('procurementOrders.constIsloadingSetisloadingUsestatetrueCo')}<PurchaseOrder | null>{t('procurementOrders.nullConstOrderlinesSetorderlinesUsestate')}<OrderLine[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { session } = useAuth();

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          setNotificationsEnabled(permission === 'granted');
        });
      }
    }
  }, []);

  // Fetch suppliers and orders from database
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch suppliers with order counts
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, email');

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
        .select('purchase_order_id, quantity, unit_price');

      if (linesError) throw linesError;

      // Calculate order totals and line counts
      const orderTotals = new Map<string, { lineCount: number; totalValue: number }>();
      linesData?.forEach(line => {
        const existing = orderTotals.get(line.purchase_order_id) || { lineCount: 0, totalValue: 0 };
        orderTotals.set(line.purchase_order_id, {
          lineCount: existing.lineCount + 1,
          totalValue: existing.totalValue + (line.quantity * (line.unit_price || 0))
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
    if (!session) return;

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
            // Play notification sound
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(err => console.log('Audio play failed:', err));

            // Show browser push notification if tab is in background
            if (document.hidden && notificationsEnabled && 'Notification' in window) {
              const notification = new Notification('New Procurement Order', {
                body: 'A new order has been placed!',
                icon: '/favicon.ico',
                tag: 'new-order',
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }

            toast.success(t('procurement.toastNewOrder'), {
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
  }, [session]);

  // Check if we came from a successful order placement
  useEffect(() => {
    if (location.state?.orderSuccess) {
      toast.success(t('procurement.toastOrderSent'), {
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
          unit_price,
          inventory_items (name)
        `)
        .eq('purchase_order_id', order.id);

      if (error) throw error;

      const formattedLines: OrderLine[] = (data || []).map(line => ({
        id: line.id,
        inventory_item_id: line.inventory_item_id,
        item_name: (line.inventory_items as any)?.name || 'Unknown Item',
        quantity: line.quantity,
        unit_price: line.unit_price || 0
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
        return <Badge className="bg-success/10 text-success hover:bg-success/20">{t('procurementOrders.received')}</Badge>{t('procurementOrders.caseSentReturn')} <Badge className="bg-info/10 text-info hover:bg-info/20">{t('procurementOrders.sent')}</Badge>{t('procurementOrders.caseDraftReturn')} <Badge variant="secondary">{t('procurementOrders.draft')}</Badge>{t('procurementOrders.defaultReturn')} <Badge variant="outline">{status}</Badge>;
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
          <h1 className="text-2xl font-display font-bold text-foreground">{t('procurementOrders.procurement')}</h1>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <span>{t('procurementOrders.insights')}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{t('procurementOrders.suppliersOrders')}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('procurementOrders.loading')}
            </Badge>
          ) : suppliers.length > 0 && (
            <Badge variant="outline" className="gap-1.5 text-success border-success/30">
              <Database className="h-3 w-3" />
              {t('procurementOrders.liveData')}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>{t('procurementOrders.addSupplier')}</DropdownMenuItem>
              <DropdownMenuItem>{t('procurementOrders.importInvoices')}</DropdownMenuItem>
              <DropdownMenuItem>{t('procurementOrders.exportData')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4 max-w-[500px]">
          <TabsTrigger value="place-order" onClick={() => window.location.href = '/procurement'}>
            {t('procurementOrders.placeOrder')}
          </TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="invoices">{t('procurementOrders.invoices')}</TabsTrigger>
          <TabsTrigger value="credits">{t('procurementOrders.creditNotes')}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6 space-y-6">
          {/* Suppliers Section */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">{t('procurementOrders.suppliers')}</h2>
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
            {t('procurementOrders.supplierslength0')}
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">{t("procurement.noSuppliersFound")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("procurement.placeOrderToAdd")}</p>
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
                                <Badge className="bg-success/10 text-success hover:bg-success/20">{t('procurementOrders.active')}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              {supplier.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3.5 w-3.5" />
                                  {supplier.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center px-4">
                            <p className="text-2xl font-bold text-foreground">{supplier.ordersCount}</p>
                            <p className="text-xs text-muted-foreground">{t('procurementOrders.orders')}</p>
                          </div>
                          <div className="text-center px-4 border-l border-border">
                            <p className="text-2xl font-bold text-foreground">€{supplier.totalValue.toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">{t("procurement.totalValue")}</p>
                          </div>
                          <div className="flex gap-2 pl-4 border-l border-border">
                            <Button size="sm" onClick={() => window.location.href = `/procurement?supplier=${supplier.id}`}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              {t('procurementOrders.newOrder')}
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
            <h2 className="text-lg font-semibold text-foreground mb-4">{t('procurementOrders.recentOrders')}</h2>
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
            {t('procurementOrders.orderslength0')}
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">{t("procurement.noOrdersYet")}</p>
                  <Button className="mt-4" onClick={() => window.location.href = '/procurement'}>
                    {t('procurementOrders.placeFirstOrder')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('procurementOrders.orderId')}</TableHead>
                        <TableHead>{t('procurementOrders.supplier')}</TableHead>
                        <TableHead>{t('procurementOrders.date')}</TableHead>
                        <TableHead>{t('procurementOrders.items')}</TableHead>
                        <TableHead>{t("common.total")}</TableHead>
                        <TableHead>{t('procurementOrders.status')}</TableHead>
                        <TableHead className="text-right">{t('procurementOrders.actions')}</TableHead>
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
                              {t('procurementOrders.view')}
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
                {t('procurementOrders.invoices1')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                {t('procurementOrders.invoiceManagementComingSoonConnect')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('procurementOrders.creditNotes1')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                {t('procurementOrders.creditNoteTrackingComingSoon')}
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
                  <p className="text-muted-foreground">{t('procurementOrders.orderId1')}</p>
                  <p className="font-mono font-medium">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('procurementOrders.supplier1')}</p>
                  <p className="font-medium">{selectedOrder.supplier_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('procurementOrders.date1')}</p>
                  <p className="font-medium">{format(new Date(selectedOrder.created_at), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("common.total")}</p>
                  <p className="font-semibold text-lg">€{selectedOrder.total_value.toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">{t('procurementOrders.orderLines')}</h4>
                {isLoadingLines ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                {t('procurementOrders.orderlineslength0')}
                  <p className="text-muted-foreground text-center py-4">{t("procurement.noLineItems")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('procurementOrders.item')}</TableHead>
                        <TableHead className="text-right">{t('procurementOrders.qty')}</TableHead>
                        <TableHead className="text-right">{t('procurementOrders.unitCost')}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">{line.item_name}</TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">€{line.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            €{(line.quantity * line.unit_price).toFixed(2)}
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
