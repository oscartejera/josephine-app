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
import { useReviewsData, Platform } from '@/hooks/useReviewsData';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';

export default function ReviewsAll() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { locations } = useApp();

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
    locations: locations.map(l => ({ id: l.id, name: l.name })),
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
                {locations.map((loc) => (
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
