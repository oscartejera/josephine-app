import { Search, Calendar, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/hooks/useProcurementData';

interface SupplierHeaderProps {
  supplier: Supplier;
  deliveryDaysLabel: string;
  orderDate: Date;
  onDateChange: (date: Date) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cutoffInfo: {
    isBeforeCutoff: boolean;
    cutoffTimeStr: string;
    cutoffDay: string;
    deliveryDateStr: string;
  };
}

export function SupplierHeader({
  supplier,
  deliveryDaysLabel,
  orderDate,
  onDateChange,
  searchQuery,
  onSearchChange,
  cutoffInfo,
}: SupplierHeaderProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      {/* Top row: Supplier info + Search + Date */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">{supplier.logo || supplier.name[0]}</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{supplier.name}</h2>
            <p className="text-sm text-muted-foreground">
              Delivers {deliveryDaysLabel}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal w-full sm:w-auto">
                <Calendar className="mr-2 h-4 w-4" />
                {format(orderDate, 'd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={orderDate}
                onSelect={(date) => date && onDateChange(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-info/10 rounded-lg border border-info/20">
        <Info className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Earliest delivery on <span className="font-medium">{cutoffInfo.deliveryDateStr}</span> if ordered before{' '}
          <span className="font-medium">{cutoffInfo.cutoffTimeStr}</span> on {cutoffInfo.cutoffDay}.
        </p>
      </div>
    </div>
  );
}
