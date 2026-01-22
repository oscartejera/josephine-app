import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KDSOrder } from '@/hooks/useKDSData';

interface KDSExpeditorCardProps {
  order: KDSOrder;
  onServeItem: (lineId: string) => void;
  onServeAll: (ticketId: string) => void;
}

export function KDSExpeditorCard({ order, onServeItem, onServeAll }: KDSExpeditorCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  
  // Only show ready items
  const readyItems = order.items.filter(item => item.prep_status === 'ready');
  
  useEffect(() => {
    const calculateElapsed = () => {
      // Use the earliest ready_at time
      const earliestReady = readyItems.reduce((min, item) => {
        if (!item.ready_at) return min;
        const readyTime = new Date(item.ready_at).getTime();
        return readyTime < min ? readyTime : min;
      }, Date.now());
      
      const diff = Date.now() - earliestReady;
      setElapsedMinutes(Math.floor(diff / 60000));
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 30000);
    return () => clearInterval(interval);
  }, [readyItems]);

  if (readyItems.length === 0) return null;

  // Urgency colors for expeditor (items waiting to be served)
  const getUrgencyColor = () => {
    if (elapsedMinutes >= 3) return 'border-red-500 bg-red-500/10';
    if (elapsedMinutes >= 1) return 'border-amber-500 bg-amber-500/10';
    return 'border-emerald-500 bg-emerald-500/10';
  };

  const tableDisplay = order.tableNumber || order.tableName || 'Barra';

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden transition-all",
      getUrgencyColor()
    )}>
      {/* Header */}
      <div className="bg-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white">{tableDisplay}</span>
          <span className="text-zinc-400 text-sm">
            {readyItems.length} item{readyItems.length > 1 ? 's' : ''} listo{readyItems.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-sm font-bold",
          elapsedMinutes >= 3 ? "bg-red-500 text-white animate-pulse" :
          elapsedMinutes >= 1 ? "bg-amber-500 text-black" :
          "bg-emerald-500 text-white"
        )}>
          {elapsedMinutes}m esperando
        </div>
      </div>

      {/* Items */}
      <div className="p-3 space-y-2">
        {readyItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onServeItem(item.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
              "bg-emerald-500/20 border border-emerald-500/50",
              "hover:bg-emerald-500/30 active:scale-98"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-emerald-400">
                  {item.quantity}x
                </span>
                <span className="text-white font-medium">{item.item_name}</span>
              </div>
              {item.notes && (
                <p className="text-sm text-zinc-400 mt-1">📝 {item.notes}</p>
              )}
            </div>
            <span className="text-emerald-400 text-sm font-medium">
              Tap para servir
            </span>
          </button>
        ))}
      </div>

      {/* Serve All Button */}
      {readyItems.length > 1 && (
        <div className="p-3 pt-0">
          <button
            onClick={() => onServeAll(order.ticketId)}
            className={cn(
              "w-full py-3 rounded-lg font-bold text-lg transition-all",
              "bg-amber-600 text-white",
              "hover:bg-amber-500 active:scale-98"
            )}
          >
            🍽️ SERVIR TODO
          </button>
        </div>
      )}
    </div>
  );
}
