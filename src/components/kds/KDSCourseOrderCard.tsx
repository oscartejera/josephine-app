/**
 * KDSCourseOrderCard Component
 * Tarjeta de orden con agrupación por curso, soporte para marchar y separador de items añadidos
 */

import { useState, useEffect, useMemo } from 'react';
import { Check, Clock, ChefHat, Play, Package, Flag, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { KDSModifiersList } from './KDSModifierBadge';
import type { KDSOrder, KDSCourseOrder, KDSTicketLine } from '@/services/kds/types';

interface KDSCourseOrderCardProps {
  order: KDSOrder;
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
  isSelected?: boolean;
}

function getElapsedMinutes(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
}

const COURSE_LABELS: Record<number, string> = {
  0: 'Bebidas',
  1: 'Primeros',
  2: 'Segundos',
  3: 'Postres',
};

function getCourseLabel(course: number): string {
  return COURSE_LABELS[course] || `Curso ${course}`;
}

export function KDSCourseOrderCard({
  order,
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
  isSelected = false,
}: KDSCourseOrderCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(getElapsedMinutes(order.opened_at));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(order.opened_at));
    }, 10000);
    return () => clearInterval(interval);
  }, [order.opened_at]);

  const displayName = order.table_number
    ? `Mesa ${order.table_number}`
    : order.table_name || 'Sin mesa';

  return (
    <div
      className={cn(
        'bg-zinc-900 rounded-lg border-2 transition-all',
        isSelected ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-zinc-800',
        'hover:border-zinc-700'
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold text-white">{displayName}</div>
            {order.covers > 0 && (
              <Badge variant="outline" className="text-zinc-400">
                {order.covers} PAX
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Clock className="h-4 w-4" />
            <span>{elapsedMinutes}m</span>
          </div>
        </div>
      </div>

      {/* Course Orders */}
      <div className="p-3 space-y-3">
        {order.orders.map((courseOrder, idx) => (
          <CourseOrderSection
            key={`${order.ticket_id}-${courseOrder.course}`}
            ticketId={order.ticket_id}
            courseOrder={courseOrder}
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
            isLastCourse={idx === order.orders.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

interface CourseOrderSectionProps {
  ticketId: string;
  courseOrder: KDSCourseOrder;
  showStartBtn: boolean;
  showFinishBtn: boolean;
  showServeBtn: boolean;
  onStartLine?: (lineId: string) => void;
  onFinishLine?: (lineId: string) => void;
  onServeLine?: (lineId: string) => void;
  onStartCourse?: (ticketId: string, course: number) => void;
  onFinishCourse?: (ticketId: string, course: number) => void;
  onServeCourse?: (ticketId: string, course: number) => void;
  onMarchCourse?: (ticketId: string, course: number) => void;
  onUnmarchCourse?: (ticketId: string, course: number) => void;
  isLastCourse: boolean;
}

function CourseOrderSection({
  ticketId,
  courseOrder,
  showStartBtn,
  showFinishBtn,
  showServeBtn,
  onStartLine,
  onFinishLine,
  onServeLine,
  onStartCourse,
  onFinishCourse,
  onServeCourse,
  onMarchCourse,
  onUnmarchCourse,
  isLastCourse,
}: CourseOrderSectionProps) {
  // Detect added items (items with sent_at > first sent_at)
  const firstSentAt = useMemo(() => {
    const sentTimes = courseOrder.items
      .filter(item => item.sent_at)
      .map(item => new Date(item.sent_at!).getTime());
    return sentTimes.length > 0 ? Math.min(...sentTimes) : null;
  }, [courseOrder.items]);

  const itemsWithAddedFlag = useMemo(() => {
    return courseOrder.items.map(item => ({
      ...item,
      isAdded: firstSentAt && item.sent_at
        ? new Date(item.sent_at).getTime() > firstSentAt + 60000 // 1 min threshold
        : false,
    }));
  }, [courseOrder.items, firstSentAt]);

  const pendingCount = courseOrder.items.filter(i => i.prep_status === 'pending').length;
  const preparingCount = courseOrder.items.filter(i => i.prep_status === 'preparing').length;
  const readyCount = courseOrder.items.filter(i => i.prep_status === 'ready').length;

  return (
    <div
      className={cn(
        'rounded-md border transition-all',
        courseOrder.is_marched
          ? 'border-orange-500 bg-orange-500/10'
          : 'border-zinc-700 bg-zinc-800/50',
        !isLastCourse && 'mb-2'
      )}
    >
      {/* Course Header */}
      <div
        className={cn(
          'px-3 py-2 border-b flex items-center justify-between',
          courseOrder.is_marched
            ? 'border-orange-500/30 bg-orange-500/20'
            : 'border-zinc-700 bg-zinc-800/30'
        )}
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'font-medium',
              courseOrder.is_marched && 'border-orange-500 text-orange-400'
            )}
          >
            {getCourseLabel(courseOrder.course)}
          </Badge>
          {courseOrder.is_marched && (
            <Flag className="h-4 w-4 text-orange-400" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status badges */}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
          {preparingCount > 0 && (
            <Badge className="bg-blue-500 text-xs">
              {preparingCount} preparando
            </Badge>
          )}
          {readyCount > 0 && (
            <Badge className="bg-emerald-500 text-xs">
              {readyCount} listo{readyCount > 1 ? 's' : ''}
            </Badge>
          )}

          {/* Marchar button */}
          {onMarchCourse && onUnmarchCourse && (
            <Button
              size="sm"
              variant={courseOrder.is_marched ? 'destructive' : 'default'}
              className="h-7 text-xs"
              onClick={() => {
                if (courseOrder.is_marched) {
                  onUnmarchCourse(ticketId, courseOrder.course);
                } else {
                  onMarchCourse(ticketId, courseOrder.course);
                }
              }}
            >
              {courseOrder.is_marched ? 'Desmarchar' : 'Marchar'}
            </Button>
          )}

          {/* Course actions */}
          {showStartBtn && pendingCount > 0 && onStartCourse && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onStartCourse(ticketId, courseOrder.course)}
            >
              <Play className="h-3 w-3 mr-1" />
              Iniciar
            </Button>
          )}
          {showFinishBtn && preparingCount > 0 && onFinishCourse && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
              onClick={() => onFinishCourse(ticketId, courseOrder.course)}
            >
              <Check className="h-3 w-3 mr-1" />
              Terminar
            </Button>
          )}
          {showServeBtn && readyCount > 0 && onServeCourse && (
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 h-7 text-xs"
              onClick={() => onServeCourse(ticketId, courseOrder.course)}
            >
              <Package className="h-3 w-3 mr-1" />
              Servir
            </Button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="p-2 space-y-1">
        {itemsWithAddedFlag.map((item, idx) => (
          <div key={item.id}>
            {/* Separator for added items */}
            {item.isAdded && idx > 0 && (
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t-2 border-dashed border-zinc-600"></div>
                <span className="text-xs text-zinc-500 font-medium">Items añadidos</span>
                <div className="flex-1 border-t-2 border-dashed border-zinc-600"></div>
              </div>
            )}

            <LineItem
              item={item}
              showStartBtn={showStartBtn}
              showFinishBtn={showFinishBtn}
              showServeBtn={showServeBtn}
              onStartLine={onStartLine}
              onFinishLine={onFinishLine}
              onServeLine={onServeLine}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineItemProps {
  item: KDSTicketLine;
  showStartBtn: boolean;
  showFinishBtn: boolean;
  showServeBtn: boolean;
  onStartLine?: (lineId: string) => void;
  onFinishLine?: (lineId: string) => void;
  onServeLine?: (lineId: string) => void;
}

function LineItem({
  item,
  showStartBtn,
  showFinishBtn,
  showServeBtn,
  onStartLine,
  onFinishLine,
  onServeLine,
}: LineItemProps) {
  const statusColor = {
    pending: 'bg-zinc-700 text-zinc-300',
    preparing: 'bg-blue-500/20 text-blue-300 border-blue-500',
    ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500',
    served: 'bg-zinc-600 text-zinc-400',
  }[item.prep_status];

  const canStart = item.prep_status === 'pending';
  const canFinish = item.prep_status === 'preparing';
  const canServe = item.prep_status === 'ready';

  return (
    <div
      className={cn(
        'p-2 rounded border flex items-center justify-between',
        statusColor
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold">{item.quantity}x</span>
          <span className="font-medium">{item.item_name}</span>
          {item.is_rush && (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          )}
        </div>
        {item.modifiers.length > 0 && (
          <div className="mt-1">
            <KDSModifiersList modifiers={item.modifiers} />
          </div>
        )}
        {item.notes && (
          <div className="mt-1 text-xs text-zinc-400 italic">
            {item.notes}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showStartBtn && canStart && onStartLine && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onStartLine(item.id)}
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        {showFinishBtn && canFinish && onFinishLine && (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 h-8 w-8 p-0"
            onClick={() => onFinishLine(item.id)}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        {showServeBtn && canServe && onServeLine && (
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 h-8 w-8 p-0"
            onClick={() => onServeLine(item.id)}
          >
            <Package className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
