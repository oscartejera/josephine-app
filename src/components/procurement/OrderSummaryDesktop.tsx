import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Sparkles, Truck, Calendar, Shield, AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import type { OrderSummary } from '@/hooks/useProcurementData';

interface OrderSummaryDesktopProps {
  summary: OrderSummary;
  onAutofill: () => void;
  onClearCart: () => void;
}

export function OrderSummaryDesktop({
  summary,
  onAutofill,
  onClearCart,
}: OrderSummaryDesktopProps) {
  const navigate = useNavigate();
  const itemCount = summary.items.length;
  const displayItems = summary.items.slice(0, 8);
  const moreCount = summary.items.length - 8;
  const meetsMinOrder = summary.subtotal >= summary.minOrder;
  const amountNeeded = summary.minOrder - summary.subtotal;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden sticky top-6">
      {/* Header */}
      <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Order Summary
        </h3>
      </div>

      <div className="p-5 space-y-5">
        {/* Supplier & delivery info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-muted-foreground">Supplier</span>
              <p className="font-medium text-foreground">{summary.supplierName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-info" />
            </div>
            <div>
              <span className="text-muted-foreground">Delivery</span>
              <p className="font-medium text-foreground">{format(summary.deliveryDate, 'EEEE, d MMM yyyy')}</p>
            </div>
          </div>
          {itemCount > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-success" />
              </div>
              <div>
                <span className="text-muted-foreground">Coverage</span>
                <p className="font-medium text-success">Until {format(summary.coverageEndDate, 'EEE d MMM')}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Min order progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Min. order value</span>
            <span className="font-medium">€{summary.minOrder.toFixed(0)}</span>
          </div>
          <Progress value={summary.minOrderProgress} className="h-2.5" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">€{summary.subtotal.toFixed(2)}</span>
            <span className={`font-medium ${meetsMinOrder ? 'text-success' : 'text-warning'}`}>
              {meetsMinOrder ? '✓ Min. order met' : `€${amountNeeded.toFixed(2)} to go`}
            </span>
          </div>
          {!meetsMinOrder && summary.subtotal > 0 && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg text-xs text-warning">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Add €{amountNeeded.toFixed(2)} more to waive the €{summary.deliveryFee.toFixed(2)} delivery fee</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Items list */}
        {itemCount > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Items ({itemCount})</p>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {displayItems.map(({ sku, packs }) => (
                  <div key={sku.id} className="flex items-center justify-between text-sm py-1">
                    <span className="text-foreground truncate flex-1 mr-2">{sku.name}</span>
                    <span className="text-muted-foreground shrink-0 font-medium">×{packs}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {moreCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs text-primary hover:text-primary/80"
                onClick={() => navigate('/procurement/cart')}
              >
                See all (+{moreCount} more)
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No items in cart</p>
            <p className="text-xs text-muted-foreground mt-1">Use AI Recommend to auto-fill</p>
          </div>
        )}

        <Separator />

        {/* Totals */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground font-medium">€{summary.subtotal.toFixed(2)}</span>
          </div>
          {summary.deliveryFee > 0 && (
            <div className="flex justify-between text-warning">
              <span>Delivery fee</span>
              <span>€{summary.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {summary.deliveryFee === 0 && summary.subtotal >= summary.minOrder && (
            <div className="flex justify-between text-success">
              <span>Delivery</span>
              <span className="font-medium">FREE</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT (21%)</span>
            <span className="text-foreground">€{summary.tax.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-lg pt-1">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">€{summary.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button 
            className="w-full h-12 text-base font-semibold" 
            size="lg"
            onClick={() => navigate('/procurement/cart')}
            disabled={itemCount === 0}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            View Shopping Cart
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={onAutofill}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Quick Autofill
          </Button>
          {itemCount > 0 && (
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={onClearCart}
            >
              Clear Cart
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
