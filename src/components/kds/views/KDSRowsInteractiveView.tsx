/**
 * KDSRowsInteractiveView Component
 * Vista con rows y drag & drop (solo client-side, no persiste)
 */

import { useState, useMemo } from 'react';
import { KDSCourseOrderCard } from '../KDSCourseOrderCard';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { KDSOrder } from '@/services/kds/types';

interface KDSRowsInteractiveViewProps {
  orders: KDSOrder[];
  rowsCount?: number;
  newestSide?: 'right' | 'left';
  showStartBtn?: boolean;
  showFinishBtn?: boolean;
  showServeBtn?: boolean;
  onStartLine?: (lineId: string) => void;
  onFinishLine?: (lineId: string) => void;
  onServeLine?: (lineId: string) => void;
  onStartCourse?: (ticketId: string, course: number) => void;
  onFinishCourse?: (ticketId: string, course: number) => void;
  onServeCourse?: (ticketId: string, course: number) => void;
  onMarchCourse?: (ticketId: string, course: number) => void;
  onUnmarchCourse?: (ticketId: string, course: number) => void;
}

export function KDSRowsInteractiveView({
  orders,
  rowsCount = 3,
  newestSide = 'right',
  showStartBtn = true,
  showFinishBtn = true,
  showServeBtn = false,
  onStartLine,
  onFinishLine,
  onServeLine,
  onStartCourse,
  onFinishCourse,
  onServeCourse,
  onMarchCourse,
  onUnmarchCourse,
}: KDSRowsInteractiveViewProps) {
  // Local state for drag & drop (client-side only)
  const [localOrders, setLocalOrders] = useState<KDSOrder[]>([]);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);

  // Sync orders from props
  useMemo(() => {
    setLocalOrders(orders);
  }, [orders]);

  // Distribute orders into rows
  const rows = useMemo(() => {
    const result: KDSOrder[][] = Array.from({ length: rowsCount }, () => []);
    
    // Sort orders by age
    const sortedOrders = [...localOrders].sort((a, b) => {
      const timeA = new Date(a.opened_at).getTime();
      const timeB = new Date(b.opened_at).getTime();
      return newestSide === 'right' ? timeA - timeB : timeB - timeA;
    });

    // Distribute into rows
    sortedOrders.forEach((order, idx) => {
      const rowIndex = idx % rowsCount;
      result[rowIndex].push(order);
    });

    return result;
  }, [localOrders, rowsCount, newestSide]);

  const handleDragStart = (orderId: string) => {
    setDraggedOrderId(orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetOrderId: string) => {
    if (!draggedOrderId || draggedOrderId === targetOrderId) {
      setDraggedOrderId(null);
      return;
    }

    // Reorder locally
    setLocalOrders((prev) => {
      const draggedIndex = prev.findIndex(o => o.ticket_id === draggedOrderId);
      const targetIndex = prev.findIndex(o => o.ticket_id === targetOrderId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newOrders = [...prev];
      const [draggedOrder] = newOrders.splice(draggedIndex, 1);
      newOrders.splice(targetIndex, 0, draggedOrder);

      return newOrders;
    });

    setDraggedOrderId(null);
  };

  if (orders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">👨‍🍳</div>
          <h2 className="text-2xl font-bold text-zinc-400">Sin comandas pendientes</h2>
          <p className="text-zinc-500 mt-2">Las nuevas comandas aparecerán aquí automáticamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto">
        {rows.map((rowOrders, rowIdx) => (
          <div
            key={rowIdx}
            className={cn(
              'flex gap-4 overflow-x-auto pb-2',
              newestSide === 'right' ? 'flex-row' : 'flex-row-reverse'
            )}
          >
            {rowOrders.map((order) => (
              <div
                key={order.ticket_id}
                className="flex-shrink-0 w-80 relative"
                draggable
                onDragStart={() => handleDragStart(order.ticket_id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(order.ticket_id)}
              >
                {/* Drag handle indicator */}
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 cursor-move opacity-50 hover:opacity-100 transition-opacity">
                  <GripVertical className="h-5 w-5 text-zinc-500" />
                </div>

                <div
                  className={cn(
                    'transition-all',
                    draggedOrderId === order.ticket_id && 'opacity-50 scale-95'
                  )}
                >
                  <KDSCourseOrderCard
                    order={order}
                    showStartBtn={showStartBtn}
                    showFinishBtn={showFinishBtn}
                    showServeBtn={showServeBtn}
                    onStartLine={onStartLine}
                    onFinishLine={onFinishLine}
                    onServeLine={onServeLine}
                    onStartCourse={onStartCourse}
                    onFinishCourse={onFinishCourse}
                    onServeCourse={onServeCourse}
                    onMarchCourse={onMarchCourse}
                    onUnmarchCourse={onUnmarchCourse}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="mt-2 text-center text-xs text-zinc-500">
        Arrastra las tarjetas para reorganizar (cambios locales, no se guardan)
      </div>
    </div>
  );
}
