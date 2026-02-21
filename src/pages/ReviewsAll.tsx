import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePickerNoryLike, DateRangeValue, DateMode, ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { useReviewsData, Platform, LOCATIONS } from '@/hooks/useReviewsData';

export default function ReviewsAll() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialDateRange = (): DateRangeValue => {
    const startParam = searchParams.get('start_date');
    const endParam = searchParams.get('end_date');
    if (startParam && endParam) {
      try {
        return {
          from: parseISO(startParam),
          to: parseISO(endParam),
        };
      } catch {
        // fallback
      }
    }
    return {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    };
  };

  const [dateRange, setDateRange] = useState<DateRangeValue>(getInitialDateRange);
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [platform, setPlatform] = useState<Platform>(
    (searchParams.get('platform') as Platform) || 'all'
  );
  const [locationId, setLocationId] = useState<string>(
    searchParams.get('location') || 'all'
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('start_date', format(dateRange.from, 'yyyy-MM-dd'));
    params.set('end_date', format(dateRange.to, 'yyyy-MM-dd'));
    params.set('platform', platform);
    params.set('location', locationId);
    setSearchParams(params, { replace: true });
  }, [dateRange, platform, locationId, setSearchParams]);

  const { reviews, isLoading } = useReviewsData({
    startDate: dateRange.from,
    endDate: dateRange.to,
    platform,
    locationId,
  });

  const handleDateChange = useCallback(
    (range: DateRangeValue, mode: DateMode, _granularity: ChartGranularity) => {
      setDateRange(range);
      setDateMode(mode);
    },
    []
  );

  const handleRefine = useCallback(
    async (
      _reviewId: string,
      tone: 'friendly' | 'professional' | 'concise',
      currentText: string
    ): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const toneResponses: Record<string, string> = {
        friendly: `Hey there! Thanks so much for taking the time to leave us a review. We really appreciate your feedback! 😊`,
        professional: `Thank you for your valued feedback. We appreciate you taking the time to share your experience with us.`,
        concise: `Thanks for the feedback! We appreciate it.`,
      };
      return toneResponses[tone] || currentText;
    },
    []
  );

  const handleSubmit = useCallback(
    async (_reviewId: string, _replyText: string): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Breadcrumb with back */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/insights/reviews?${searchParams.toString()}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Insights</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Reviews</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">All Reviews</span>
            </div>
          </div>

          {/* Center: Date picker */}
          <div className="flex-1 flex justify-center">
            <DateRangePickerNoryLike
              value={dateRange}
              onChange={handleDateChange}
              mode={dateMode}
            />
          </div>

          {/* Right: Dropdowns */}
          <div className="flex items-center gap-2">
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger className="h-9 w-[150px] text-sm">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
                <SelectItem value="thefork">TheFork</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="h-9 w-[150px] text-sm">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">All Reviews</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {reviews.length} reviews in this period
          </p>
        </div>
      </div>

      {/* Reviews grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onRefine={handleRefine}
              onSubmit={handleSubmit}
            />
          ))}
          {reviews.length === 0 && (
            <Card className="col-span-full p-8 text-center">
              <p className="text-muted-foreground">No reviews found for this period</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
