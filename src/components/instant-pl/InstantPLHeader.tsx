/**
 * InstantPLHeader - Nory-like header for Instant P&L page
 */

import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DateRangePickerNoryLike, 
  DateRangeValue, 
  DateMode, 
  ChartGranularity 
} from '@/components/bi/DateRangePickerNoryLike';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ViewMode, FilterMode } from '@/hooks/useInstantPLData';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface InstantPLHeaderProps {
  dateRange: DateRangeValue;
  dateMode: DateMode;
  onDateChange: (range: DateRangeValue, mode: DateMode, granularity: ChartGranularity) => void;
  onDateModeChange: (mode: DateMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  lastUpdated?: Date;
}

export function InstantPLHeader({
  dateRange,
  dateMode,
  onDateChange,
  onDateModeChange,
  viewMode,
  onViewModeChange,
  filterMode,
  onFilterModeChange,
  lastUpdated
}: InstantPLHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Row 1: Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left side: Breadcrumbs + Date picker + Compare */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Insights</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-medium">Instant P&L</span>
          </nav>
          
          <div className="h-5 w-px bg-border mx-1" />
          
          {/* Date Picker */}
          <DateRangePickerNoryLike
            value={dateRange}
            mode={dateMode}
            onChange={onDateChange}
            onModeChange={onDateModeChange}
          />
          
          <div className="h-5 w-px bg-border mx-1" />
          
          {/* Compare dropdown */}
          <Select defaultValue="forecast">
            <SelectTrigger className="h-8 w-[160px] text-sm border-border/60">
              <SelectValue placeholder="Compare" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forecast">Compare: Forecast</SelectItem>
              <SelectItem value="previous_period">Previous period</SelectItem>
              <SelectItem value="previous_year">Previous year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Right side: Best/Worst/All + View mode + Actions */}
        <div className="flex items-center gap-3">
          {/* Best/Worst/All toggle */}
          <Tabs 
            value={filterMode} 
            onValueChange={(v) => onFilterModeChange(v as FilterMode)}
          >
            <TabsList className="h-8 p-0.5 bg-muted/50">
              <TabsTrigger 
                value="best" 
                className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Best
              </TabsTrigger>
              <TabsTrigger 
                value="worst" 
                className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Worst
              </TabsTrigger>
              <TabsTrigger 
                value="all" 
                className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="h-5 w-px bg-border" />
          
          {/* View mode toggle */}
          <Tabs 
            value={viewMode} 
            onValueChange={(v) => onViewModeChange(v as ViewMode)}
          >
            <TabsList className="h-8 p-0.5 bg-muted/50">
              <TabsTrigger 
                value="percentage" 
                className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Percentage
              </TabsTrigger>
              <TabsTrigger 
                value="amount" 
                className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Amount
              </TabsTrigger>
              <TabsTrigger 
                value="hours" 
                className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Hours
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Actions button */}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Row 2: Title + Last updated */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instant P&L</h1>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mt-1">
            Updated at end of day {format(lastUpdated, 'dd MMM yyyy')}
          </p>
        )}
      </div>
    </div>
  );
}
