/**
 * KDSClassicView Component
 * Vista clásica tipo masonry con columnas dinámicas
 */

import { KDSCourseOrderCard } from '../KDSCourseOrderCard';
import type { KDSOrder } from '@/services/kds/types';

interface KDSClassicViewProps {
  orders: KDSOrder[];
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

export function KDSClassicView({
  orders,
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
}: KDSClassicViewProps) {
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
    <div className="flex-1 p-4 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-min">
        {orders.map((order) => (
          <KDSCourseOrderCard
            key={order.ticket_id}
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
        ))}
      </div>
    </div>
  );
}
