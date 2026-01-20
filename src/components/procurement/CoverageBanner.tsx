import { CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CoverageBannerProps {
  coverageEndDate: Date;
  hasItems: boolean;
}

export function CoverageBanner({ coverageEndDate, hasItems }: CoverageBannerProps) {
  if (!hasItems) return null;

  return (
    <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
      <CheckCircle className="h-5 w-5 text-success" />
      <p className="text-sm text-foreground">
        This order will cover you from <span className="font-medium">Today</span> to{' '}
        <span className="font-medium">{format(coverageEndDate, 'EEE d MMM')}</span>
      </p>
    </div>
  );
}
