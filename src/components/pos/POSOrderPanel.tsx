import { useState, useEffect } from 'react';
import { POSTable, POSProduct } from '@/hooks/usePOSData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Plus, Minus, Trash2, Send, CreditCard, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { POSProductGrid } from './POSProductGrid';
import { POSPaymentModal } from './POSPaymentModal';

interface OrderLine {
  id?: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
  modifiers?: { name: string; option: string; price: number }[];
  sent_to_kitchen: boolean;
}

interface POSOrderPanelProps {
  table: POSTable;
  products: POSProduct[];
  locationId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function POSOrderPanel({ table, products, locationId, onClose, onRefresh }: POSOrderPanelProps) {
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [ticketId, setTicketId] = useState<string | null>(table.current_ticket_id);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [notes, setNotes] = useState('');

  const subtotal = orderLines.reduce((sum, line) => sum + line.total, 0);
  const tax = subtotal * 0.10; // 10% IVA
  const total = subtotal + tax;

  // Load existing ticket lines if table has an open ticket
  useEffect(() => {
    if (table.current_ticket_id) {
      loadTicketLines(table.current_ticket_id);
    }
  }, [table.current_ticket_id]);

  const loadTicketLines = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_lines')
      .select('*')
      .eq('ticket_id', ticketId);

    if (data) {
      setOrderLines(data.map(line => ({
        id: line.id,
        product_id: line.item_external_id || '',
        name: line.item_name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        total: line.gross_line_total,
        notes: (line as unknown as { notes?: string }).notes || undefined,
        sent_to_kitchen: (line as unknown as { sent_to_kitchen?: boolean }).sent_to_kitchen || false,
      })));
    }
  };

  const addProduct = (product: POSProduct) => {
    const existingIndex = orderLines.findIndex(
      line => line.product_id === product.id && !line.sent_to_kitchen
    );

    if (existingIndex >= 0) {
      // Increase quantity
      const updated = [...orderLines];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setOrderLines(updated);
    } else {
      // Add new line
      setOrderLines([...orderLines, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.price,
        total: product.price,
        sent_to_kitchen: false,
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

  const createOrUpdateTicket = async (): Promise<string> => {
    if (ticketId) return ticketId;

    // Create new ticket
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        location_id: locationId,
        pos_table_id: table.id,
        status: 'open',
        service_type: 'dine_in',
        gross_total: total,
        net_total: subtotal,
        covers: table.seats,
        table_name: table.table_number,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    // Update table status
    await supabase
      .from('pos_tables')
      .update({ status: 'occupied', current_ticket_id: data.id })
      .eq('id', table.id);

    setTicketId(data.id);
    return data.id;
  };

  const sendToKitchen = async () => {
    setLoading(true);
    try {
      const currentTicketId = await createOrUpdateTicket();
      
      // Get lines not yet sent to kitchen
      const newLines = orderLines.filter(line => !line.sent_to_kitchen && !line.id);
      
      if (newLines.length === 0) {
        toast.info('No hay nuevos items para enviar');
        return;
      }

      // Insert new lines
      const { error: linesError } = await supabase
        .from('ticket_lines')
        .insert(newLines.map(line => ({
          ticket_id: currentTicketId,
          product_id: line.product_id,
          item_name: line.name,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_total: line.total,
          notes: line.notes,
          sent_to_kitchen: true,
          sent_at: new Date().toISOString(),
        })));

      if (linesError) throw linesError;

      // Add to print queue
      await supabase.from('pos_print_queue').insert({
        location_id: locationId,
        ticket_id: currentTicketId,
        destination: 'kitchen',
        items_json: newLines.map(l => ({
          name: l.name,
          qty: l.quantity,
          notes: l.notes,
        })),
        status: 'pending',
      });

      // Update ticket totals
      await supabase
        .from('tickets')
        .update({ gross_total: total, net_total: subtotal })
        .eq('id', currentTicketId);

      toast.success('Comanda enviada a cocina');
      onRefresh();
      await loadTicketLines(currentTicketId);
    } catch (error) {
      console.error('Error sending to kitchen:', error);
      toast.error('Error al enviar comanda');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (method: string, amount: number) => {
    if (!ticketId) return;

    setLoading(true);
    try {
      // Create payment
      await supabase.from('payments').insert([{
        ticket_id: ticketId,
        amount,
        method,
      }]);

      // Close ticket
      await supabase
        .from('tickets')
        .update({
          status: 'closed', 
          closed_at: new Date().toISOString(),
          payment_method: method,
        })
        .eq('id', ticketId);

      toast.success('Pago completado');
      setShowPayment(false);
      onClose();
      onRefresh();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-96 border-l border-border bg-card flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold">{table.table_number}</h3>
            <p className="text-sm text-muted-foreground">{table.seats} comensales</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Product Grid */}
        <div className="h-48 border-b border-border shrink-0">
          <POSProductGrid products={products} onProductClick={addProduct} />
        </div>

        {/* Order Lines */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {orderLines.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Selecciona productos para añadir
              </p>
            ) : (
              orderLines.map((line, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg",
                    line.sent_to_kitchen ? "bg-green-500/10" : "bg-muted/50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      €{line.unit_price.toFixed(2)} × {line.quantity}
                    </p>
                    {line.sent_to_kitchen && (
                      <span className="text-xs text-green-600">✓ Enviado</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => updateQuantity(index, -1)}
                      disabled={line.sent_to_kitchen}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{line.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => updateQuantity(index, 1)}
                      disabled={line.sent_to_kitchen}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLine(index)}
                      disabled={line.sent_to_kitchen}
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

        {/* Totals */}
        <div className="border-t border-border p-4 space-y-2 shrink-0">
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

        {/* Actions */}
        <div className="p-4 border-t border-border space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              onClick={sendToKitchen}
              disabled={loading || orderLines.filter(l => !l.sent_to_kitchen).length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Cocina
            </Button>
            <Button 
              onClick={() => setShowPayment(true)}
              disabled={loading || orderLines.length === 0}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Cobrar
            </Button>
          </div>
        </div>
      </div>

      {showPayment && (
        <POSPaymentModal
          total={total}
          onClose={() => setShowPayment(false)}
          onPayment={handlePayment}
        />
      )}
    </>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
