import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationStore } from '@/stores/notificationStore';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface TicketPayload {
  id: string;
  gross_total: number | null;
  net_total: number | null;
  covers: number | null;
  channel: string | null;
}

interface InventoryPayload {
  id: string;
  name: string;
  current_stock: number | null;
  par_level: number | null;
}

interface WastePayload {
  id: string;
  quantity: number;
  waste_value: number | null;
  reason: string | null;
}

interface PurchaseOrderPayload {
  id: string;
  status: string | null;
}

export function useGlobalRealtimeNotifications() {
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'tickets' },
        (payload: RealtimePostgresChangesPayload<TicketPayload>) => {
          const ticket = payload.new as TicketPayload;
          const amount = ticket.gross_total || ticket.net_total || 0;
          addNotification({
            type: 'sale',
            title: 'Nueva venta registrada',
            message: `Ticket de €${amount.toFixed(2)} ${ticket.covers ? `(${ticket.covers} cubiertos)` : ''}`,
            data: { ticketId: ticket.id },
          });
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'inventory_items' },
        (payload: RealtimePostgresChangesPayload<InventoryPayload>) => {
          const item = payload.new as InventoryPayload;
          const oldItem = payload.old as InventoryPayload;
          
          // Only notify if stock dropped below par level
          if (item.par_level && item.current_stock !== null && 
              item.current_stock < item.par_level &&
              (oldItem.current_stock === null || oldItem.current_stock >= item.par_level)) {
            addNotification({
              type: 'inventory',
              title: 'Stock bajo',
              message: `${item.name} está por debajo del nivel PAR (${item.current_stock}/${item.par_level})`,
              data: { itemId: item.id },
            });
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'waste_events' },
        (payload: RealtimePostgresChangesPayload<WastePayload>) => {
          const waste = payload.new as WastePayload;
          addNotification({
            type: 'waste',
            title: 'Nuevo registro de waste',
            message: `${waste.quantity} unidades ${waste.reason ? `(${waste.reason})` : ''} - €${(waste.waste_value || 0).toFixed(2)}`,
            data: { wasteId: waste.id },
          });
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'purchase_orders' },
        (payload: RealtimePostgresChangesPayload<PurchaseOrderPayload>) => {
          const order = payload.new as PurchaseOrderPayload;
          const oldOrder = payload.old as PurchaseOrderPayload;
          
          if (order.status !== oldOrder.status) {
            const statusLabels: Record<string, string> = {
              draft: 'borrador',
              sent: 'enviado',
              received: 'recibido',
            };
            addNotification({
              type: 'order',
              title: 'Pedido actualizado',
              message: `El pedido cambió a estado: ${statusLabels[order.status || ''] || order.status}`,
              data: { orderId: order.id },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification]);
}
