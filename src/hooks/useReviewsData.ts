import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, differenceInHours, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// Types
export type Platform = 'all' | 'google' | 'tripadvisor' | 'deliveroo' | 'justeat' | 'ubereats' | 'glovo';
export type ReplyStatus = 'draft' | 'published' | 'pending';

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
  sentiment?: string;
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
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'From Google',
  tripadvisor: 'From TripAdvisor',
  deliveroo: 'From Deliveroo',
  justeat: 'From Just Eat',
  ubereats: 'From Uber Eats',
  glovo: 'From Glovo',
};

const LOCATIONS = [
  { id: 'cpu', name: 'CPU' },
  { id: 'westside', name: 'Westside' },
  { id: 'eastside', name: 'Eastside' },
  { id: 'southside', name: 'Southside' },
  { id: 'westend', name: 'Westend' },
  { id: 'hq', name: 'HQ' },
];

const PLATFORMS: Exclude<Platform, 'all'>[] = ['google', 'tripadvisor', 'deliveroo', 'justeat', 'ubereats', 'glovo'];

async function fetchRealReviews(params: UseReviewsDataParams): Promise<{ summary: ReviewsSummary; reviews: Review[] }> {
  const { startDate, endDate, platform, locationId } = params;
  
  const fromDate = format(startDate, 'yyyy-MM-dd');
  const toDate = format(endDate, 'yyyy-MM-dd');
  
  // Fetch reviews from database
  let query = supabase
    .from('reviews')
    .select('*, locations(name)')
    .gte('review_date', `${fromDate}T00:00:00`)
    .lte('review_date', `${toDate}T23:59:59`)
    .order('review_date', { ascending: false });
  
  if (platform !== 'all') {
    query = query.eq('platform', platform);
  }
  
  if (locationId !== 'all') {
    query = query.eq('location_id', locationId);
  }
  
  const { data: reviewsData, error } = await query.limit(500);
  
  if (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }
  
  // Transform to Review format
  const reviews: Review[] = (reviewsData || []).map((r: any) => ({
    id: r.id,
    platform: r.platform as Exclude<Platform, 'all'>,
    location_id: r.location_id,
    location_name: r.locations?.name || 'Unknown',
    author_name: r.author_name || 'Anonymous',
    author_avatar_letter: (r.author_name || 'A').charAt(0).toUpperCase(),
    rating: Math.min(5, Math.max(1, r.rating)) as 1 | 2 | 3 | 4 | 5,
    created_at: r.review_date,
    text: r.review_text || '',
    owner_reply: r.response_text ? {
      text: r.response_text,
      created_at: r.response_date || r.updated_at,
      status: (r.response_status || 'draft') as ReplyStatus,
    } : undefined,
    source_label: PLATFORM_LABELS[r.platform] || `From ${r.platform}`,
    sentiment: r.sentiment,
  }));
  
  // Calculate statistics
  const totalReviews = reviews.length;
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const rating_avg = totalReviews > 0 ? totalRating / totalReviews : 0;
  
  const repliedCount = reviews.filter(r => r.owner_reply && r.owner_reply.status === 'published').length;
  const response_rate = totalReviews > 0 ? (repliedCount / totalReviews) * 100 : 0;
  
  // Avg response time
  let totalResponseHours = 0;
  let responseCount = 0;
  reviews.forEach(r => {
    if (r.owner_reply?.created_at) {
      const reviewDate = parseISO(r.created_at);
      const replyDate = parseISO(r.owner_reply.created_at);
      const hours = differenceInHours(replyDate, reviewDate);
      if (hours > 0 && hours < 720) { // Less than 30 days
        totalResponseHours += hours;
        responseCount++;
      }
    }
  });
  const avg_response_time_hours = responseCount > 0 ? totalResponseHours / responseCount : 0;
  
  // Star breakdown
  const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => {
    starCounts[r.rating as keyof typeof starCounts]++;
  });
  
  const star_breakdown: StarBreakdown[] = ([5, 4, 3, 2, 1] as const).map(stars => ({
    stars,
    count: starCounts[stars],
    pct: totalReviews > 0 ? (starCounts[stars] / totalReviews) * 100 : 0,
  }));
  
  // Rating over time (group by day)
  const ratingByDay = new Map<string, { total: number; count: number }>();
  reviews.forEach(r => {
    const day = format(parseISO(r.created_at), 'yyyy-MM-dd');
    const existing = ratingByDay.get(day) || { total: 0, count: 0 };
    existing.total += r.rating;
    existing.count++;
    ratingByDay.set(day, existing);
  });
  
  const rating_over_time: RatingOverTimePoint[] = Array.from(ratingByDay.entries())
    .map(([date, data]) => ({
      date,
      rating_avg: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Rating by location
  const locationStats = new Map<string, { total: number; count: number; replied: number; name: string; pos: number; neutral: number; neg: number }>();
  reviews.forEach(r => {
    const existing = locationStats.get(r.location_id) || { 
      total: 0, count: 0, replied: 0, name: r.location_name,
      pos: 0, neutral: 0, neg: 0
    };
    existing.total += r.rating;
    existing.count++;
    if (r.owner_reply?.status === 'published') existing.replied++;
    if (r.rating >= 4) existing.pos++;
    else if (r.rating === 3) existing.neutral++;
    else existing.neg++;
    locationStats.set(r.location_id, existing);
  });
  
  const rating_by_location: LocationRatingData[] = Array.from(locationStats.entries()).map(([loc_id, data]) => ({
    location_id: loc_id,
    location_name: data.name,
    rating_avg: data.count > 0 ? data.total / data.count : 0,
    total_ratings: data.count,
    response_rate: data.count > 0 ? (data.replied / data.count) * 100 : 0,
    distribution: {
      pos: data.count > 0 ? (data.pos / data.count) * 100 : 0,
      neutral: data.count > 0 ? (data.neutral / data.count) * 100 : 0,
      neg: data.count > 0 ? (data.neg / data.count) * 100 : 0,
    },
  }));
  
  return {
    summary: {
      rating_avg,
      ratings_in_period: totalReviews,
      response_rate,
      avg_response_time_hours,
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
    queryFn: async () => {
      return fetchRealReviews(params);
    },
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

export { LOCATIONS, PLATFORMS, PLATFORM_LABELS };
