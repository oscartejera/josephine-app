import { ChevronRight } from 'lucide-react';
import { DateRangePickerNoryLike, DateRangeValue, DateMode, ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Platform } from '@/hooks/useReviewsData';

interface ReviewsHeaderProps {
  dateRange: DateRangeValue;
  dateMode: DateMode;
  onDateChange: (range: DateRangeValue, mode: DateMode, granularity: ChartGranularity) => void;
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  locationId: string;
  onLocationChange: (locationId: string) => void;
  lastUpdated?: string;
}

export function ReviewsHeader({
  dateRange,
  dateMode,
  onDateChange,
  platform,
  onPlatformChange,
  locationId,
  onLocationChange,
  lastUpdated,
}: ReviewsHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Top controls row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Insights</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Reviews</span>
        </div>

        {/* Center: Date picker */}
        <div className="flex-1 flex justify-center">
          <DateRangePickerNoryLike
            value={dateRange}
            onChange={onDateChange}
            mode={dateMode}
          />
        </div>

        {/* Right: Dropdowns */}
        <div className="flex items-center gap-2">
          <Select value={platform} onValueChange={(v) => onPlatformChange(v as Platform)}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
              <SelectItem value="deliveroo">Deliveroo</SelectItem>
              <SelectItem value="justeat">Just Eat</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Title row */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reviews</h1>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Updated at end of day {lastUpdated}
          </p>
        )}
      </div>
    </div>
  );
}
