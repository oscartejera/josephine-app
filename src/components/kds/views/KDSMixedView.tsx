/**
 * KDSMixedView Component
 * Vista mixta con rows pero sin drag & drop, entrada estable por newest_side
 */

import { useMemo } from 'react';
import { KDSCourseOrderCard } from '../KDSCourseOrderCard';
import { cn } from '@/lib/utils';
import type { KDSOrder } from '@/services/kds/types';

interface KDSMixedViewProps {
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

export function KDSMixedView({
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
}: KDSMixedViewProps) {
  // Distribute orders into rows
  const rows = useMemo(() => {
    const result: KDSOrder[][] = Array.from({ length: rowsCount }, () => []);
    
    // Sort orders by age (oldest first if newest is right, newest first if newest is left)
    const sortedOrders = [...orders].sort((a, b) => {
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
  }, [orders, rowsCount, newestSide]);

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
              <div key={order.ticket_id} className="flex-shrink-0 w-80">
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
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
