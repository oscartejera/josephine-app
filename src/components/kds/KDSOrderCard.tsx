import { useState, useEffect } from 'react';
import { Check, Clock, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KDSOrder, KDSTicketLine } from '@/hooks/useKDSData';

interface KDSOrderCardProps {
  order: KDSOrder;
  onItemStatusChange: (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => void;
  onCompleteOrder: (ticketId: string) => void;
  isNew?: boolean;
}

function getElapsedMinutes(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
}

function getUrgencyColor(minutes: number): { border: string; bg: string; text: string; pulse: boolean } {
  if (minutes < 5) {
    return { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', pulse: false };
  } else if (minutes < 10) {
    return { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', pulse: false };
  } else {
    return { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400', pulse: true };
  }
}

export function KDSOrderCard({ order, onItemStatusChange, onCompleteOrder, isNew }: KDSOrderCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(getElapsedMinutes(order.openedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(order.openedAt));
    }, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [order.openedAt]);

  const urgency = getUrgencyColor(elapsedMinutes);
  const displayName = order.tableNumber 
    ? `Mesa ${order.tableNumber}` 
    : order.tableName || 'Sin mesa';

  const pendingItems = order.items.filter(i => i.prep_status === 'pending').length;
  const preparingItems = order.items.filter(i => i.prep_status === 'preparing').length;

  const handleItemClick = (item: KDSTicketLine) => {
    if (item.prep_status === 'pending') {
      onItemStatusChange(item.id, 'preparing');
    } else if (item.prep_status === 'preparing') {
      onItemStatusChange(item.id, 'ready');
    }
  };

  return (
    <div 
      className={cn(
        "rounded-lg border-2 overflow-hidden transition-all duration-300",
        urgency.border,
        urgency.bg,
        isNew && "animate-pulse",
        urgency.pulse && "animate-pulse"
      )}
    >
      {/* Header */}
      <div className={cn("px-4 py-3 border-b border-zinc-800", urgency.bg)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{displayName}</h3>
          <div className={cn("flex items-center gap-1 font-mono text-sm", urgency.text)}>
            <Clock className="h-4 w-4" />
            <span>{elapsedMinutes} min</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          {new Date(order.openedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Items */}
      <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
        {order.items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={item.prep_status === 'ready' || item.prep_status === 'served'}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md transition-all",
              "flex items-start gap-3",
              item.prep_status === 'pending' && "bg-zinc-800 hover:bg-zinc-700 cursor-pointer",
              item.prep_status === 'preparing' && "bg-blue-900/50 hover:bg-blue-800/50 cursor-pointer border border-blue-500",
              item.prep_status === 'ready' && "bg-emerald-900/30 opacity-60 cursor-default",
              item.prep_status === 'served' && "bg-zinc-900 opacity-40 cursor-default"
            )}
          >
            {/* Status icon */}
            <div className={cn(
              "mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
              item.prep_status === 'pending' && "bg-zinc-700",
              item.prep_status === 'preparing' && "bg-blue-500 animate-pulse",
              item.prep_status === 'ready' && "bg-emerald-500",
              item.prep_status === 'served' && "bg-zinc-600"
            )}>
              {item.prep_status === 'preparing' && <ChefHat className="h-3 w-3 text-white" />}
              {(item.prep_status === 'ready' || item.prep_status === 'served') && <Check className="h-3 w-3 text-white" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{item.quantity}x</span>
                <span className="text-white font-medium truncate">{item.item_name}</span>
              </div>
              
              {/* Notes */}
              {item.notes && (
                <p className="text-xs text-amber-400 mt-1 italic">⚠️ {item.notes}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50">
        <Button
          onClick={() => onCompleteOrder(order.ticketId)}
          disabled={pendingItems === 0 && preparingItems === 0}
          className={cn(
            "w-full h-12 text-lg font-bold",
            "bg-emerald-600 hover:bg-emerald-500 text-white",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <Check className="h-5 w-5 mr-2" />
          TODO LISTO
        </Button>
      </div>
    </div>
  );
}
