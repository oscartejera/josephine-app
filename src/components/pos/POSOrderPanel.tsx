import { useState, useEffect, useCallback, useMemo } from 'react';
import { POSTable, POSProduct } from '@/hooks/usePOSData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Plus, Minus, Trash2, CreditCard, Printer, Flame, Edit2, ChefHat, Check, UtensilsCrossed, Send } from 'lucide-react';
import { toast } from 'sonner';
import { POSProductGrid } from './POSProductGrid';
import { POSSplitPaymentModal, ReceiptData } from './POSSplitPaymentModal';
import { POSReceiptDialog } from './POSReceiptDialog';
import { POSModifierDialog } from './POSModifierDialog';
import { POSCourseSelector, CourseBadge, getCourseConfig } from './POSCourseSelector';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';

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
  prep_status?: 'pending' | 'preparing' | 'ready' | 'served';
  course: number;
}

interface POSOrderPanelProps {
  table: POSTable;
  products: POSProduct[];
  locationId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function POSOrderPanel({ table, products, locationId, onClose, onRefresh }: POSOrderPanelProps) {
  const { group } = useApp();
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
  
  // Course system state
  const [selectedCourse, setSelectedCourse] = useState(1);

  const groupId = group?.id || '';

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

  // Realtime subscription for KDS status updates
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`pos-order-panel-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ticket_lines',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          loadTicketLines(ticketId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

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
      sent_to_kitchen: (line as any).sent_to_kitchen || !!line.sent_at,
      kds_destination: (line as any).destination || 'kitchen',
      is_rush: (line as any).is_rush || false,
      prep_status: (line.prep_status as 'pending' | 'preparing' | 'ready' | 'served') || 'pending',
      course: (line as any).course || 1,
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
      // Add new line with current course
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
        course: selectedCourse,
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

  const removeLine = async (index: number) => {
    const line = orderLines[index];
    
    // If line was already sent to kitchen and has an ID, delete from database
    if (line.id && line.sent_to_kitchen) {
      try {
        const { error } = await supabase
          .from('ticket_lines')
          .delete()
          .eq('id', line.id);
        
        if (error) {
          console.error('Error deleting line:', error);
          toast.error('Error al eliminar el producto');
          return;
        }
        
        toast.success(`${line.name} eliminado`);
      } catch (err) {
        console.error('Error deleting line:', err);
        toast.error('Error al eliminar el producto');
        return;
      }
    }
    
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
          course: line.course,
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
        const { data: insertedJobs } = await supabase
          .from('pos_print_queue')
          .insert(printQueueInserts)
          .select('id');
        
        // Trigger automatic printing for each job
        if (insertedJobs && insertedJobs.length > 0) {
          // Fire and forget - don't block the UI
          for (const job of insertedJobs) {
            supabase.functions.invoke('print_kitchen_ticket', {
              body: { printJobId: job.id }
            }).catch(err => {
              console.warn('Auto-print failed, job will remain in queue:', err);
            });
          }
        }
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

  const handlePayment = async (
    payments: { method: string; amount: number; tip: number; stripePaymentIntentId?: string }[],
    loyaltyData?: {
      memberId: string;
      pointsEarned: number;
      rewardRedeemed?: { id: string; value: number; type: string };
    }
  ) => {
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

      // Update ticket with loyalty member if applicable
      const ticketUpdate: Record<string, unknown> = {
        status: 'closed', 
        closed_at: new Date().toISOString(),
        tip_total: totalTip,
      };

      if (loyaltyData?.memberId) {
        ticketUpdate.loyalty_member_id = loyaltyData.memberId;
      }

      await supabase
        .from('tickets')
        .update(ticketUpdate)
        .eq('id', ticketId);

      // Release table (Square pattern - application-level logic)
      if (table?.id) {
        await supabase
          .from('pos_tables')
          .update({ 
            status: 'available', 
            current_ticket_id: null 
          })
          .eq('id', table.id);
      }

      // Process loyalty rewards and points
      if (loyaltyData) {
        // Redeem reward first if selected
        if (loyaltyData.rewardRedeemed) {
          try {
            await supabase.rpc('redeem_loyalty_reward', {
              p_member_id: loyaltyData.memberId,
              p_reward_id: loyaltyData.rewardRedeemed.id,
              p_location_id: locationId,
            });
            toast.success('Recompensa canjeada');
          } catch (error) {
            console.error('Error redeeming reward:', error);
            toast.error('Error al canjear recompensa');
          }
        }

        // Add earned points
        if (loyaltyData.pointsEarned > 0) {
          try {
            await supabase.rpc('add_loyalty_points', {
              p_member_id: loyaltyData.memberId,
              p_points: loyaltyData.pointsEarned,
              p_type: 'earned',
              p_description: `Compra en ${table.table_number}`,
              p_location_id: locationId,
              p_ticket_id: ticketId,
            });
            toast.success(`+${loyaltyData.pointsEarned} puntos acumulados`);
          } catch (error) {
            console.error('Error adding points:', error);
          }
        }
      }

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
        total: total + totalTip - (loyaltyData?.rewardRedeemed?.value || 0),
        paymentMethod: payments.map(p => {
          switch(p.method) {
            case 'card': return 'Tarjeta';
            case 'cash': return 'Efectivo';
            case 'other': return 'Bizum';
            default: return p.method;
          }
        }).join(', '),
        loyaltyPointsEarned: loyaltyData?.pointsEarned,
        loyaltyRewardRedeemed: loyaltyData?.rewardRedeemed ? `Descuento €${loyaltyData.rewardRedeemed.value.toFixed(2)}` : undefined,
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

  const getPrepStatusDisplay = (status?: 'pending' | 'preparing' | 'ready' | 'served') => {
    switch (status) {
      case 'pending':
        return { icon: ChefHat, text: 'En cocina', className: 'text-orange-500 bg-orange-500/10' };
      case 'preparing':
        return { icon: ChefHat, text: 'Preparando', className: 'text-blue-500 bg-blue-500/10 animate-pulse' };
      case 'ready':
        return { icon: Check, text: '¡Listo!', className: 'text-emerald-500 bg-emerald-500/10' };
      case 'served':
        return { icon: UtensilsCrossed, text: 'Servido', className: 'text-muted-foreground bg-muted' };
      default:
        return null;
    }
  };

  // Check if all items are ready
  const allItemsReady = orderLines.length > 0 && 
    orderLines.filter(l => l.sent_to_kitchen).every(l => l.prep_status === 'ready' || l.prep_status === 'served');

  const hasReadyItems = orderLines.some(l => l.prep_status === 'ready');

  const markAllAsServed = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      await supabase
        .from('ticket_lines')
        .update({ prep_status: 'served' })
        .eq('ticket_id', ticketId)
        .eq('prep_status', 'ready');
      
      toast.success('Items marcados como servidos');
      await loadTicketLines(ticketId);
    } catch (error) {
      console.error('Error marking as served:', error);
      toast.error('Error al marcar como servido');
    } finally {
      setLoading(false);
    }
  };

  // Group lines by course for display
  const linesByCourse = useMemo(() => {
    const grouped = new Map<number, OrderLine[]>();
    orderLines.forEach(line => {
      const course = line.course || 1;
      if (!grouped.has(course)) grouped.set(course, []);
      grouped.get(course)!.push(line);
    });
    return grouped;
  }, [orderLines]);

  // Count items per course for selector badges
  const courseCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    orderLines.filter(l => !l.sent_to_kitchen).forEach(line => {
      const course = line.course || 1;
      counts[course] = (counts[course] || 0) + 1;
    });
    return counts;
  }, [orderLines]);

  return (
    <>
      <div className="w-96 border-l border-border bg-card flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">{table.table_number}</h3>
              <p className="text-sm text-muted-foreground">{table.seats} comensales</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Course Selector */}
          <POSCourseSelector
            selectedCourse={selectedCourse}
            onCourseChange={setSelectedCourse}
            courseCounts={courseCounts}
            compact
          />
        </div>

        {/* Product Grid */}
        <div className="h-48 border-b border-border shrink-0">
          <POSProductGrid products={products} onProductClick={handleProductClick} />
        </div>

        {/* Order Lines grouped by course */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {orderLines.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Selecciona productos para añadir
              </p>
            ) : (
              Array.from(linesByCourse.entries())
                .sort(([a], [b]) => a - b)
                .map(([course, lines]) => {
                  const courseConfig = getCourseConfig(course);
                  const CourseIcon = courseConfig.icon;
                  const allCourseItemsSent = lines.every(l => l.sent_to_kitchen);
                  const allCourseItemsReady = lines.every(l => l.prep_status === 'ready' || l.prep_status === 'served');
                  const pendingInCourse = lines.filter(l => !l.sent_to_kitchen).length;
                  
                  return (
                    <div key={course} className="space-y-2">
                      {/* Course Header */}
                      <div className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md",
                        courseConfig.bgClassLight,
                        "border",
                        courseConfig.borderClass
                      )}>
                        <div className="flex items-center gap-2">
                          <CourseIcon className={cn("h-4 w-4", courseConfig.textClass)} />
                          <span className={cn("font-medium text-sm", courseConfig.textClass)}>
                            {courseConfig.label}
                          </span>
                          {allCourseItemsSent && allCourseItemsReady && (
                            <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                              ✓ Listo
                            </span>
                          )}
                        </div>
                        {pendingInCourse > 0 && (
                          <Button
                            variant="default"
                            size="sm"
                            className={cn(
                              "h-7 text-xs font-semibold gap-1.5 transition-all",
                              courseConfig.bgClass,
                              "text-white hover:opacity-90 shadow-sm"
                            )}
                            onClick={async () => {
                              // Send only this course
                              const courseLines = orderLines
                                .map((line, idx) => ({ line, idx }))
                                .filter(({ line }) => line.course === course && !line.sent_to_kitchen);
                              
                              if (courseLines.length === 0) return;
                              
                              setLoading(true);
                              try {
                                const currentTicketId = await createOrUpdateTicket();
                                
                                const { data: insertedLines, error: linesError } = await supabase
                                  .from('ticket_lines')
                                  .insert(courseLines.map(({ line }) => ({
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
                                    course: line.course,
                                  })))
                                  .select();
                                
                                if (linesError) throw linesError;
                                
                                toast.success(`${courseConfig.label} enviado a cocina`);
                                onRefresh();
                                await loadTicketLines(currentTicketId);
                              } catch (error) {
                                console.error('Error sending course:', error);
                                toast.error('Error al enviar curso');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Enviar {courseConfig.shortLabel} ➜
                          </Button>
                        )}
                      </div>
                      
                      {/* Course Items */}
                      <div className="space-y-2 pl-2">
                        {lines.map((line) => {
                          const index = orderLines.indexOf(line);
                          const prepDisplay = line.sent_to_kitchen ? getPrepStatusDisplay(line.prep_status) : null;
                          const PrepIcon = prepDisplay?.icon;
                          
                          return (
                            <div 
                              key={index} 
                              className={cn(
                                "p-2 rounded-lg",
                                !line.sent_to_kitchen && "bg-muted/50",
                                line.sent_to_kitchen && line.prep_status === 'pending' && "bg-orange-500/10 border border-orange-500/30",
                                line.sent_to_kitchen && line.prep_status === 'preparing' && "bg-blue-500/10 border border-blue-500/30",
                                line.sent_to_kitchen && line.prep_status === 'ready' && "bg-emerald-500/10 border border-emerald-500/30",
                                line.sent_to_kitchen && line.prep_status === 'served' && "bg-muted/30",
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
                                  
                                  {/* KDS Status Badge */}
                                  {prepDisplay && PrepIcon && (
                                    <div className={cn(
                                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mt-1",
                                      prepDisplay.className
                                    )}>
                                      <PrepIcon className="h-3 w-3" />
                                      <span>{prepDisplay.text}</span>
                                    </div>
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
                          );
                        })}
                      </div>
                    </div>
                  );
                })
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

        {/* Actions - Simplified: only Serve (conditional) + Pay */}
        <div className="p-4 border-t border-border space-y-2 shrink-0">
          {/* Serve button - only when items are ready */}
          {hasReadyItems && (
            <Button 
              variant="default"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={markAllAsServed}
              disabled={loading}
            >
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Servir Mesa
            </Button>
          )}
          
          {/* Pay button - always visible, full width */}
          <Button 
            className="w-full"
            onClick={async () => {
              setLoading(true);
              try {
                await createOrUpdateTicket();
                setShowPayment(true);
              } catch (error) {
                console.error('Error creating ticket:', error);
                toast.error('Error al preparar el cobro');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || orderLines.length === 0}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Cobrar €{total.toFixed(2)}
          </Button>
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
                course: selectedCourse,
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
          groupId={groupId}
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
