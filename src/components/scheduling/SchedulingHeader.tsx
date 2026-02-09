import { ChevronLeft, ChevronRight, MoreHorizontal, Sparkles, Loader2, Clock, TrendingUp, DollarSign } from 'lucide-react';
import { format, addWeeks, subWeeks, endOfWeek, getWeek } from 'date-fns';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SchedulingHeaderProps {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  onCreateSchedule: () => void;
  onPublish: () => void;
  onOpenSettings?: () => void;
  hasSchedule: boolean;
  isCreating: boolean;
  projectedSales?: number;
  projectedColPercent?: number;
  scheduledColPercent?: number;
  targetColPercent?: number;
  targetCost?: number;
  totalShiftsCost?: number;
  totalShiftsHours?: number;
  totalVarianceCost?: number;
  splh?: number;
  oplh?: number;
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
  scheduledColPercent,
  targetColPercent,
  targetCost,
  totalShiftsCost,
  totalShiftsHours,
  totalVarianceCost,
  splh,
  oplh,
  onOpenSettings,
}: SchedulingHeaderProps) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'd')} - ${format(weekEnd, 'd MMM')}`;
  const weekNum = getWeek(weekStart, { weekStartsOn: 1 });
  
  const colOnTarget = scheduledColPercent !== undefined && targetColPercent !== undefined 
    && scheduledColPercent <= targetColPercent + 2;
  
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
      
      {/* Main header row — exact Nory layout */}
      {/* "Week 7 / Projected €24,100  32% / €8,200 / 513h  Target 32% / €7,712" */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Week navigation: < 9 - 15 Feb > */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onWeekChange(subWeeks(weekStart, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[110px] text-center">
              {weekLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onWeekChange(addWeeks(weekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* KPI strip — Nory exact format */}
          <div className="flex items-center gap-1.5 text-sm">
            {/* Week N */}
            <span className="text-muted-foreground">Week {weekNum}</span>
            
            {hasSchedule && projectedSales !== undefined && projectedSales > 0 && (
              <>
                {/* / Projected €{SUM(forecast_sales)} */}
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">Projected</span>
                <span className="font-semibold">€{Math.round(projectedSales).toLocaleString()}</span>
                
                {/* {shiftsCost / projectedSales * 100}% / €{SUM(planned_cost)} / {SUM(planned_hours)}h */}
                {scheduledColPercent !== undefined && totalShiftsCost !== undefined && totalShiftsHours !== undefined && totalShiftsHours > 0 && (
                  <span className={cn("font-semibold ml-3", colOnTarget ? 'text-emerald-600' : 'text-amber-600')}>
                    {scheduledColPercent}% / €{Math.round(totalShiftsCost).toLocaleString()} / {Math.round(totalShiftsHours)}h
                  </span>
                )}
                
                {/* Target {location_settings.target_col_percent}% / €{projectedSales * target / 100} */}
                {targetColPercent !== undefined && (
                  <span className="text-muted-foreground ml-3">
                    Target {targetColPercent}%{targetCost !== undefined && ` / €${Math.round(targetCost).toLocaleString()}`}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Draft
          </Badge>
          
          <Button
            onClick={onCreateSchedule}
            disabled={isCreating}
            variant="outline"
            className="gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create Schedule
              </>
            )}
          </Button>
          
          <Button variant="outline">
            Templates
          </Button>
          
          <Button
            onClick={onPublish}
            disabled={!hasSchedule}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Publish
          </Button>
          
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => onOpenSettings?.(), 50); }}>
                Schedule Settings
              </DropdownMenuItem>
              <DropdownMenuItem>Export Schedule</DropdownMenuItem>
              <DropdownMenuItem>Print Schedule</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* SPLH / OPLH metrics bar — only when schedule exists */}
      {hasSchedule && splh !== undefined && splh > 0 && (
        <div className="flex items-center gap-4 text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-md cursor-default">
                <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-blue-600 font-medium">SPLH</span>
                <span className="font-semibold text-blue-800">€{splh.toFixed(0)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Sales Per Labor Hour — €{projectedSales?.toLocaleString()} / {Math.round(totalShiftsHours || 0)}h
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-md cursor-default">
                <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-purple-600 font-medium">OPLH</span>
                <span className="font-semibold text-purple-800">{oplh?.toFixed(1)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Orders Per Labor Hour (estimated from avg check €25)
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 border border-border rounded-md cursor-default">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Scheduled</span>
                <span className="font-semibold">{Math.round(totalShiftsHours || 0)}h</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">{Math.round((totalShiftsHours || 0) / 7)}h/day avg</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Total scheduled labor hours for the week
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
