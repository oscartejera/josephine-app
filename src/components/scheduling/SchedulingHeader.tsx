import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface SchedulingHeaderProps {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  onCreateSchedule: () => void;
  onPublish: () => void;
  hasSchedule: boolean;
  isCreating: boolean;
  projectedSales?: number;
  projectedColPercent?: number;
  targetColPercent?: number;
}

export function SchedulingHeader({
  weekStart,
  onWeekChange,
  onCreateSchedule,
  onPublish,
  hasSchedule,
  isCreating,
  projectedSales,
  projectedColPercent,
  targetColPercent,
}: SchedulingHeaderProps) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'd')} - ${format(weekEnd, 'd MMM')}`;
  
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" className="text-muted-foreground">
              Schedule & Workforce
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Schedule</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      {/* Main header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Week selector */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onWeekChange(subWeeks(weekStart, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm font-medium min-w-[120px] text-center">
              {weekLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onWeekChange(addWeeks(weekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Status badge */}
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Draft
          </Badge>
          
          {/* KPI pills when schedule exists */}
          {hasSchedule && projectedSales && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Projected</span>
                <span className="font-medium">€{projectedSales.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">COL</span>
                <span className={`font-medium ${
                  projectedColPercent && targetColPercent && projectedColPercent <= targetColPercent 
                    ? 'text-[hsl(var(--success))]' 
                    : 'text-amber-600'
                }`}>
                  {projectedColPercent}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium">{targetColPercent}%</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onCreateSchedule}
            disabled={isCreating}
            className="bg-primary hover:bg-primary/90"
          >
            {isCreating ? 'Creating...' : 'Create Schedule'}
          </Button>
          
          <Button variant="outline">
            Templates
          </Button>
          
          <Button
            variant="outline"
            onClick={onPublish}
            disabled={!hasSchedule}
          >
            Publish
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export Schedule</DropdownMenuItem>
              <DropdownMenuItem>Print Schedule</DropdownMenuItem>
              <DropdownMenuItem>Schedule Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
