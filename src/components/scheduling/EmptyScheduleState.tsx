import { Calendar, Sparkles } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { DayKPI } from '@/hooks/useSchedulingData';

interface EmptyScheduleStateProps {
  weekStart: Date;
  dailyKPIs: DayKPI[];
}

export function EmptyScheduleState({ weekStart, dailyKPIs }: EmptyScheduleStateProps) {
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(weekStart, i),
    dayName: format(addDays(weekStart, i), 'EEE'),
    dayNum: format(addDays(weekStart, i), 'd'),
  }));
  
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with days */}
      <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-muted/30">
        <div className="p-3 font-medium text-sm text-muted-foreground border-r border-border">
          Team
        </div>
        {days.map((day, i) => {
          const kpi = dailyKPIs[i];
          
          return (
            <div key={i} className="p-3 border-r border-border last:border-r-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{day.dayName}</span>
                <span className="text-sm text-muted-foreground">{day.dayNum}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                €{kpi?.sales.toLocaleString() || '0'}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Empty state content */}
      <div className="py-20 px-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <Calendar className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No schedule yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Click "Create Schedule" to let Josephine AI generate an optimized schedule based on your forecast and team availability.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          <span>Powered by Josephine AI</span>
        </div>
      </div>
    </div>
  );
}
