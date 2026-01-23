import { useState, useEffect } from 'react';
import { POSTable, POSProduct } from '@/hooks/usePOSData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Plus, Minus, Trash2, CreditCard, Printer, Flame, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { POSProductGrid } from './POSProductGrid';
import { POSSplitPaymentModal, ReceiptData } from './POSSplitPaymentModal';
import { POSReceiptDialog } from './POSReceiptDialog';
import { POSModifierDialog } from './POSModifierDialog';
import { cn } from '@/lib/utils';

interface OrderLineModifier {
  modifier_name: string;
  option_name: string;
  price_delta: number;
  type: 'add' | 'remove' | 'substitute';
}

interface OrderLine {
  id?: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
  modifiers: OrderLineModifier[];
  sent_to_kitchen: boolean;
  kds_destination?: 'kitchen' | 'bar' | 'prep';
  is_rush?: boolean;
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
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [notes, setNotes] = useState('');
  
  // Modifier dialog state
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<POSProduct | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

  // Calculate totals including modifier price deltas
  const calculateLineTotal = (line: OrderLine): number => {
    const modifiersCost = line.modifiers.reduce((sum, m) => sum + m.price_delta, 0);
    return (line.unit_price + modifiersCost) * line.quantity;
  };

  const subtotal = orderLines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const tax = subtotal * 0.10;
  const total = subtotal + tax;

  useEffect(() => {
    if (table.current_ticket_id) {
      loadTicketLines(table.current_ticket_id);
    }
  }, [table.current_ticket_id]);

  const loadTicketLines = async (ticketId: string) => {
    // Load lines with modifiers
    const { data: lines } = await supabase
      .from('ticket_lines')
      .select('*')
      .eq('ticket_id', ticketId);

    if (!lines) return;

    // Load modifiers for each line
    const lineIds = lines.map(l => l.id);
    const { data: modifiers } = await supabase
      .from('ticket_line_modifiers')
      .select('*')
      .in('ticket_line_id', lineIds);

    const modifiersMap = new Map<string, OrderLineModifier[]>();
    (modifiers || []).forEach(mod => {
      if (!modifiersMap.has(mod.ticket_line_id)) {
        modifiersMap.set(mod.ticket_line_id, []);
      }
      // Determine type from modifier/option names
      const lower = (mod.modifier_name + mod.option_name).toLowerCase();
      let type: 'add' | 'remove' | 'substitute' = 'add';
      if (lower.includes('sin') || lower.includes('quitar')) type = 'remove';
      else if (lower.includes('cambiar') || lower.includes('sustituir')) type = 'substitute';
      
      modifiersMap.get(mod.ticket_line_id)!.push({
        modifier_name: mod.modifier_name,
        option_name: mod.option_name || '',
        price_delta: Number(mod.price_delta) || 0,
        type,
      });
    });

    setOrderLines(lines.map(line => ({
      id: line.id,
      product_id: (line as any).product_id || line.item_external_id || '',
      name: line.item_name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      total: line.gross_line_total,
      notes: (line as any).notes || undefined,
      modifiers: modifiersMap.get(line.id) || [],
      sent_to_kitchen: (line as any).sent_to_kitchen || false,
      kds_destination: (line as any).destination || 'kitchen',
      is_rush: (line as any).is_rush || false,
    })));
  };

  const handleProductClick = (product: POSProduct) => {
    // Check if product exists and is not sent yet
    const existingIndex = orderLines.findIndex(
      line => line.product_id === product.id && !line.sent_to_kitchen && line.modifiers.length === 0
    );

    if (existingIndex >= 0) {
      // Increase quantity of existing line without modifiers
      const updated = [...orderLines];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total = calculateLineTotal(updated[existingIndex]);
      setOrderLines(updated);
    } else {
      // Open modifier dialog for new product
      setPendingProduct(product);
      setEditingLineIndex(null);
      setModifierDialogOpen(true);
    }
  };

  const handleEditLine = (index: number) => {
    const line = orderLines[index];
    if (line.sent_to_kitchen) return;
    
    const product = products.find(p => p.id === line.product_id);
    if (product) {
      setPendingProduct(product);
      setEditingLineIndex(index);
      setModifierDialogOpen(true);
    }
  };

  const handleModifierConfirm = (modifiers: OrderLineModifier[], itemNotes: string, isRush: boolean) => {
    if (!pendingProduct) return;

    if (editingLineIndex !== null) {
      // Update existing line
      const updated = [...orderLines];
      updated[editingLineIndex] = {
        ...updated[editingLineIndex],
        modifiers,
        notes: itemNotes || undefined,
        is_rush: isRush,
        total: calculateLineTotal({ ...updated[editingLineIndex], modifiers }),
      };
      setOrderLines(updated);
    } else {
      // Add new line
      const newLine: OrderLine = {
        product_id: pendingProduct.id,
        name: pendingProduct.name,
        quantity: 1,
        unit_price: pendingProduct.price,
        total: pendingProduct.price + modifiers.reduce((sum, m) => sum + m.price_delta, 0),
        notes: itemNotes || undefined,
        modifiers,
        sent_to_kitchen: false,
        kds_destination: pendingProduct.kds_destination || 'kitchen',
        is_rush: isRush,
      };
      setOrderLines([...orderLines, newLine]);
    }

    setPendingProduct(null);
    setEditingLineIndex(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...orderLines];
    updated[index].quantity = Math.max(1, updated[index].quantity + delta);
    updated[index].total = calculateLineTotal(updated[index]);
    setOrderLines(updated);
  };

  const removeLine = (index: number) => {
    setOrderLines(orderLines.filter((_, i) => i !== index));
  };

  const createOrUpdateTicket = async (): Promise<string> => {
    if (ticketId) return ticketId;

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
      
      const newLines = orderLines.filter(line => !line.sent_to_kitchen && !line.id);
      
      if (newLines.length === 0) {
        toast.info('No hay nuevos items para enviar');
        return;
      }

      // Insert lines
      const { data: insertedLines, error: linesError } = await supabase
        .from('ticket_lines')
        .insert(newLines.map(line => ({
          ticket_id: currentTicketId,
          product_id: line.product_id,
          item_name: line.name,
          quantity: line.quantity,
          unit_price: line.unit_price,
          gross_line_total: calculateLineTotal(line),
          notes: line.notes,
          sent_to_kitchen: true,
          sent_at: new Date().toISOString(),
          destination: line.kds_destination || 'kitchen',
          prep_status: 'pending',
          is_rush: line.is_rush || false,
        })))
        .select();

      if (linesError) throw linesError;

      // Insert modifiers for each line
      if (insertedLines) {
        const modifierInserts: any[] = [];
        
        newLines.forEach((line, idx) => {
          const insertedLine = insertedLines[idx];
          if (insertedLine && line.modifiers.length > 0) {
            line.modifiers.forEach(mod => {
              modifierInserts.push({
                ticket_line_id: insertedLine.id,
                modifier_name: mod.modifier_name,
                option_name: mod.option_name,
                price_delta: mod.price_delta,
              });
            });
          }
        });

        if (modifierInserts.length > 0) {
          await supabase.from('ticket_line_modifiers').insert(modifierInserts);
        }
      }

      // Print queue
      const destinations = ['kitchen', 'bar', 'prep'] as const;
      const printQueueInserts = destinations
        .map(dest => {
          const destLines = newLines.filter(l => (l.kds_destination || 'kitchen') === dest);
          if (destLines.length === 0) return null;
          return {
            location_id: locationId,
            ticket_id: currentTicketId,
            destination: dest,
            items_json: destLines.map(l => ({
              name: l.name,
              qty: l.quantity,
              notes: l.notes,
              modifiers: l.modifiers.map(m => `${m.modifier_name}: ${m.option_name}`),
              rush: l.is_rush,
            })),
            status: 'pending',
          };
        })
        .filter(Boolean);

      if (printQueueInserts.length > 0) {
        await supabase.from('pos_print_queue').insert(printQueueInserts);
      }

      // Update ticket totals
      await supabase
        .from('tickets')
        .update({ gross_total: total, net_total: subtotal })
        .eq('id', currentTicketId);

      toast.success('Comanda enviada');
      onRefresh();
      await loadTicketLines(currentTicketId);
    } catch (error) {
      console.error('Error sending to kitchen:', error);
      toast.error('Error al enviar comanda');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (payments: { method: string; amount: number; tip: number; stripePaymentIntentId?: string }[]) => {
    if (!ticketId) return;

    setLoading(true);
    try {
      // Calculate total tip
      const totalTip = payments.reduce((sum, p) => sum + p.tip, 0);
      
      // Insert all payments
      for (const payment of payments) {
        await supabase.from('payments').insert([{
          ticket_id: ticketId,
          amount: payment.amount,
          method: payment.method as 'card' | 'cash' | 'other',
          tip_amount: payment.tip,
          stripe_payment_intent_id: payment.stripePaymentIntentId || null,
        }]);
      }

      // Determine primary payment method
      const primaryMethod = payments.length > 1 ? 'split' : payments[0]?.method || 'card';

      await supabase
        .from('tickets')
        .update({
          status: 'closed', 
          closed_at: new Date().toISOString(),
          payment_method: primaryMethod,
          tip_total: totalTip,
        })
        .eq('id', ticketId);

      // Generate receipt data
      const receipt: ReceiptData = {
        ticketNumber: `#${ticketId.slice(-6).toUpperCase()}`,
        date: new Date().toLocaleString('es-ES'),
        tableName: table.table_number,
        items: orderLines.map(l => ({
          name: l.name,
          qty: l.quantity,
          price: l.unit_price,
          total: calculateLineTotal(l),
        })),
        subtotal,
        tax,
        tip: totalTip,
        total: total + totalTip,
        paymentMethod: payments.map(p => {
          switch(p.method) {
            case 'card': return 'Tarjeta';
            case 'cash': return 'Efectivo';
            case 'other': return 'Bizum';
            default: return p.method;
          }
        }).join(', '),
      };
      
      setReceiptData(receipt);
      setShowPayment(false);
      setShowReceipt(true);
      
      toast.success('Pago completado');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar pago');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptClose = () => {
    setShowReceipt(false);
    setReceiptData(null);
    onClose();
    onRefresh();
  };

  const handlePrintReceipt = (data: ReceiptData) => {
    // This is called from the payment modal for immediate print
    setReceiptData(data);
  };

  const getModifierBadgeColor = (type: 'add' | 'remove' | 'substitute') => {
    switch (type) {
      case 'remove': return 'bg-red-500/20 text-red-400';
      case 'add': return 'bg-emerald-500/20 text-emerald-400';
      case 'substitute': return 'bg-amber-500/20 text-amber-400';
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
          <POSProductGrid products={products} onProductClick={handleProductClick} />
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
                    "p-2 rounded-lg",
                    line.sent_to_kitchen ? "bg-green-500/10" : "bg-muted/50",
                    line.is_rush && !line.sent_to_kitchen && "ring-2 ring-amber-500"
                  )}
                >
                  {/* Main line */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {line.is_rush && <Flame className="h-4 w-4 text-amber-500 shrink-0" />}
                        <p className="font-medium text-sm truncate">{line.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        €{line.unit_price.toFixed(2)} × {line.quantity}
                      </p>
                      {line.sent_to_kitchen && (
                        <span className="text-xs text-green-600">✓ Enviado</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {!line.sent_to_kitchen && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => handleEditLine(index)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
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
                      €{calculateLineTotal(line).toFixed(2)}
                    </p>
                  </div>

                  {/* Modifiers */}
                  {line.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 ml-1">
                      {line.modifiers.map((mod, modIdx) => (
                        <span 
                          key={modIdx}
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            getModifierBadgeColor(mod.type)
                          )}
                        >
                          {mod.option_name}
                          {mod.price_delta !== 0 && ` (+€${mod.price_delta.toFixed(2)})`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {line.notes && (
                    <p className="text-xs text-amber-500 mt-1 ml-1 italic">⚠️ {line.notes}</p>
                  )}
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

      {/* Modifier Dialog */}
      {pendingProduct && (
        <POSModifierDialog
          open={modifierDialogOpen}
          onClose={() => {
            setModifierDialogOpen(false);
            // If closing without confirming and it's a new product, add it without modifiers
            if (editingLineIndex === null && pendingProduct) {
              const newLine: OrderLine = {
                product_id: pendingProduct.id,
                name: pendingProduct.name,
                quantity: 1,
                unit_price: pendingProduct.price,
                total: pendingProduct.price,
                modifiers: [],
                sent_to_kitchen: false,
                kds_destination: pendingProduct.kds_destination || 'kitchen',
              };
              setOrderLines([...orderLines, newLine]);
            }
            setPendingProduct(null);
            setEditingLineIndex(null);
          }}
          product={pendingProduct}
          onConfirm={handleModifierConfirm}
        />
      )}

      {showPayment && ticketId && (
        <POSSplitPaymentModal
          total={total}
          subtotal={subtotal}
          tax={tax}
          orderLines={orderLines.map(l => ({
            id: l.id,
            name: l.name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            total: calculateLineTotal(l),
          }))}
          tableName={table.table_number}
          covers={table.seats}
          ticketId={ticketId}
          locationId={locationId}
          onClose={() => setShowPayment(false)}
          onPayment={handlePayment}
          onPrintReceipt={handlePrintReceipt}
        />
      )}

      {showReceipt && receiptData && (
        <POSReceiptDialog
          open={showReceipt}
          onClose={handleReceiptClose}
          data={receiptData}
        />
      )}
    </>
  );
}
