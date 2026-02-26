import { useQuery } from '@tanstack/react-query';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// Types
export type Platform = 'all' | 'google' | 'tripadvisor' | 'thefork';
export type ReplyStatus = 'draft' | 'published';

export interface OwnerReply {
  text: string;
  created_at: string;
  status: ReplyStatus;
}

export interface Review {
  id: string;
  platform: Exclude<Platform, 'all'>;
  location_id: string;
  location_name: string;
  author_name: string;
  author_avatar_letter: string;
  rating: 1 | 2 | 3 | 4 | 5;
  created_at: string;
  text: string;
  owner_reply?: OwnerReply;
  source_label: string;
}

export interface StarBreakdown {
  stars: 1 | 2 | 3 | 4 | 5;
  count: number;
  pct: number;
}

export interface RatingOverTimePoint {
  date: string;
  rating_avg: number;
}

export interface LocationRatingData {
  location_id: string;
  location_name: string;
  rating_avg: number;
  total_ratings: number;
  response_rate: number;
  distribution: {
    pos: number;
    neutral: number;
    neg: number;
  };
}

export interface ReviewsSummary {
  rating_avg: number;
  ratings_in_period: number;
  response_rate: number;
  avg_response_time_hours: number;
  rating_over_time: RatingOverTimePoint[];
  star_breakdown: StarBreakdown[];
  rating_by_location: LocationRatingData[];
}

export interface ReviewsData {
  summary: ReviewsSummary;
  reviews: Review[];
  isLoading: boolean;
  error: Error | null;
}

interface UseReviewsDataParams {
  startDate: Date;
  endDate: Date;
  platform: Platform;
  locationId: string;
  locations?: { id: string; name: string }[];
}

const PLATFORMS: Exclude<Platform, 'all'>[] = ['google', 'tripadvisor', 'thefork'];

const PLATFORM_LABELS: Record<Exclude<Platform, 'all'>, string> = {
  google: 'From Google',
  tripadvisor: 'From TripAdvisor',
  thefork: 'From TheFork',
};

// Map DB platform names to lowercase keys
function normalizePlatform(dbPlatform: string): Exclude<Platform, 'all'> {
  const map: Record<string, Exclude<Platform, 'all'>> = {
    'Google': 'google',
    'google': 'google',
    'TripAdvisor': 'tripadvisor',
    'tripadvisor': 'tripadvisor',
    'TheFork': 'thefork',
    'thefork': 'thefork',
  };
  return map[dbPlatform] || 'google';
}

function getLocationName(locationId: string, locations: { id: string; name: string }[]): string {
  return locations.find(l => l.id === locationId)?.name || 'Unknown';
}

async function fetchReviews(params: UseReviewsDataParams): Promise<{ summary: ReviewsSummary; reviews: Review[] }> {
  const { startDate, endDate, platform, locationId, locations: locs = [] } = params;

  let query = supabase
    .from('reviews')
    .select('*')
    .gte('review_date', format(startDate, 'yyyy-MM-dd'))
    .lte('review_date', format(endDate, "yyyy-MM-dd'T'23:59:59"));

  if (platform !== 'all') {
    // DB may store lowercase or Capitalized platform names — match both
    const dbPlatformVariants: Record<string, string[]> = {
      google: ['google', 'Google'],
      tripadvisor: ['tripadvisor', 'TripAdvisor'],
      thefork: ['thefork', 'TheFork'],
    };
    const variants = dbPlatformVariants[platform];
    if (variants) query = query.in('platform', variants);
  }

  if (locationId !== 'all') {
    query = query.eq('location_id', locationId);
  }

  query = query.order('review_date', { ascending: false }).limit(500);

  const { data: dbReviews, error } = await query;
  if (error) throw new Error(error.message);

  const rows: any[] = dbReviews || [];

  // Map DB rows to Review type
  const reviews: Review[] = rows.map((r: any) => {
    const plat = normalizePlatform(r.platform || 'Google');
    const ownerReply: OwnerReply | undefined = r.response_text
      ? { text: r.response_text, created_at: r.response_date || r.created_at, status: (r.response_status === 'published' ? 'published' : 'draft') as ReplyStatus }
      : undefined;
    return {
      id: r.id,
      platform: plat,
      location_id: r.location_id,
      location_name: getLocationName(r.location_id, locs),
      author_name: r.author_name || r.reviewer_name || 'Anonymous',
      author_avatar_letter: (r.author_name || r.reviewer_name || 'A').charAt(0).toUpperCase(),
      rating: Math.min(5, Math.max(1, r.rating || 3)) as 1 | 2 | 3 | 4 | 5,
      created_at: r.review_date || r.created_at,
      text: r.review_text || '',
      owner_reply: ownerReply,
      source_label: PLATFORM_LABELS[plat] || `From ${r.platform}`,
    };
  });

  // Compute summary
  const reviewCount = reviews.length;
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const rating_avg = reviewCount > 0 ? totalRating / reviewCount : 0;

  // Star breakdown
  const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => { starCounts[r.rating] = (starCounts[r.rating] || 0) + 1; });
  const star_breakdown: StarBreakdown[] = ([5, 4, 3, 2, 1] as const).map(stars => ({
    stars,
    count: starCounts[stars] || 0,
    pct: reviewCount > 0 ? ((starCounts[stars] || 0) / reviewCount) * 100 : 0,
  }));

  // Rating over time (daily averages for last 14 days of range)
  const days = eachDayOfInterval({ start: subDays(endDate, 13), end: endDate });
  const rating_over_time: RatingOverTimePoint[] = days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayReviews = reviews.filter(r => r.created_at?.startsWith(dayStr));
    const avg = dayReviews.length > 0
      ? dayReviews.reduce((s, r) => s + r.rating, 0) / dayReviews.length
      : 0;
    return { date: dayStr, rating_avg: avg || rating_avg };
  });

  // Response rate = reviews with a reply / total reviews
  const repliedCount = reviews.filter(r => r.owner_reply).length;
  const response_rate = reviewCount > 0 ? (repliedCount / reviewCount) * 100 : 0;

  // Rating by location (dynamic locations from context)
  const rating_by_location: LocationRatingData[] = locs.map(loc => {
    const locReviews = reviews.filter(r => r.location_id === loc.id);
    const locTotal = locReviews.length;
    const locAvg = locTotal > 0 ? locReviews.reduce((s, r) => s + r.rating, 0) / locTotal : 0;
    const pos = locReviews.filter(r => r.rating >= 4).length;
    const neutral = locReviews.filter(r => r.rating === 3).length;
    const neg = locReviews.filter(r => r.rating <= 2).length;
    const locReplied = locReviews.filter(r => r.owner_reply).length;

    return {
      location_id: loc.id,
      location_name: loc.name,
      rating_avg: locAvg,
      total_ratings: locTotal,
      response_rate: locTotal > 0 ? (locReplied / locTotal) * 100 : 0,
      distribution: {
        pos: locTotal > 0 ? (pos / locTotal) * 100 : 0,
        neutral: locTotal > 0 ? (neutral / locTotal) * 100 : 0,
        neg: locTotal > 0 ? (neg / locTotal) * 100 : 0,
      },
    };
  }).filter(l => l.total_ratings > 0);

  return {
    summary: {
      rating_avg,
      ratings_in_period: reviewCount,
      response_rate,
      avg_response_time_hours: repliedCount > 0 ? 2 : 0,
      rating_over_time,
      star_breakdown,
      rating_by_location,
    },
    reviews,
  };
}

export function useReviewsData(params: UseReviewsDataParams): ReviewsData {
  const { startDate, endDate, platform, locationId } = params;

  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), platform, locationId],
    queryFn: () => fetchReviews(params),
    staleTime: 5 * 60 * 1000,
  });

  return {
    summary: data?.summary ?? {
      rating_avg: 0,
      ratings_in_period: 0,
      response_rate: 0,
      avg_response_time_hours: 0,
      rating_over_time: [],
      star_breakdown: [],
      rating_by_location: [],
    },
    reviews: data?.reviews ?? [],
    isLoading,
    error: error as Error | null,
  };
}

export { PLATFORMS, PLATFORM_LABELS };
