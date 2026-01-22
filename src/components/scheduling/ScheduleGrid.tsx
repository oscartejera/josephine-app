import { useMemo, useState, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { Cloud, Sun, CloudRain, GripVertical, Plus, ArrowRightLeft, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduleData, ViewMode, Employee, Shift } from '@/hooks/useSchedulingSupabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { CreateShiftDialog } from './CreateShiftDialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ScheduleGridProps {
  data: ScheduleData;
  viewMode: ViewMode;
  positions: string[];
  onMoveShift?: (shiftId: string, toEmployeeId: string, toDate: string) => void;
  onAddShift?: (shift: Omit<Shift, 'id'>) => void;
  onInitiateSwap?: (shift: Shift, employeeName: string) => void;
}

interface GridRow {
  id: string;
  label: string;
  sublabel?: string;
  initials?: string;
  hours: number;
  targetHours?: number;
  shifts: (Shift | null)[];
  unavailableDays: number[];
  dayOffDays: number[];
  timeOffDays: number[];
  timeOffTypes: Record<number, string>;
  preferredOffDays: number[];
}

interface DragData {
  shiftId: string;
  shift: Shift;
  fromEmployeeId: string;
  fromDate: string;
}

interface CreateShiftTarget {
  employeeId: string;
  employeeName: string;
  date: Date;
  dateStr: string;
}

function ShiftCard({ 
  shift, 
  isDragging,
  onDragStart,
  onDragEnd,
  draggable = true,
  onSwapClick,
  employeeName,
}: { 
  shift: Shift;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  draggable?: boolean;
  onSwapClick?: () => void;
  employeeName?: string;
}) {
  const cardContent = (
    <div 
      className={cn(
        "px-2 py-1.5 rounded-md text-xs border cursor-grab active:cursor-grabbing transition-all",
        shift.isOpen 
          ? "bg-amber-50 border-amber-200 text-amber-700"
          : "bg-primary/5 border-primary/20 text-foreground",
        isDragging && "opacity-50 scale-95",
        draggable && "hover:shadow-md hover:border-primary/40"
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-1">
        {draggable && <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{shift.role}</div>
          <div className="text-muted-foreground">
            {shift.startTime} - {shift.endTime}
          </div>
        </div>
      </div>
    </div>
  );
  
  if (onSwapClick) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {cardContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onSwapClick}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Request Swap
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
  
  return cardContent;
}

function UnavailableCell() {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/50 rounded-md text-xs text-muted-foreground">
      <span>Unavailable</span>
    </div>
  );
}

function DayOffCell() {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 rounded-md text-xs text-blue-600">
      <span>🏖️ Day off</span>
    </div>
  );
}

function TimeOffCell({ type }: { type?: string }) {
  const icon = type === 'sick' ? '🤒' : type === 'vacation' ? '✈️' : '📋';
  const label = type === 'sick' ? 'Sick leave' : type === 'vacation' ? 'Vacation' : 'Time off';
  
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-purple-50 rounded-md text-xs text-purple-600 border border-purple-200">
      <span>{icon} {label}</span>
    </div>
  );
}

function PreferredCell() {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-50/50 rounded-md text-xs text-amber-600 border border-dashed border-amber-200">
      <span>⚠️ Prefers off</span>
    </div>
  );
}

function EmptyCell({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-full min-h-[44px] flex items-center justify-center rounded-md border border-dashed border-transparent hover:border-primary/30 hover:bg-primary/5 transition-colors group"
    >
      <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function DropZone({ 
  isOver, 
  canDrop,
  children,
  onDragOver,
  onDragLeave,
  onDrop,
}: { 
  isOver: boolean;
  canDrop: boolean;
  children: React.ReactNode;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={cn(
        "p-2 border-r border-border last:border-r-0 min-h-[60px] transition-colors",
        isOver && canDrop && "bg-primary/10 border-primary/30",
        isOver && !canDrop && "bg-destructive/10"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}

export function ScheduleGrid({ data, viewMode, positions, onMoveShift, onAddShift, onInitiateSwap }: ScheduleGridProps) {
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<{ employeeId: string; dayIndex: number } | null>(null);
  const [createShiftTarget, setCreateShiftTarget] = useState<CreateShiftTarget | null>(null);
  const [salesSort, setSalesSort] = useState<'none' | 'asc' | 'desc'>('none');
  const [colSort, setColSort] = useState<'none' | 'asc' | 'desc'>('none');
  
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => ({
      date: addDays(data.weekStart, i),
      dayName: format(addDays(data.weekStart, i), 'EEE'),
      dayNum: format(addDays(data.weekStart, i), 'd'),
      dateStr: format(addDays(data.weekStart, i), 'yyyy-MM-dd'),
    }));
  }, [data.weekStart]);
  
  const rows = useMemo((): GridRow[] => {
    // Group by view mode
    const grouping: Record<string, Employee[]> = {};
    
    data.employees.forEach(emp => {
      let key: string;
      switch (viewMode) {
        case 'departments':
          key = emp.department;
          break;
        case 'positions':
          key = emp.position;
          break;
        case 'stations':
          key = emp.station;
          break;
        case 'people':
        default:
          key = emp.id;
          break;
      }
      
      if (!grouping[key]) {
        grouping[key] = [];
      }
      grouping[key].push(emp);
    });
    
    if (viewMode === 'people') {
      // Individual rows per person
      return data.employees.map(emp => {
        const shifts = days.map(day => {
          return data.shifts.find(s => s.employeeId === emp.id && s.date === day.dateStr) || null;
        });
        
        const unavailableDays = days
          .map((_, i) => emp.availability[i.toString()] === 'unavailable' ? i : -1)
          .filter(i => i >= 0);
        
        const dayOffDays = days
          .map((_, i) => emp.availability[i.toString()] === 'day_off' ? i : -1)
          .filter(i => i >= 0);
        
        const timeOffDays = days
          .map((_, i) => emp.availability[i.toString()] === 'time_off' ? i : -1)
          .filter(i => i >= 0);
        
        const preferredOffDays = days
          .map((_, i) => emp.availability[i.toString()] === 'preferred' ? i : -1)
          .filter(i => i >= 0);
        
        // Get time-off types for each day
        const timeOffTypes: Record<number, string> = {};
        if (emp.timeOffInfo) {
          days.forEach((_, i) => {
            const info = emp.timeOffInfo?.[i.toString()];
            if (info) {
              timeOffTypes[i] = info.type;
            }
          });
        }
        
        return {
          id: emp.id,
          label: emp.name,
          initials: emp.initials,
          hours: emp.weeklyHours,
          targetHours: emp.targetHours,
          shifts,
          unavailableDays,
          dayOffDays,
          timeOffDays,
          timeOffTypes,
          preferredOffDays,
        };
      });
    } else {
      // Grouped rows
      return Object.entries(grouping).map(([group, employees]) => {
        const totalHours = employees.reduce((sum, e) => sum + e.weeklyHours, 0);
        const shifts = days.map(day => {
          const dayShifts = data.shifts.filter(s => 
            employees.some(e => e.id === s.employeeId) && s.date === day.dateStr
          );
          // Return first shift as representative (in real app, would show all)
          return dayShifts[0] || null;
        });
        
        return {
          id: group,
          label: group,
          sublabel: `${employees.length} people`,
          hours: Math.round(totalHours * 10) / 10,
          shifts,
          unavailableDays: [],
          dayOffDays: [],
          timeOffDays: [],
          timeOffTypes: {},
          preferredOffDays: [],
        };
      });
    }
  }, [data, viewMode, days]);
  
  // Open shifts row
  const openShiftsRow: GridRow = {
    id: 'open-shifts',
    label: 'Open shifts',
    sublabel: `${data.openShifts.length} shifts`,
    hours: data.openShifts.reduce((sum, s) => sum + s.hours, 0),
    shifts: days.map(day => 
      data.openShifts.find(s => s.date === day.dateStr) || null
    ),
    unavailableDays: [],
    dayOffDays: [],
    timeOffDays: [],
    timeOffTypes: {},
    preferredOffDays: [],
  };
  
  const weatherIcons = [Sun, Cloud, Sun, CloudRain, Sun, Sun, Cloud];
  
  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, shift: Shift, employeeId: string) => {
    const dragPayload: DragData = {
      shiftId: shift.id,
      shift,
      fromEmployeeId: employeeId,
      fromDate: shift.date,
    };
    setDragData(dragPayload);
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = 'move';
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setDragData(null);
    setDropTarget(null);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, employeeId: string, dayIndex: number, unavailable: boolean, dayOff: boolean) => {
    e.preventDefault();
    if (unavailable || dayOff) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ employeeId, dayIndex });
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, toEmployeeId: string, dayIndex: number, row: GridRow) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (row.unavailableDays.includes(dayIndex) || row.dayOffDays.includes(dayIndex)) {
      toast.error("Cannot assign shift - employee is unavailable");
      return;
    }
    
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json')) as DragData;
      const toDate = days[dayIndex].dateStr;
      
      // Check if dropping to same position
      if (payload.fromEmployeeId === toEmployeeId && payload.fromDate === toDate) {
        return;
      }
      
      // Call the move handler
      if (onMoveShift) {
        onMoveShift(payload.shiftId, toEmployeeId, toDate);
        
        const employee = data.employees.find(e => e.id === toEmployeeId);
        const employeeName = employee?.name || 'employee';
        const dayName = days[dayIndex].dayName;
        
        toast.success(`Shift moved to ${employeeName} on ${dayName}`);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  }, [days, onMoveShift, data.employees]);
  
  // Click handler for empty cells
  const handleEmptyCellClick = useCallback((employeeId: string, employeeName: string, dayIndex: number) => {
    const day = days[dayIndex];
    setCreateShiftTarget({
      employeeId,
      employeeName,
      date: day.date,
      dateStr: day.dateStr,
    });
  }, [days]);
  
  // Handler for creating shift
  const handleCreateShift = useCallback((shiftData: { startTime: string; endTime: string; role: string }) => {
    if (!createShiftTarget || !onAddShift) return;
    
    // Calculate hours
    const [startH, startM] = shiftData.startTime.split(':').map(Number);
    const [endH, endM] = shiftData.endTime.split(':').map(Number);
    let hours = (endH * 60 + endM - startH * 60 - startM) / 60;
    if (hours <= 0) hours += 24;
    
    onAddShift({
      employeeId: createShiftTarget.employeeId,
      date: createShiftTarget.dateStr,
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      hours,
      role: shiftData.role,
      plannedCost: null, // Will be calculated by DB trigger when saved
    });
    
    toast.success(`New shift created for ${createShiftTarget.employeeName}`);
    setCreateShiftTarget(null);
  }, [createShiftTarget, onAddShift]);
  
  const isSwapEnabled = viewMode === 'people' && onInitiateSwap;
  const isDraggingEnabled = viewMode === 'people' && onMoveShift;
  const isCreatingEnabled = viewMode === 'people' && onAddShift;
  
  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header with days */}
        <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-muted/30">
          <div className="p-3 font-medium text-sm text-muted-foreground border-r border-border">
            Team
          </div>
          {days.map((day, i) => {
            const WeatherIcon = weatherIcons[i];
            
            return (
              <div key={day.dateStr} className="p-3 border-r border-border last:border-r-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{day.dayName}</span>
                    <span className="text-sm text-muted-foreground">{day.dayNum}</span>
                  </div>
                  <WeatherIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Sales row */}
        <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-muted/20">
          <button 
            onClick={() => {
              setSalesSort(prev => prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none');
              setColSort('none');
            }}
            className="p-2 px-3 text-xs text-muted-foreground border-r border-border flex items-center gap-1 hover:bg-muted/50 transition-colors"
          >
            Sales
            {salesSort === 'none' && <ArrowUpDown className="h-3 w-3" />}
            {salesSort === 'desc' && <ArrowDown className="h-3 w-3 text-primary" />}
            {salesSort === 'asc' && <ArrowUp className="h-3 w-3 text-primary" />}
          </button>
          {days.map((day, i) => {
            const kpi = data.dailyKPIs[i];
            const salesValues = data.dailyKPIs.map(k => k.sales);
            const maxSales = Math.max(...salesValues);
            const minSales = Math.min(...salesValues);
            const isHighest = salesSort !== 'none' && kpi.sales === maxSales;
            const isLowest = salesSort !== 'none' && kpi.sales === minSales;
            
            return (
              <div 
                key={`sales-${day.dateStr}`} 
                className={cn(
                  "p-2 px-3 border-r border-border last:border-r-0 text-sm font-medium transition-colors",
                  isHighest && salesSort === 'desc' && "bg-emerald-50 text-emerald-700",
                  isLowest && salesSort === 'asc' && "bg-amber-50 text-amber-700"
                )}
              >
                €{kpi.sales.toLocaleString()}
              </div>
            );
          })}
        </div>
        
        {/* Cost / COL % row with variance tooltip */}
        <TooltipProvider>
          <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-muted/20">
            <button 
              onClick={() => {
                setColSort(prev => prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none');
                setSalesSort('none');
              }}
              className="p-2 px-3 text-xs text-muted-foreground border-r border-border flex items-center gap-1 hover:bg-muted/50 transition-colors"
            >
              Cost / COL %
              {colSort === 'none' && <ArrowUpDown className="h-3 w-3" />}
              {colSort === 'desc' && <ArrowDown className="h-3 w-3 text-primary" />}
              {colSort === 'asc' && <ArrowUp className="h-3 w-3 text-primary" />}
            </button>
            {days.map((day, i) => {
              const kpi = data.dailyKPIs[i];
              const colValues = data.dailyKPIs.map(k => k.colPercent);
              const maxCol = Math.max(...colValues);
              const minCol = Math.min(...colValues);
              const isHighest = colSort !== 'none' && kpi.colPercent === maxCol;
              const isLowest = colSort !== 'none' && kpi.colPercent === minCol;
              const isHigh = kpi.colPercent > 35;
              
              // Variance data - check if extended KPI fields exist
              const hasVariance = 'varianceCost' in kpi && kpi.varianceCost !== 0;
              const varianceIsPositive = (kpi as any).varianceCost > 0;
              const varianceAbs = Math.abs((kpi as any).varianceCost || 0);
              const shiftsCost = (kpi as any).shiftsCost || 0;
              const forecastCost = (kpi as any).forecastLaborCost || kpi.cost;
              
              return (
                <Tooltip key={`col-${day.dateStr}`}>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "p-2 px-3 border-r border-border last:border-r-0 transition-colors cursor-default",
                        isHighest && colSort === 'desc' && "bg-destructive/10",
                        isLowest && colSort === 'asc' && "bg-emerald-50",
                        hasVariance && varianceAbs > 50 && (varianceIsPositive ? "border-l-2 border-l-red-400" : "border-l-2 border-l-green-400")
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "text-sm font-medium",
                          isHighest && colSort === 'desc' ? "text-destructive" : 
                          isLowest && colSort === 'asc' ? "text-emerald-700" :
                          isHigh ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {kpi.colPercent > 0 ? `${kpi.colPercent.toFixed(1)}%` : '-'}
                        </span>
                        {hasVariance && varianceAbs > 50 && (
                          varianceIsPositive 
                            ? <TrendingUp className="h-3 w-3 text-red-500" />
                            : <TrendingDown className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {kpi.cost > 0 && (
                        <span className="text-xs text-muted-foreground">
                          €{Math.round(kpi.cost).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="space-y-1">
                      <div>Forecast labour: €{Math.round(forecastCost).toLocaleString()}</div>
                      {shiftsCost > 0 && (
                        <div>Shifts cost: €{Math.round(shiftsCost).toLocaleString()}</div>
                      )}
                      {hasVariance && (
                        <div className={varianceIsPositive ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          Δ: {varianceIsPositive ? '+' : ''}€{Math.round((kpi as any).varianceCost).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
        
        {/* Open shifts row */}
        <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-amber-50/30">
          <div className="p-3 border-r border-border">
            <div className="font-medium text-sm">{openShiftsRow.label}</div>
            <div className="text-xs text-muted-foreground">
              {openShiftsRow.hours}h total
            </div>
          </div>
          {openShiftsRow.shifts.map((shift, i) => (
            <div key={i} className="p-2 border-r border-border last:border-r-0 min-h-[60px]">
              {shift && <ShiftCard shift={shift} draggable={false} />}
            </div>
          ))}
        </div>
        
        {/* Employee/group rows */}
        <ScrollArea className="max-h-[500px]">
          {rows.map((row) => (
            <div 
              key={row.id} 
              className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
            >
              {/* Row label */}
              <div className="p-3 border-r border-border flex items-center gap-3">
                {row.initials && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {row.initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{row.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.targetHours ? (
                      <span className={row.hours < row.targetHours * 0.8 ? 'text-amber-600' : ''}>
                        {row.hours}/{row.targetHours}h
                      </span>
                    ) : row.sublabel ? (
                      row.sublabel
                    ) : (
                      `${row.hours}h`
                    )}
                  </div>
                </div>
              </div>
              
              {/* Shift cells */}
              {row.shifts.map((shift, dayIndex) => {
                const isUnavailable = row.unavailableDays.includes(dayIndex);
                const isDayOff = row.dayOffDays.includes(dayIndex);
                const isTimeOff = row.timeOffDays.includes(dayIndex);
                const isPreferred = row.preferredOffDays.includes(dayIndex);
                const timeOffType = row.timeOffTypes[dayIndex];
                const isOver = dropTarget?.employeeId === row.id && dropTarget?.dayIndex === dayIndex;
                const canDrop = !isUnavailable && !isDayOff && !isTimeOff;
                const isEmpty = !isUnavailable && !isDayOff && !isTimeOff && !shift;
                
                if (isDraggingEnabled) {
                  return (
                    <DropZone
                      key={dayIndex}
                      isOver={isOver}
                      canDrop={canDrop}
                      onDragOver={(e) => handleDragOver(e, row.id, dayIndex, isUnavailable || isTimeOff, isDayOff)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, row.id, dayIndex, row)}
                    >
                      {isTimeOff ? (
                        <TimeOffCell type={timeOffType} />
                      ) : isUnavailable ? (
                        <UnavailableCell />
                      ) : isDayOff ? (
                        <DayOffCell />
                      ) : shift ? (
                        <ShiftCard 
                          shift={shift}
                          isDragging={dragData?.shiftId === shift.id}
                          onDragStart={(e) => handleDragStart(e, shift, row.id)}
                          onDragEnd={handleDragEnd}
                          draggable={true}
                        />
                      ) : isCreatingEnabled ? (
                        <EmptyCell onClick={() => handleEmptyCellClick(row.id, row.label, dayIndex)} />
                      ) : null}
                    </DropZone>
                  );
                }
                
                return (
                  <div 
                    key={dayIndex} 
                    className="p-2 border-r border-border last:border-r-0 min-h-[60px]"
                  >
                    {isUnavailable ? (
                      <UnavailableCell />
                    ) : isDayOff ? (
                      <DayOffCell />
                    ) : shift ? (
                      <ShiftCard shift={shift} draggable={false} />
                    ) : isCreatingEnabled ? (
                      <EmptyCell onClick={() => handleEmptyCellClick(row.id, row.label, dayIndex)} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </ScrollArea>
        
        {/* Hints */}
        {(isDraggingEnabled || isCreatingEnabled) && (
          <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground flex gap-4">
            {isDraggingEnabled && <span>💡 Drag shifts to reassign</span>}
            {isCreatingEnabled && <span>➕ Click empty cells to add shifts</span>}
          </div>
        )}
      </div>
      
      {/* Create Shift Dialog */}
      {createShiftTarget && (
        <CreateShiftDialog
          isOpen={true}
          onClose={() => setCreateShiftTarget(null)}
          onSubmit={handleCreateShift}
          employeeName={createShiftTarget.employeeName}
          date={createShiftTarget.date}
          positions={positions}
        />
      )}
    </>
  );
}