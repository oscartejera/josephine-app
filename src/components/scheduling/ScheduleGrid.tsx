import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { Cloud, Sun, CloudRain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduleData, ViewMode, Employee, Shift } from '@/hooks/useSchedulingData';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ScheduleGridProps {
  data: ScheduleData;
  viewMode: ViewMode;
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
}

function ShiftCard({ shift }: { shift: Shift }) {
  return (
    <div className={cn(
      "px-2 py-1.5 rounded-md text-xs border",
      shift.isOpen 
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-primary/5 border-primary/20 text-foreground"
    )}>
      <div className="font-medium truncate">{shift.role}</div>
      <div className="text-muted-foreground">
        {shift.startTime} - {shift.endTime}
      </div>
    </div>
  );
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

export function ScheduleGrid({ data, viewMode }: ScheduleGridProps) {
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
        
        return {
          id: emp.id,
          label: emp.name,
          initials: emp.initials,
          hours: emp.weeklyHours,
          targetHours: emp.targetHours,
          shifts,
          unavailableDays,
          dayOffDays,
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
  };
  
  const weatherIcons = [Sun, Cloud, Sun, CloudRain, Sun, Sun, Cloud];
  
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with days */}
      <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-muted/30">
        <div className="p-3 font-medium text-sm text-muted-foreground border-r border-border">
          Team
        </div>
        {days.map((day, i) => {
          const kpi = data.dailyKPIs[i];
          const WeatherIcon = weatherIcons[i];
          
          return (
            <div key={day.dateStr} className="p-3 border-r border-border last:border-r-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{day.dayName}</span>
                  <span className="text-sm text-muted-foreground">{day.dayNum}</span>
                </div>
                <WeatherIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground">
                £{kpi.sales.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      
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
            {shift && <ShiftCard shift={shift} />}
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
            {row.shifts.map((shift, dayIndex) => (
              <div 
                key={dayIndex} 
                className="p-2 border-r border-border last:border-r-0 min-h-[60px]"
              >
                {row.unavailableDays.includes(dayIndex) ? (
                  <UnavailableCell />
                ) : row.dayOffDays.includes(dayIndex) ? (
                  <DayOffCell />
                ) : shift ? (
                  <ShiftCard shift={shift} />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
