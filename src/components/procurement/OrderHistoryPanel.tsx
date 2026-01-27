import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Truck, CheckCircle2, Clock, AlertCircle, RotateCcw, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface OrderHistoryItem {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: Date;
  deliveryDate: Date;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  items: {
    skuId: string;
    name: string;
    packSize: string;
    packs: number;
    unitPrice: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
}

// Generate mock order history
function generateMockOrders(): OrderHistoryItem[] {
  const statuses: OrderHistoryItem['status'][] = ['delivered', 'delivered', 'delivered', 'shipped', 'confirmed', 'pending'];
  const suppliers = [
    { id: 'macro', name: 'Macro' },
    { id: 'sysco', name: 'Sysco' },
    { id: 'bidfood', name: 'Bidfood' },
  ];

  const sampleItems = [
    { skuId: 'sku-001', name: 'Chicken Breast', packSize: '1×5kg', unitPrice: 42.50 },
    { skuId: 'sku-010', name: 'Whole Milk', packSize: '12×1L', unitPrice: 14.40 },
    { skuId: 'sku-020', name: 'Onions Brown', packSize: '1×10kg', unitPrice: 8.50 },
    { skuId: 'sku-021', name: 'Tomatoes Vine', packSize: '1×5kg', unitPrice: 12.00 },
    { skuId: 'sku-030', name: 'Pasta Penne', packSize: '1×5kg', unitPrice: 8.00 },
    { skuId: 'sku-040', name: 'Coca-Cola Classic', packSize: '24×330ml', unitPrice: 16.80 },
    { skuId: 'sku-050', name: 'Burger Buns', packSize: '48 units', unitPrice: 12.00 },
    { skuId: 'sku-060', name: 'Mayonnaise', packSize: '1×5L', unitPrice: 12.00 },
  ];

  const orders: OrderHistoryItem[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const orderDate = new Date(now);
    orderDate.setDate(orderDate.getDate() - (i * 3 + Math.floor(Math.random() * 2)));
    
    const deliveryDate = new Date(orderDate);
    deliveryDate.setDate(deliveryDate.getDate() + 1 + Math.floor(Math.random() * 2));

    const supplier = suppliers[i % suppliers.length];
    const status = statuses[Math.min(i, statuses.length - 1)];
    
    // Random 3-6 items per order
    const numItems = 3 + Math.floor(Math.random() * 4);
    const orderItems = [];
    const usedIndices = new Set<number>();
    
    for (let j = 0; j < numItems; j++) {
      let idx: number;
      do {
        idx = Math.floor(Math.random() * sampleItems.length);
      } while (usedIndices.has(idx));
      usedIndices.add(idx);
      
      const item = sampleItems[idx];
      const packs = 1 + Math.floor(Math.random() * 5);
      orderItems.push({ ...item, packs });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.packs * item.unitPrice, 0);
    const deliveryFee = subtotal >= 50 ? 0 : 15;
    const tax = subtotal * 0.21;

    orders.push({
      id: `order-${i + 1}`,
      orderNumber: `PO-${2025}${String(i + 100).padStart(4, '0')}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      orderDate,
      deliveryDate,
      status,
      items: orderItems,
      subtotal,
      deliveryFee,
      tax,
      total: subtotal + deliveryFee + tax,
    });
  }

  return orders;
}

const MOCK_ORDERS = generateMockOrders();

interface OrderHistoryPanelProps {
  onReorder?: (items: { skuId: string; packs: number }[]) => void;
}

export function OrderHistoryPanel({ onReorder }: OrderHistoryPanelProps) {
  const [orders] = useState<OrderHistoryItem[]>(MOCK_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryItem | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const { toast } = useToast();

  const getStatusBadge = (status: OrderHistoryItem['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600"><CheckCircle2 className="h-3 w-3" /> Confirmed</Badge>;
      case 'shipped':
        return <Badge variant="outline" className="gap-1 border-orange-500 text-orange-600"><Truck className="h-3 w-3" /> Shipped</Badge>;
      case 'delivered':
        return <Badge className="gap-1 bg-emerald-500"><CheckCircle2 className="h-3 w-3" /> Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Cancelled</Badge>;
    }
  };

  const handleReorder = (order: OrderHistoryItem) => {
    if (onReorder) {
      onReorder(order.items.map(item => ({ skuId: item.skuId, packs: item.packs })));
      toast({
        title: 'Items added to cart',
        description: `${order.items.length} items from ${order.orderNumber} added to your cart`,
      });
    } else {
      toast({
        title: 'Reorder',
        description: `Reordering ${order.items.length} items from ${order.orderNumber}`,
      });
    }
    setSelectedOrder(null);
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order History
            </CardTitle>
            <CardDescription>View past orders and quickly reorder</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium">No orders yet</p>
            <p className="text-sm mt-1">Your order history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="border rounded-lg overflow-hidden">
                {/* Order header row */}
                <div 
                  className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {order.supplierName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{order.orderNumber}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.supplierName} • {order.items.length} items • €{order.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">
                        {order.status === 'delivered' ? 'Delivered' : 'Delivery'} {format(order.deliveryDate, 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ordered {format(order.orderDate, 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(order);
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reorder
                      </Button>
                      {expandedOrderId === order.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded items list */}
                {expandedOrderId === order.id && (
                  <div className="p-4 border-t bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Pack Size</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground">{item.packSize}</TableCell>
                            <TableCell className="text-right">{item.packs}</TableCell>
                            <TableCell className="text-right">€{item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">€{(item.packs * item.unitPrice).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 pt-4 border-t flex justify-end">
                      <div className="text-right space-y-1 text-sm">
                        <div className="flex justify-between gap-8">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>€{order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-8">
                          <span className="text-muted-foreground">Delivery</span>
                          <span>{order.deliveryFee === 0 ? 'Free' : `€${order.deliveryFee.toFixed(2)}`}</span>
                        </div>
                        <div className="flex justify-between gap-8">
                          <span className="text-muted-foreground">VAT (21%)</span>
                          <span>€{order.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-8 font-semibold pt-2 border-t">
                          <span>Total</span>
                          <span>€{order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Order detail dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Order {selectedOrder?.orderNumber}
                {selectedOrder && getStatusBadge(selectedOrder.status)}
              </DialogTitle>
              <DialogDescription>
                {selectedOrder && (
                  <>
                    {selectedOrder.supplierName} • Ordered {format(selectedOrder.orderDate, 'MMMM d, yyyy')}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Order Date</p>
                    <p className="font-medium">{format(selectedOrder.orderDate, 'MMM d, yyyy HH:mm')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.status === 'delivered' ? 'Delivered On' : 'Expected Delivery'}
                    </p>
                    <p className="font-medium">{format(selectedOrder.deliveryDate, 'MMM d, yyyy')}</p>
                  </div>
                </div>

                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Pack Size</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.packSize}</TableCell>
                          <TableCell className="text-right">{item.packs}</TableCell>
                          <TableCell className="text-right">€{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">€{(item.packs * item.unitPrice).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>€{selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{selectedOrder.deliveryFee === 0 ? 'Free' : `€${selectedOrder.deliveryFee.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT (21%)</span>
                    <span>€{selectedOrder.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t">
                    <span>Total</span>
                    <span>€{selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
              <Button onClick={() => selectedOrder && handleReorder(selectedOrder)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reorder All Items
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}