import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';

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

interface EmployeePayload {
  id: string;
  full_name: string;
  role_name: string | null;
  active: boolean | null;
}

interface ClockRecordPayload {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
}

interface AnnouncementPayload {
  id: string;
  title: string;
  content: string | null;
}

export function useGlobalRealtimeNotifications() {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Don't subscribe to Realtime until session is available
    if (!session) return;

    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'pos_daily_finance' },
        (payload: RealtimePostgresChangesPayload<TicketPayload>) => {
          const record = payload.new as TicketPayload;
          const amount = record.gross_total || record.net_total || 0;
          addNotification({
            type: 'sale',
            title: 'Nueva venta registrada',
            message: `Ventas diarias de €${amount.toFixed(2)}`,
            data: { ticketId: record.id },
          });
          // Invalidate sales queries so dashboard updates
          queryClient.invalidateQueries({ queryKey: ['sales'] });
          queryClient.invalidateQueries({ queryKey: ['kpi'] });
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
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
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
          queryClient.invalidateQueries({ queryKey: ['waste'] });
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
              title: t('notifications.pedidoActualizado'),
              message: `El pedido cambió a estado: ${statusLabels[order.status || ''] || order.status}`,
              data: { orderId: order.id },
            });
          }
          queryClient.invalidateQueries({ queryKey: ['procurement'] });
        }
      )
      // ── NEW: Employee changes (hires, role changes, deactivations)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'employees' },
        (payload: RealtimePostgresChangesPayload<EmployeePayload>) => {
          const emp = payload.new as EmployeePayload;
          if (payload.eventType === 'INSERT') {
            addNotification({
              type: 'team',
              title: 'Nuevo empleado',
              message: `${emp.full_name} se ha unido al equipo`,
              data: { employeeId: emp.id },
            });
          }
          queryClient.invalidateQueries({ queryKey: ['employees'] });
          queryClient.invalidateQueries({ queryKey: ['labour'] });
        }
      )
      // ── NEW: Clock in/out events
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'clock_records' },
        (payload: RealtimePostgresChangesPayload<ClockRecordPayload>) => {
          queryClient.invalidateQueries({ queryKey: ['clock'] });
          queryClient.invalidateQueries({ queryKey: ['timesheet'] });
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'clock_records' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clock'] });
          queryClient.invalidateQueries({ queryKey: ['timesheet'] });
        }
      )
      // ── NEW: Announcements (team news)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload: RealtimePostgresChangesPayload<AnnouncementPayload>) => {
          const ann = payload.new as AnnouncementPayload;
          addNotification({
            type: 'announcement',
            title: 'Nuevo anuncio',
            message: ann.title,
            data: { announcementId: ann.id },
          });
          queryClient.invalidateQueries({ queryKey: ['announcements'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification, session, queryClient]);
}

