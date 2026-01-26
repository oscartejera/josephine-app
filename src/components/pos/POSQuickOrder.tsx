import { useState } from 'react';
import { POSProduct, CashSession } from '@/hooks/usePOSData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus, Trash2, CreditCard, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { POSPaymentModal } from './POSPaymentModal';
import { cn } from '@/lib/utils';

interface OrderLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface POSQuickOrderProps {
  locationId: string;
  products: POSProduct[];
  cashSession: CashSession | null;
  onRefresh: () => void;
}

export function POSQuickOrder({ locationId, products, cashSession, onRefresh }: POSQuickOrderProps) {
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);

  const categories = [...new Set(products.map(p => p.category || 'Otros'))].sort();
  const filteredProducts = selectedCategory 
    ? products.filter(p => (p.category || 'Otros') === selectedCategory)
    : products;

  const subtotal = orderLines.reduce((sum, line) => sum + line.total, 0);
  const tax = subtotal * 0.10;
  const total = subtotal + tax;

  const addProduct = (product: POSProduct) => {
    const existingIndex = orderLines.findIndex(line => line.product_id === product.id);

    if (existingIndex >= 0) {
      const updated = [...orderLines];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setOrderLines(updated);
    } else {
      setOrderLines([...orderLines, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.price,
        total: product.price,
      }]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...orderLines];
    updated[index].quantity = Math.max(1, updated[index].quantity + delta);
    updated[index].total = updated[index].quantity * updated[index].unit_price;
    setOrderLines(updated);
  };

  const removeLine = (index: number) => {
    setOrderLines(orderLines.filter((_, i) => i !== index));
  };

  const handlePayment = async (method: string, amount: number) => {
    setLoading(true);
    try {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          location_id: locationId,
          status: 'closed',
          service_type: 'takeaway',
          gross_total: total,
          net_total: subtotal,
          closed_at: new Date().toISOString(),
          cash_session_id: cashSession?.id,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create ticket lines
      const { error: linesError } = await supabase
        .from('ticket_lines')
        .insert(orderLines.map(line => ({
          ticket_id: ticket.id,
          product_id: line.product_id,
          item_name: line.name,
          quantity: line.quantity,
          unit_price: line.unit_price,
          gross_line_total: line.total,
        })));

      if (linesError) throw linesError;

      // Create payment
      await supabase.from('payments').insert([{
        ticket_id: ticket.id,
        amount,
        method: method as 'card' | 'cash' | 'other',
      }]);

      toast.success('Venta completada');
      setOrderLines([]);
      setShowPayment(false);
      onRefresh();
    } catch (error) {
      console.error('Error processing quick order:', error);
      toast.error('Error al procesar venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Products Area */}
      <div className="flex-1 flex flex-col">
        {/* Category Tabs */}
        <ScrollArea className="shrink-0 border-b border-border">
          <div className="flex gap-2 p-3">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              Todo
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </ScrollArea>

        {/* Products Grid */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                className={cn(
                  "aspect-square p-3 rounded-xl border-2 border-border",
                  "bg-card hover:bg-accent transition-all",
                  "flex flex-col items-center justify-center text-center gap-2",
                  "active:scale-95 touch-manipulation"
                )}
              >
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium line-clamp-2">{product.name}</span>
                <span className="text-sm font-bold text-primary">€{product.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Order Summary */}
      <div className="w-80 border-l border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Ticket Rápido</h3>
          <p className="text-sm text-muted-foreground">Modo mostrador</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {orderLines.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Añade productos
              </p>
            ) : (
              orderLines.map((line, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      €{line.unit_price.toFixed(2)} × {line.quantity}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => updateQuantity(index, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{line.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => updateQuantity(index, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <p className="w-16 text-right font-medium">
                    €{line.total.toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Totals & Pay */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>IVA (10%)</span>
              <span>€{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg"
            disabled={orderLines.length === 0 || loading}
            onClick={() => setShowPayment(true)}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Cobrar €{total.toFixed(2)}
          </Button>
        </div>
      </div>

      {showPayment && (
        <POSPaymentModal
          total={total}
          onClose={() => setShowPayment(false)}
          onPayment={handlePayment}
        />
      )}
    </div>
  );
}
