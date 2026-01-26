import { useState, useEffect, useMemo } from 'react';
import { Check, Clock, ChefHat, AlertTriangle, Flame, Soup, UtensilsCrossed, IceCream2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KDSModifiersList } from './KDSModifierBadge';
import type { KDSOrder, KDSTicketLine } from '@/hooks/useKDSData';

// Course configuration for KDS display
const KDS_COURSE_CONFIG = {
  1: { label: '1º Curso', color: 'emerald', icon: Soup, bgClass: 'bg-emerald-500/20', borderClass: 'border-emerald-500', textClass: 'text-emerald-400' },
  2: { label: '2º Curso', color: 'blue', icon: UtensilsCrossed, bgClass: 'bg-blue-500/20', borderClass: 'border-blue-500', textClass: 'text-blue-400' },
  3: { label: 'Postre', color: 'purple', icon: IceCream2, bgClass: 'bg-purple-500/20', borderClass: 'border-purple-500', textClass: 'text-purple-400' },
} as const;

function getCourseConfig(course: number) {
  return KDS_COURSE_CONFIG[course as keyof typeof KDS_COURSE_CONFIG] || KDS_COURSE_CONFIG[1];
}

interface KDSOrderCardProps {
  order: KDSOrder;
  onItemStatusChange: (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => void;
  onCompleteOrder: (ticketId: string) => void;
  isNew?: boolean;
  getItemOverdueInfo?: (item: KDSTicketLine) => { isOverdue: boolean; isWarning: boolean; overdueMinutes: number; elapsedMinutes: number; threshold: number; progressPercent: number };
  isSelected?: boolean;
  selectedItemIndex?: number;
}

function getElapsedMinutes(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
}

// Default visual style - no urgency pulsing by default
// Only pulse when items are actually overdue (exceed target_prep_time)
function getTimeDisplayColor(minutes: number): { text: string } {
  if (minutes < 5) {
    return { text: 'text-zinc-400' };
  } else if (minutes < 10) {
    return { text: 'text-zinc-300' };
  } else {
    return { text: 'text-zinc-200' };
  }
}

export function KDSOrderCard({ 
  order, 
  onItemStatusChange, 
  onCompleteOrder, 
  isNew, 
  getItemOverdueInfo,
  isSelected = false,
  selectedItemIndex,
}: KDSOrderCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(getElapsedMinutes(order.openedAt));
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(order.openedAt));
      forceUpdate(n => n + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [order.openedAt]);

  const timeDisplay = getTimeDisplayColor(elapsedMinutes);
  const displayName = order.tableNumber 
    ? (order.tableName?.includes('Mesa') ? order.tableName : `Mesa ${order.tableNumber}`)
    : order.tableName || 'Sin mesa';

  const pendingItems = order.items.filter(i => i.prep_status === 'pending').length;
  const preparingItems = order.items.filter(i => i.prep_status === 'preparing').length;
  
  const activeItems = order.items.filter(
    item => item.prep_status === 'pending' || item.prep_status === 'preparing'
  );

  const hasRushItems = order.items.some(item => item.is_rush);

  // Group items by course
  const itemsByCourse = useMemo(() => {
    const grouped = new Map<number, KDSTicketLine[]>();
    order.items.forEach(item => {
      const course = item.course || 1;
      if (!grouped.has(course)) grouped.set(course, []);
      grouped.get(course)!.push(item);
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
  }, [order.items]);

  // Check if we have multiple courses
  const hasMultipleCourses = itemsByCourse.length > 1;

  // Check if any active item is overdue (exceeds its target_prep_time)
  const hasOverdueItems = order.items.some(item => {
    if (!getItemOverdueInfo) return false;
    if (item.prep_status === 'ready' || item.prep_status === 'served') return false;
    return getItemOverdueInfo(item).isOverdue;
  });

  // Check if any item has modifiers
  const hasModifiers = order.items.some(item => item.modifiers && item.modifiers.length > 0);

  // Square-style: tap marks item directly as ready (skip preparing)
  const handleItemClick = (item: KDSTicketLine) => {
    if (item.prep_status === 'pending' || item.prep_status === 'preparing') {
      onItemStatusChange(item.id, 'ready');
    }
  };

  const getBorderClass = () => {
    if (isSelected) return 'border-yellow-400 ring-2 ring-yellow-400/50';
    if (hasOverdueItems) return 'border-red-500 ring-2 ring-red-500/50';
    if (hasRushItems) return 'border-amber-500';
    return 'border-zinc-700';
  };

  const getBackgroundClass = () => {
    if (hasOverdueItems) return 'bg-red-500/10';
    if (hasRushItems) return 'bg-amber-500/5';
    return 'bg-zinc-900';
  };

  // Only show fade-in animation for truly new orders (< 30 seconds old)
  const isReallyNew = Date.now() - new Date(order.openedAt).getTime() < 30000;

  return (
    <div 
      className={cn(
        "rounded-lg border-2 overflow-hidden transition-all duration-300",
        getBorderClass(),
        getBackgroundClass(),
        // Only pulse for overdue items (red alert)
        hasOverdueItems && !isSelected && "animate-pulse",
        // Subtle fade-in for genuinely new orders
        isReallyNew && !hasOverdueItems && "animate-fade-in"
      )}
    >
      {/* Header */}
      <div className={cn(
        "px-4 py-3 border-b border-zinc-800",
        hasOverdueItems ? "bg-red-500/20" : hasRushItems ? "bg-amber-500/10" : "bg-zinc-800/50",
        isSelected && "bg-yellow-500/20"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasOverdueItems && (
              <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />
            )}
            {hasRushItems && !hasOverdueItems && (
              <Flame className="h-5 w-5 text-amber-400" />
            )}
            <h3 className="text-lg font-bold text-white">{displayName}</h3>
            {hasRushItems && (
              <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-black rounded-full">
                RUSH
              </span>
            )}
          </div>
          <div className={cn(
            "flex items-center gap-1 font-mono text-sm",
            hasOverdueItems ? "text-red-400" : hasRushItems ? "text-amber-400" : timeDisplay.text
          )}>
            <Clock className="h-4 w-4" />
            <span>{elapsedMinutes} min</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          {new Date(order.openedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Items grouped by course */}
      <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
        {itemsByCourse.map(([course, items]) => {
          const courseConfig = getCourseConfig(course);
          const CourseIcon = courseConfig.icon;
          const allCourseReady = items.every(i => i.prep_status === 'ready' || i.prep_status === 'served');
          
          return (
            <div key={course} className="space-y-1">
              {/* Course Header - only show if multiple courses */}
              {hasMultipleCourses && (
                <div className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded",
                  courseConfig.bgClass,
                  "border-l-2",
                  courseConfig.borderClass
                )}>
                  <CourseIcon className={cn("h-3.5 w-3.5", courseConfig.textClass)} />
                  <span className={cn("text-xs font-medium", courseConfig.textClass)}>
                    {courseConfig.label}
                  </span>
                  {allCourseReady && (
                    <Check className="h-3 w-3 text-emerald-400 ml-auto" />
                  )}
                </div>
              )}
              
              {/* Course Items */}
              {items.map((item) => {
                const overdueInfo = getItemOverdueInfo?.(item) || { 
                  isOverdue: false, 
                  isWarning: false, 
                  overdueMinutes: 0, 
                  elapsedMinutes: 0,
                  threshold: 0,
                  progressPercent: 0 
                };
                const isItemRush = item.is_rush;
                
                const activeIndex = activeItems.findIndex(ai => ai.id === item.id);
                const isItemSelected = isSelected && selectedItemIndex === activeIndex && activeIndex !== -1;
                
                const isActive = item.prep_status === 'pending' || item.prep_status === 'preparing';
                const isOnTime = isActive && !overdueInfo.isOverdue;
                const isOverdueState = isActive && overdueInfo.isOverdue;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    disabled={item.prep_status === 'ready' || item.prep_status === 'served'}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-all",
                      "flex flex-col gap-2",
                      hasMultipleCourses && "ml-2",
                      isItemSelected && "ring-2 ring-yellow-400 bg-yellow-500/20",
                      !isItemSelected && isOnTime && "bg-emerald-900/30 hover:bg-emerald-800/30 cursor-pointer border border-emerald-500",
                      !isItemSelected && isOverdueState && "bg-red-900/50 hover:bg-red-800/50 cursor-pointer border-2 border-red-500 animate-pulse",
                      item.prep_status === 'ready' && "bg-emerald-900/30 opacity-60 cursor-default border border-emerald-600",
                      item.prep_status === 'served' && "bg-zinc-900 opacity-40 cursor-default",
                      isItemRush && item.prep_status !== 'ready' && item.prep_status !== 'served' && "border-l-4 border-l-amber-500"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                        item.prep_status === 'pending' && "bg-zinc-700",
                        item.prep_status === 'preparing' && !overdueInfo.isOverdue && "bg-emerald-500",
                        item.prep_status === 'preparing' && overdueInfo.isOverdue && "bg-red-500 animate-pulse",
                        item.prep_status === 'ready' && "bg-emerald-500",
                        item.prep_status === 'served' && "bg-zinc-600"
                      )}>
                        {item.prep_status === 'preparing' && !overdueInfo.isOverdue && <ChefHat className="h-3 w-3 text-white" />}
                        {item.prep_status === 'preparing' && overdueInfo.isOverdue && <AlertTriangle className="h-3 w-3 text-white" />}
                        {(item.prep_status === 'ready' || item.prep_status === 'served') && <Check className="h-3 w-3 text-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-bold text-white">{item.quantity}x</span>
                          <span className="text-white font-medium">{item.item_name}</span>
                          {isItemRush && (
                            <Flame className="h-4 w-4 text-amber-400" />
                          )}
                          {overdueInfo.isOverdue && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">
                              +{overdueInfo.overdueMinutes}m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="ml-8">
                        <KDSModifiersList modifiers={item.modifiers} size="md" />
                      </div>
                    )}
                    
                    {item.notes && (
                      <p className="text-xs text-amber-400 ml-8 italic">⚠️ {item.notes}</p>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50">
        <Button
          onClick={() => {
            console.log('TODO LISTO clicked for ticket:', order.ticketId);
            onCompleteOrder(order.ticketId);
          }}
          disabled={activeItems.length === 0}
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
