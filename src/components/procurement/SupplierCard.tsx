import { Search, Calendar, Info, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/hooks/useProcurementData';

interface SupplierCardProps {
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

export function SupplierCard({
  supplier,
  deliveryDaysLabel,
  orderDate,
  onDateChange,
  searchQuery,
  onSearchChange,
  cutoffInfo,
}: SupplierCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Supplier Header */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <span className="text-2xl font-bold text-primary">{supplier.logo || supplier.name[0]}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{supplier.name}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Truck className="h-4 w-4" />
                <span>Delivers {deliveryDaysLabel}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 bg-background h-11"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 justify-start text-left font-normal w-full sm:w-auto px-4">
                  <Calendar className="mr-2 h-4 w-4" />
                  <span className="font-medium">{format(orderDate, 'd MMM yyyy')}</span>
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
      </div>
      
      {/* Info banner */}
      <div className="px-6 py-4 bg-info/5 flex items-start gap-3">
        <Info className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Earliest delivery on <span className="font-semibold text-info">{cutoffInfo.deliveryDateStr}</span> if ordered before{' '}
          <span className="font-semibold">{cutoffInfo.cutoffTimeStr}</span> on {cutoffInfo.cutoffDay}.
        </p>
      </div>
    </div>
  );
}
