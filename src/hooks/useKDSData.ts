import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface KDSTicketLine {
  id: string;
  ticket_id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
  prep_status: 'pending' | 'preparing' | 'ready' | 'served';
  prep_started_at: string | null;
  ready_at: string | null;
  sent_at: string | null;
  destination: 'kitchen' | 'bar' | 'prep';
}

export interface KDSOrder {
  ticketId: string;
  tableName: string | null;
  tableNumber: string | null;
  serverName: string | null;
  openedAt: string;
  items: KDSTicketLine[];
}

export function useKDSData(locationId: string) {
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderCountRef = useRef(0);
  const notificationPermissionRef = useRef<NotificationPermission>('default');

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      notificationPermissionRef.current = Notification.permission;
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          notificationPermissionRef.current = permission;
        });
      }
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && notificationPermissionRef.current === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'kds-new-order',
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/notification.mp3');
    }
    audioRef.current.play().catch(console.error);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!locationId) return;

    try {
      // First get tickets for this location
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, table_name, opened_at, pos_table_id, server_id')
        .eq('location_id', locationId)
        .eq('status', 'open');

      if (ticketsError) {
        console.error('Error fetching tickets:', ticketsError);
        return;
      }

      if (!tickets || tickets.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const ticketIds = tickets.map(t => t.id);

      // Get ticket lines for these tickets
      const { data: ticketLines, error: linesError } = await supabase
        .from('ticket_lines')
        .select('*')
        .in('ticket_id', ticketIds)
        .eq('sent_to_kitchen', true)
        .order('sent_at', { ascending: true });

      if (linesError) {
        console.error('Error fetching ticket lines:', linesError);
        return;
      }

      // Filter by prep_status in memory (since it's a new column)
      const pendingLines = (ticketLines || []).filter(
        line => !line.prep_status || line.prep_status === 'pending' || line.prep_status === 'preparing'
      );

      // Group by ticket
      const ordersMap = new Map<string, KDSOrder>();

      for (const line of pendingLines) {
        const ticket = tickets.find(t => t.id === line.ticket_id);
        if (!ticket) continue;

        if (!ordersMap.has(line.ticket_id)) {
          // Fetch table number if exists
          let tableNumber: string | null = null;
          if (ticket.pos_table_id) {
            const { data: tableData } = await supabase
              .from('pos_tables')
              .select('table_number')
              .eq('id', ticket.pos_table_id)
              .single();
            tableNumber = tableData?.table_number || null;
          }

          ordersMap.set(line.ticket_id, {
            ticketId: line.ticket_id,
            tableName: ticket.table_name,
            tableNumber,
            serverName: null,
            openedAt: ticket.opened_at,
            items: []
          });
        }

        ordersMap.get(line.ticket_id)!.items.push({
          id: line.id,
          ticket_id: line.ticket_id,
          item_name: line.item_name || 'Item',
          quantity: Number(line.quantity) || 1,
          notes: line.notes,
          prep_status: (line.prep_status || 'pending') as KDSTicketLine['prep_status'],
          prep_started_at: line.prep_started_at,
          ready_at: line.ready_at,
          sent_at: line.sent_at,
          destination: (line.destination || 'kitchen') as KDSTicketLine['destination']
        });
      }

      const newOrders = Array.from(ordersMap.values()).sort(
        (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
      );

      // Play sound and show browser notification if new orders arrived
      if (newOrders.length > previousOrderCountRef.current && previousOrderCountRef.current > 0) {
        const newOrdersCount = newOrders.length - previousOrderCountRef.current;
        playNotificationSound();
        showBrowserNotification(
          `🍳 ${newOrdersCount} nueva${newOrdersCount > 1 ? 's' : ''} comanda${newOrdersCount > 1 ? 's' : ''}`,
          `Tienes ${newOrders.length} comanda${newOrders.length > 1 ? 's' : ''} pendiente${newOrders.length > 1 ? 's' : ''} en cocina`
        );
      }
      previousOrderCountRef.current = newOrders.length;

      setOrders(newOrders);
    } catch (error) {
      console.error('Error in fetchOrders:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId, playNotificationSound, showBrowserNotification]);

  // Update item status - using raw SQL update to handle new columns
  const updateItemStatus = useCallback(async (
    lineId: string, 
    newStatus: 'pending' | 'preparing' | 'ready' | 'served'
  ) => {
    const updates: Record<string, unknown> = {
      prep_status: newStatus
    };

    if (newStatus === 'preparing') {
      updates.prep_started_at = new Date().toISOString();
    } else if (newStatus === 'ready') {
      updates.ready_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('ticket_lines')
      .update(updates as any)
      .eq('id', lineId);

    if (error) {
      console.error('Error updating item status:', error);
      return false;
    }

    // Refresh data
    fetchOrders();
    return true;
  }, [fetchOrders]);

  // Mark all items in order as ready
  const completeOrder = useCallback(async (ticketId: string) => {
    const { error } = await supabase
      .from('ticket_lines')
      .update({
        prep_status: 'ready',
        ready_at: new Date().toISOString()
      } as any)
      .eq('ticket_id', ticketId)
      .eq('sent_to_kitchen', true);

    if (error) {
      console.error('Error completing order:', error);
      return false;
    }

    // Refresh data
    fetchOrders();
    return true;
  }, [fetchOrders]);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`kds-${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_lines'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchOrders]);

  return {
    orders,
    loading,
    isConnected,
    updateItemStatus,
    completeOrder,
    refetch: fetchOrders
  };
}
