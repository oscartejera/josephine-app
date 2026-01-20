import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Minus, Plus, CreditCard, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { useProcurementData } from '@/hooks/useProcurementData';

type PaymentState = 'idle' | 'processing' | 'success' | 'error';

export default function ProcurementCart() {
  const navigate = useNavigate();
  const {
    orderSummary,
    cart,
    updateCartItem,
    allSkus,
  } = useProcurementData();
  
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    setPaymentState('processing');
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock success (80% chance) or failure
    const success = Math.random() > 0.2;
    
    if (success) {
      setOrderId(`PO-${Date.now().toString(36).toUpperCase()}`);
      setPaymentState('success');
    } else {
      setPaymentState('error');
    }
  };

  const handleCloseDialog = () => {
    if (paymentState === 'success') {
      navigate('/procurement');
    }
    setPaymentState('idle');
  };

  const cartItems = orderSummary.items;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/procurement')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Shopping Cart</h1>
          <p className="text-sm text-muted-foreground">
            {cartItems.length} items • {orderSummary.supplierName}
          </p>
        </div>
      </div>

      {cartItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Button onClick={() => navigate('/procurement')}>
              Continue Shopping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Cart Table */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Pack Size</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartItems.map(({ sku, packs }) => (
                    <TableRow key={sku.id}>
                      <TableCell className="font-medium">{sku.name}</TableCell>
                      <TableCell className="text-muted-foreground">{sku.packSize}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateCartItem(sku.id, packs - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center font-medium">{packs}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateCartItem(sku.id, packs + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">£{sku.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        £{(packs * sku.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => updateCartItem(sku.id, 0)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier</span>
                    <span className="font-medium">{orderSummary.supplierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Date</span>
                    <span className="font-medium">{format(orderSummary.deliveryDate, 'd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coverage Until</span>
                    <span className="font-medium text-success">{format(orderSummary.coverageEndDate, 'EEE d MMM')}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({cartItems.length} items)</span>
                    <span>£{orderSummary.subtotal.toFixed(2)}</span>
                  </div>
                  {orderSummary.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>£{orderSummary.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT (21%)</span>
                    <span>£{orderSummary.tax.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>£{orderSummary.total.toFixed(2)}</span>
                </div>

                <div className="space-y-2 pt-2">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handlePlaceOrder}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Place Order
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/procurement')}
                  >
                    Back to Procurement
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Payment will be charged to your saved payment method
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentState !== 'idle'} onOpenChange={() => paymentState !== 'processing' && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md">
          {paymentState === 'processing' && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <DialogHeader>
                <DialogTitle>Processing Payment...</DialogTitle>
                <DialogDescription>
                  Please wait while we process your order.
                </DialogDescription>
              </DialogHeader>
            </div>
          )}

          {paymentState === 'success' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <DialogHeader>
                <DialogTitle>Order Placed Successfully!</DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>Your order has been submitted to {orderSummary.supplierName}.</p>
                  <p className="font-medium text-foreground">Order ID: {orderId}</p>
                  <p>Expected delivery: {format(orderSummary.deliveryDate, 'd MMMM yyyy')}</p>
                </DialogDescription>
              </DialogHeader>
              <Button onClick={handleCloseDialog} className="mt-4">
                Back to Procurement
              </Button>
            </div>
          )}

          {paymentState === 'error' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <DialogHeader>
                <DialogTitle>Payment Failed</DialogTitle>
                <DialogDescription>
                  There was an issue processing your payment. Please check your payment method in Settings.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Try Again
                </Button>
                <Button onClick={() => navigate('/settings')}>
                  Update Payment Method
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
