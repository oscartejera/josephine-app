import { Clock, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DayAvailability, AvailabilityStatus } from '@/hooks/useAvailabilityData';

interface WeeklyAvailabilityGridProps {
  availability: DayAvailability[];
  onUpdateDay: (dayIndex: number, updates: Partial<DayAvailability>) => void;
  hasChanges: boolean;
  onSave: () => Promise<void>;
  isSaving?: boolean;
}

const TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00',
];

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string; icon: React.ElementType; color: string }> = {
  available: { label: 'Available', icon: Check, color: 'text-green-600 bg-green-50 border-green-200' },
  unavailable: { label: 'Unavailable', icon: X, color: 'text-red-600 bg-red-50 border-red-200' },
  preferred: { label: 'Preferred', icon: AlertCircle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
};

export function WeeklyAvailabilityGrid({
  availability,
  onUpdateDay,
  hasChanges,
  onSave,
  isSaving,
}: WeeklyAvailabilityGridProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div>
          <h3 className="font-semibold text-lg">Weekly Availability</h3>
          <p className="text-sm text-muted-foreground">Set your default working hours for each day</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Unsaved changes
            </Badge>
          )}
          <Button onClick={onSave} disabled={!hasChanges || isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="p-4 border-b border-border bg-muted/10 flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">Status:</span>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <div key={status} className="flex items-center gap-1.5">
              <div className={cn("w-5 h-5 rounded flex items-center justify-center border", config.color)}>
                <Icon className="h-3 w-3" />
              </div>
              <span>{config.label}</span>
            </div>
          );
        })}
      </div>
      
      {/* Grid */}
      <div className="divide-y divide-border">
        {availability.map((day) => {
          const statusConfig = STATUS_CONFIG[day.status];
          const StatusIcon = statusConfig.icon;
          
          return (
            <div 
              key={day.dayIndex}
              className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 p-4 items-center hover:bg-muted/20 transition-colors"
            >
              {/* Day name */}
              <div className="font-medium">{day.dayName}</div>
              
              {/* Status selector */}
              <div>
                <Select
                  value={day.status}
                  onValueChange={(value) => onUpdateDay(day.dayIndex, { status: value as AvailabilityStatus })}
                >
                  <SelectTrigger className={cn("w-[160px]", statusConfig.color)}>
                    <div className="flex items-center gap-2">
                      <StatusIcon className="h-4 w-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Time range */}
              {day.status !== 'unavailable' ? (
                <>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={day.startTime || '09:00'}
                      onValueChange={(value) => onUpdateDay(day.dayIndex, { startTime: value })}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Start" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">to</span>
                    <Select
                      value={day.endTime || '22:00'}
                      onValueChange={(value) => onUpdateDay(day.dayIndex, { endTime: value })}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="End" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {day.startTime && day.endTime && (
                      <span>
                        {parseInt(day.endTime) - parseInt(day.startTime)}h available
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="col-span-2 text-sm text-muted-foreground italic">
                  Not available this day
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}