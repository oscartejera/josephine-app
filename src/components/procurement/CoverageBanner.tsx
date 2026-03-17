import { CheckCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface CoverageBannerProps {
  coverageEndDate: Date;
  hasItems: boolean;
  orderDate?: Date;
}

export function CoverageBanner({ coverageEndDate, hasItems, orderDate = new Date() }: CoverageBannerProps) {
  if (!hasItems) return null;

  const coverageDays = Math.ceil((coverageEndDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-center gap-3 p-4 bg-success/10 rounded-xl border border-success/20">
      <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          This order will cover you from <span className="font-semibold">Today</span> to{' '}
          <span className="font-semibold text-success">{format(coverageEndDate, 'EEEE, d MMMM')}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Based on your forecast demand and current stock levels
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-success/10 rounded-lg">
        <Calendar className="h-4 w-4 text-success" />
        <span className="text-sm font-medium text-success">{coverageDays} days</span>
      </div>
    </div>
  );
}
