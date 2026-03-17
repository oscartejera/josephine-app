import { CheckCircle, Calendar, TrendingUp } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface CoverageBannerDesktopProps {
  coverageEndDate: Date;
  hasItems: boolean;
  orderDate?: Date;
  deliveryDate?: Date;
}

export function CoverageBannerDesktop({ 
  coverageEndDate, 
  hasItems, 
  orderDate = new Date(),
  deliveryDate,
}: CoverageBannerDesktopProps) {
  if (!hasItems) return null;

  const coverageDays = differenceInDays(coverageEndDate, orderDate);
  const startDate = deliveryDate || orderDate;

  return (
    <div className="bg-gradient-to-r from-success/10 via-success/5 to-transparent rounded-xl border border-success/20 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              This order will cover you from{' '}
              <span className="text-success">{format(startDate, 'EEEE d')}</span> to{' '}
              <span className="text-success">{format(coverageEndDate, 'EEEE d MMMM')}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Based on your forecast demand, recipe usage, and current stock levels
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 px-5 py-3 bg-success/10 rounded-xl border border-success/20">
          <Calendar className="h-5 w-5 text-success" />
          <div className="text-right">
            <p className="text-2xl font-bold text-success">{coverageDays}</p>
            <p className="text-xs text-muted-foreground">days covered</p>
          </div>
        </div>
      </div>
    </div>
  );
}
