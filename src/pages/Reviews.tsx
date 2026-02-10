import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  ReviewsHeader,
  ReviewsKPICards,
  RatingOverTimeChart,
  StarBreakdownTable,
  CustomerReviewsPanel,
  RatingByLocationTable,
} from '@/components/reviews';
import { DateRangeValue, DateMode, ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import { useReviewsData, Platform } from '@/hooks/useReviewsData';

export default function Reviews() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL params or use defaults
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

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('start_date', format(dateRange.from, 'yyyy-MM-dd'));
    params.set('end_date', format(dateRange.to, 'yyyy-MM-dd'));
    params.set('platform', platform);
    params.set('location', locationId);
    setSearchParams(params, { replace: true });
  }, [dateRange, platform, locationId, setSearchParams]);

  const { summary, reviews, isLoading, error } = useReviewsData({
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

  const handleLocationClick = useCallback((locId: string) => {
    setLocationId(locId);
  }, []);

  // AI-powered review reply generation via edge function
  const handleRefine = useCallback(
    async (
      reviewId: string,
      tone: 'friendly' | 'professional' | 'concise',
      currentText: string
    ): Promise<string> => {
      const review = reviews.find((r) => r.id === reviewId);
      if (!review) return currentText;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review_reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            reviewText: review.text,
            reviewRating: review.rating,
            authorName: review.author_name,
            platform: review.platform,
            locationName: review.location_name,
            tone,
            currentReply: currentText || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      return data.reply || currentText;
    },
    [reviews]
  );

  const handleSubmit = useCallback(
    async (_reviewId: string, _replyText: string): Promise<void> => {
      // TODO: persist reply to reviews table via Supabase
      await new Promise((resolve) => setTimeout(resolve, 300));
    },
    []
  );

  const lastUpdated = format(new Date(), 'dd MMM yyyy');

  return (
    <div className="space-y-6">
      {/* Header */}
      <ReviewsHeader
        dateRange={dateRange}
        dateMode={dateMode}
        onDateChange={handleDateChange}
        platform={platform}
        onPlatformChange={setPlatform}
        locationId={locationId}
        onLocationChange={setLocationId}
        lastUpdated={lastUpdated}
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column (60%) */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPI Cards */}
          <ReviewsKPICards summary={summary} isLoading={isLoading} />

          {/* Rating over time chart */}
          <RatingOverTimeChart data={summary.rating_over_time} isLoading={isLoading} />

          {/* Star breakdown table */}
          <StarBreakdownTable data={summary.star_breakdown} isLoading={isLoading} />
        </div>

        {/* Right column (40%) */}
        <div className="lg:col-span-2">
          <CustomerReviewsPanel
            reviews={reviews}
            isLoading={isLoading}
            onRefine={handleRefine}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* Rating by location table */}
      <RatingByLocationTable
        data={summary.rating_by_location}
        isLoading={isLoading}
        onLocationClick={handleLocationClick}
      />
    </div>
  );
}
