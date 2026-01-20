import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Sparkles, Truck, Calendar, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import type { OrderSummary } from '@/hooks/useProcurementData';

interface OrderSummaryPanelProps {
  summary: OrderSummary;
  onAutofill: () => void;
  onClearCart: () => void;
}

export function OrderSummaryPanel({
  summary,
  onAutofill,
  onClearCart,
}: OrderSummaryPanelProps) {
  const navigate = useNavigate();
  const itemCount = summary.items.length;
  const displayItems = summary.items.slice(0, 6);
  const moreCount = summary.items.length - 6;
  const meetsMinOrder = summary.subtotal >= summary.minOrder;
  const amountNeeded = summary.minOrder - summary.subtotal;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden sticky top-6">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Order Summary
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Supplier & delivery info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Supplier:</span>
            <span className="font-medium text-foreground">{summary.supplierName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Delivery:</span>
            <span className="font-medium text-foreground">{format(summary.deliveryDate, 'd MMM yyyy')}</span>
          </div>
          {itemCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Coverage:</span>
              <span className="font-medium text-success">Until {format(summary.coverageEndDate, 'EEE d MMM')}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Min order progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Min. order: £{summary.minOrder.toFixed(0)}</span>
            <span className={`font-medium ${meetsMinOrder ? 'text-success' : 'text-warning'}`}>
              {meetsMinOrder ? '✓ Met' : `£${amountNeeded.toFixed(2)} to go`}
            </span>
          </div>
          <Progress value={summary.minOrderProgress} className="h-2" />
          {!meetsMinOrder && summary.subtotal > 0 && (
            <div className="flex items-start gap-2 p-2 bg-warning/10 rounded-lg text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Add £{amountNeeded.toFixed(2)} more to avoid the £{summary.deliveryFee.toFixed(2)} delivery fee</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Items list */}
        {itemCount > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Items ({itemCount})</p>
            <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
              {displayItems.map(({ sku, packs }) => (
                <div key={sku.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate flex-1 mr-2">{sku.name}</span>
                  <span className="text-muted-foreground shrink-0">×{packs}</span>
                </div>
              ))}
            </div>
            {moreCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs text-muted-foreground"
                onClick={() => navigate('/procurement/cart')}
              >
                See all (+{moreCount} more)
              </Button>
            )}
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No items in cart</p>
          </div>
        )}

        <Separator />

        {/* Totals */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">£{summary.subtotal.toFixed(2)}</span>
          </div>
          {summary.deliveryFee > 0 && (
            <div className="flex justify-between text-warning">
              <span>Delivery fee</span>
              <span>£{summary.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {summary.deliveryFee === 0 && summary.subtotal >= summary.minOrder && (
            <div className="flex justify-between text-success">
              <span>Delivery</span>
              <span>FREE</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT (21%)</span>
            <span className="text-foreground">£{summary.tax.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">£{summary.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate('/procurement/cart')}
            disabled={itemCount === 0}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
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
              className="w-full text-muted-foreground"
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
