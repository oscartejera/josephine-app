import { ChevronLeft, ChevronRight, MoreHorizontal, TrendingUp, TrendingDown, Sparkles, Loader2 } from 'lucide-react';
import { format, addWeeks, subWeeks, endOfWeek } from 'date-fns';
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
  hasSchedule: boolean;
  isCreating: boolean;
  projectedSales?: number;
  projectedColPercent?: number;
  targetColPercent?: number;
  totalShiftsCost?: number;
  totalVarianceCost?: number;
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
  totalShiftsCost,
  totalVarianceCost,
}: SchedulingHeaderProps) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'd')} - ${format(weekEnd, 'd MMM')}`;
  
  const hasVariance = totalVarianceCost !== undefined && totalVarianceCost !== 0;
  const varianceIsPositive = (totalVarianceCost ?? 0) > 0;
  const varianceAbs = Math.abs(totalVarianceCost ?? 0);
  const varianceSignificant = varianceAbs > 100; // Show if > €100 difference
  
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
          {hasSchedule && projectedSales !== undefined && (
            <TooltipProvider>
              <div className="flex items-center gap-3 text-sm">
                {/* Projected Sales */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-md">
                  <span className="text-muted-foreground">Forecast</span>
                  <span className="font-medium">€{projectedSales.toLocaleString()}</span>
                </div>
                
                {/* COL% */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-md">
                  <span className="text-muted-foreground">COL</span>
                  <span className={cn(
                    "font-medium",
                    projectedColPercent && targetColPercent && projectedColPercent <= targetColPercent 
                      ? 'text-[hsl(var(--success))]' 
                      : 'text-amber-600'
                  )}>
                    {projectedColPercent}%
                  </span>
                </div>
                
                {/* Target */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-md">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-medium">{targetColPercent}%</span>
                </div>
                
                {/* Shifts cost with variance tooltip */}
                {totalShiftsCost !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md border",
                        hasVariance && varianceSignificant
                          ? varianceIsPositive 
                            ? "bg-red-50 border-red-200" 
                            : "bg-green-50 border-green-200"
                          : "bg-muted/50 border-transparent"
                      )}>
                        <span className="text-muted-foreground">Shifts</span>
                        <span className="font-medium">€{Math.round(totalShiftsCost).toLocaleString()}</span>
                        {hasVariance && varianceSignificant && (
                          <>
                            {varianceIsPositive ? (
                              <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                            )}
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <div className="space-y-1">
                        <div>Coste planificado (turnos): €{Math.round(totalShiftsCost).toLocaleString()}</div>
                        {hasVariance && (
                          <div className={varianceIsPositive ? "text-red-600" : "text-green-600"}>
                            Δ vs Forecast: {varianceIsPositive ? '+' : ''}€{Math.round(totalVarianceCost ?? 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onCreateSchedule}
            disabled={isCreating}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white gap-2 shadow-md"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI Auto-Schedule
              </>
            )}
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
