import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, RotateCcw, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ServedItem {
  id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
  ready_at: string | null;
  destination: 'kitchen' | 'bar' | 'prep';
}

interface ServedOrder {
  ticketId: string;
  tableName: string | null;
  closedAt: string;
  items: ServedItem[];
}

interface KDSHistoryBoardProps {
  locationId: string;
  onRecoverOrder: (ticketId: string) => void;
}

export function KDSHistoryBoard({ locationId, onRecoverOrder }: KDSHistoryBoardProps) {
  const [orders, setOrders] = useState<ServedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!locationId) return;

    try {
      // Get served items from recent tickets (last 24h)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      // First get tickets for this location
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, table_name, closed_at, status')
        .eq('location_id', locationId)
        .gte('opened_at', yesterday.toISOString())
        .order('opened_at', { ascending: false });

      if (ticketsError || !tickets || tickets.length === 0) {
        console.log('No tickets found or error:', ticketsError);
        setOrders([]);
        setLoading(false);
        return;
      }

      const ticketIds = tickets.map(t => t.id);

      // Get served lines for these tickets
      const { data: ticketLines, error: linesError } = await supabase
        .from('ticket_lines')
        .select('id, ticket_id, item_name, quantity, notes, ready_at, destination, prep_status')
        .in('ticket_id', ticketIds)
        .eq('prep_status', 'served')
        .order('ready_at', { ascending: false })
        .limit(200);

      if (linesError) {
        console.error('Error fetching lines:', linesError);
        return;
      }

      // Create tickets map for quick lookup
      const ticketsMap = new Map(tickets.map(t => [t.id, t]));

      // Group by ticket
      const ordersMap = new Map<string, ServedOrder>();

      for (const line of ticketLines || []) {
        const ticket = ticketsMap.get(line.ticket_id);
        if (!ticket) continue;

        if (!ordersMap.has(line.ticket_id)) {
          ordersMap.set(line.ticket_id, {
            ticketId: line.ticket_id,
            tableName: ticket.table_name,
            closedAt: line.ready_at || ticket.closed_at || new Date().toISOString(),
            items: [],
          });
        }

        ordersMap.get(line.ticket_id)!.items.push({
          id: line.id,
          item_name: line.item_name || 'Item',
          quantity: Number(line.quantity) || 1,
          notes: line.notes,
          ready_at: line.ready_at,
          destination: (line.destination || 'kitchen') as ServedItem['destination'],
        });
      }

      // Sort by most recent first
      const sorted = Array.from(ordersMap.values()).sort(
        (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
      );

      setOrders(sorted);
    } catch (error) {
      console.error('Error in fetchHistory:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchHistory();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    return `hace ${hours}h ${mins % 60}m`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <History className="h-16 w-16 mb-4" />
        <p className="text-lg">No hay comandas servidas</p>
        <p className="text-sm">Las comandas servidas en las últimas 24h aparecerán aquí</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => (
          <div
            key={order.ticketId}
            className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="bg-zinc-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-zinc-100">
                  {order.tableName || `Ticket`}
                </span>
              </div>
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getTimeAgo(order.closedAt)}
              </span>
            </div>

            {/* Items */}
            <div className="p-3 space-y-2">
              {order.items.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <span className="text-zinc-500 font-mono w-6">{item.quantity}x</span>
                  <div className="flex-1">
                    <span className="text-zinc-300">{item.item_name}</span>
                    {item.notes && (
                      <p className="text-zinc-600 text-xs italic">{item.notes}</p>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    item.destination === 'bar' ? 'bg-purple-500/20 text-purple-400' :
                    item.destination === 'prep' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-orange-500/20 text-orange-400'
                  )}>
                    {item.destination === 'bar' ? 'Bar' : 
                     item.destination === 'prep' ? 'Prep' : 'Cocina'}
                  </span>
                </div>
              ))}
              {order.items.length > 5 && (
                <p className="text-xs text-zinc-600">
                  +{order.items.length - 5} más...
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 pb-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                onClick={() => onRecoverOrder(order.ticketId)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                Recuperar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
