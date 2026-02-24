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
import { useSalesTimeseries } from '@/hooks/useSalesTimeseries';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, TrendingUp } from 'lucide-react';

export default function Reviews() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { group, locations } = useApp();

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
    locations: locations.map(l => ({ id: l.id, name: l.name })),
  });

  // Fetch busy hours from unified timeseries RPC
  const locationIds = locationId === 'all'
    ? locations.map(l => l.id)
    : [locationId];

  const { data: timeseries, isLoading: busyLoading } = useSalesTimeseries({
    orgId: group?.id,
    locationIds,
    from: dateRange.from,
    to: dateRange.to,
    enabled: !!group?.id && locationIds.length > 0,
  });

  // Group busy hours by date for display
  const busyHoursByDate = (timeseries?.busy_hours || []).reduce<Record<string, { hour: number; forecast_sales: number }[]>>(
    (acc, bh) => {
      const key = bh.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push({ hour: bh.hour, forecast_sales: bh.forecast_sales });
      return acc;
    },
    {},
  );

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

      try {
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

        if (!resp.ok) throw new Error(`Error ${resp.status}`);
        const data = await resp.json();
        return data.reply || currentText;
      } catch {
        // Fallback if edge function is unavailable
        const fallback: Record<string, string> = {
          friendly: `¡Hola ${review.author_name}! Muchas gracias por tu opinión. Nos alegra saber que disfrutaste de tu experiencia. ¡Te esperamos pronto! 😊`,
          professional: `Estimado/a ${review.author_name}, agradecemos sinceramente su valoración. Su opinión es muy importante para nosotros y nos ayuda a seguir mejorando.`,
          concise: `Gracias por tu reseña, ${review.author_name}. ¡Esperamos verte pronto!`,
        };
        return fallback[tone] || currentText;
      }
    },
    [reviews]
  );

  const handleSubmit = useCallback(
    async (reviewId: string, replyText: string): Promise<void> => {
      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          response_text: replyText,
          response_status: 'published',
          response_date: new Date().toISOString(),
        } as any)
        .eq('id', reviewId);

      if (updateError) {
        console.error('Error submitting reply:', updateError);
        throw updateError;
      }
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

      {/* Busy Hours / Peak Demand */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold">Busy Hours (Forecast)</h3>
        </div>
        {busyLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : Object.keys(busyHoursByDate).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(busyHoursByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(0, 7)
              .map(([date, hours]) => (
                <div key={date} className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {format(new Date(date + 'T00:00:00'), 'EEE, d MMM')}
                  </p>
                  {hours
                    .sort((a, b) => b.forecast_sales - a.forecast_sales)
                    .map((h, idx) => (
                      <div key={h.hour} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          {idx === 0 && <TrendingUp className="h-3 w-3 text-orange-500" />}
                          <span className={idx === 0 ? 'font-semibold' : 'text-muted-foreground'}>
                            {String(h.hour).padStart(2, '0')}:00
                          </span>
                        </span>
                        <span className="text-xs font-medium">
                          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(h.forecast_sales)}
                        </span>
                      </div>
                    ))}
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No forecast data available for this period
          </p>
        )}
      </Card>

      {/* Rating by location table */}
      <RatingByLocationTable
        data={summary.rating_by_location}
        isLoading={isLoading}
        onLocationClick={handleLocationClick}
      />
    </div>
  );
}
