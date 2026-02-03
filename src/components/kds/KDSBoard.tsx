/**
 * KDSBoard Component
 * Kitchen Display System board with order cards
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Clock, ChefHat } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { KDSOrder, KDSOrderItem } from '@/hooks/useKDSData';

interface KDSBoardProps {
  orders: KDSOrder[];
  onItemStatusChange: (lineId: string, status: 'pending' | 'preparing' | 'ready' | 'served') => void;
  onCompleteOrder: (ticketId: string) => void;
}

export function KDSBoard({
  orders,
  onItemStatusChange,
  onCompleteOrder,
}: KDSBoardProps) {
  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-muted';
      case 'preparing': return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300';
      case 'ready': return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300';
      default: return 'bg-muted';
    }
  };

  const getOrderAge = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 5) return 'text-muted-foreground';
    if (minutes < 10) return 'text-amber-600';
    return 'text-red-600';
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <ChefHat className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium">Sin comandas activas</h3>
        <p className="text-muted-foreground">
          Las nuevas comandas aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders.map(order => {
          const allReady = order.items.every(item => item.status === 'ready');
          
          return (
            <Card
              key={order.id}
              className={cn(
                "overflow-hidden",
                allReady && "ring-2 ring-emerald-500"
              )}
            >
              {/* Header */}
              <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">#{order.orderNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {order.tableName || 'Sin mesa'}
                  </div>
                </div>
                <div className={cn("flex items-center gap-1 text-sm font-medium", getOrderAge(order.createdAt))}>
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(order.createdAt), { locale: es })}
                </div>
              </div>

              {/* Items */}
              <div className="p-3 space-y-2">
                {order.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      const nextStatus = 
                        item.status === 'pending' ? 'preparing' :
                        item.status === 'preparing' ? 'ready' : 'pending';
                      onItemStatusChange(item.id, nextStatus);
                    }}
                    className={cn(
                      "w-full text-left p-2 rounded-lg border transition-colors",
                      getItemStatusColor(item.status)
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{item.quantity}x</span>
                        <span className="font-medium">{item.productName}</span>
                      </div>
                      {item.status === 'ready' && (
                        <Check className="h-5 w-5 text-emerald-600" />
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                    )}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {item.modifiers.map((mod, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {mod}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Complete button */}
              {allReady && (
                <div className="p-3 border-t">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onCompleteOrder(order.ticketId)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Completar Comanda
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
