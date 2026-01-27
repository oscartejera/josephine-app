import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, differenceInHours, parseISO } from 'date-fns';

// Types
export type Platform = 'all' | 'google' | 'tripadvisor' | 'deliveroo' | 'justeat';
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
}

// Use centralized SeededRandom
import { SeededRandom, hashString } from '@/lib/seededRandom';

const LOCATIONS = [
  { id: 'cpu', name: 'CPU' },
  { id: 'westside', name: 'Westside' },
  { id: 'eastside', name: 'Eastside' },
  { id: 'southside', name: 'Southside' },
  { id: 'westend', name: 'Westend' },
  { id: 'hq', name: 'HQ' },
];

const PLATFORMS: Exclude<Platform, 'all'>[] = ['google', 'tripadvisor', 'deliveroo', 'justeat'];

const PLATFORM_LABELS: Record<Exclude<Platform, 'all'>, string> = {
  google: 'From Google',
  tripadvisor: 'From TripAdvisor',
  deliveroo: 'From Deliveroo',
  justeat: 'From Just Eat',
};

const REVIEWER_NAMES = [
  'Cian Bailey', 'Emma Thompson', 'James Wilson', 'Sophie Chen', 'Michael Brown',
  'Olivia Davis', 'William Jones', 'Isabella Martinez', 'Alexander Garcia', 'Mia Robinson',
  'Daniel Lee', 'Charlotte White', 'Matthew Harris', 'Amelia Clark', 'Ethan Lewis',
  'Ava Walker', 'Benjamin Hall', 'Harper Allen', 'Lucas Young', 'Evelyn King',
];

const REVIEW_TEXTS_POSITIVE = [
  'Amazing food and excellent service! Will definitely come back.',
  'Best dining experience in the city. The staff was incredibly attentive.',
  'The food was delicious and the atmosphere was perfect for our celebration.',
  'Outstanding quality. Every dish was cooked to perfection.',
  'Wonderful experience from start to finish. Highly recommend!',
  'Great value for money. The portions were generous and tasty.',
  'The chef really knows how to bring out the flavours. Loved it!',
  'Perfect spot for a date night. Romantic ambiance and great food.',
];

const REVIEW_TEXTS_NEUTRAL = [
  'Food was good, but the wait time was a bit long.',
  'Decent meal overall. Nothing spectacular but solid.',
  'Nice place, though it was quite crowded on a Saturday.',
  'The main course was great, but dessert was average.',
];

const REVIEW_TEXTS_NEGATIVE = [
  'Disappointed with the service. Had to wait 30 minutes for our order.',
  'Food was cold when it arrived. Not what I expected.',
  'Too expensive for what you get. Won\'t be returning.',
];

const DRAFT_REPLIES = [
  'Thank you so much for your wonderful feedback! We\'re thrilled that you enjoyed your experience with us.',
  'We really appreciate you taking the time to share your thoughts. Your feedback helps us improve!',
  'Thank you for visiting us! We\'re glad you had a positive experience and hope to see you again soon.',
  'We appreciate your honest feedback and will take your comments on board to improve our service.',
];

function generateMockReviews(params: UseReviewsDataParams): { summary: ReviewsSummary; reviews: Review[] } {
  const { startDate, endDate, platform, locationId } = params;
  const seedStr = `${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}-${platform}-${locationId}`;
  const rng = new SeededRandom(hashString(seedStr));
  
  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const reviewCount = rng.intBetween(Math.min(10, days * 2), Math.min(120, days * 8));
  
  // Filter locations
  const filteredLocations = locationId === 'all' 
    ? LOCATIONS 
    : LOCATIONS.filter(l => l.id === locationId);
  
  // Filter platforms
  const filteredPlatforms = platform === 'all' 
    ? PLATFORMS 
    : [platform as Exclude<Platform, 'all'>];
  
  // Generate reviews
  const reviews: Review[] = [];
  let totalRating = 0;
  let repliedCount = 0;
  let totalResponseTimeHours = 0;
  
  const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  for (let i = 0; i < reviewCount; i++) {
    const location = rng.pick(filteredLocations);
    const platformChoice = rng.pick(filteredPlatforms);
    const authorName = rng.pick(REVIEWER_NAMES);
    
    // Weighted rating generation (skewed towards positive)
    const ratingRoll = rng.next();
    let rating: 1 | 2 | 3 | 4 | 5;
    if (ratingRoll < 0.55) rating = 5;
    else if (ratingRoll < 0.75) rating = 4;
    else if (ratingRoll < 0.85) rating = 3;
    else if (ratingRoll < 0.92) rating = 2;
    else rating = 1;
    
    starCounts[rating]++;
    totalRating += rating;
    
    // Review text based on rating
    let text: string;
    if (rating >= 4) text = rng.pick(REVIEW_TEXTS_POSITIVE);
    else if (rating === 3) text = rng.pick(REVIEW_TEXTS_NEUTRAL);
    else text = rng.pick(REVIEW_TEXTS_NEGATIVE);
    
    // Random date within range
    const daysAgo = rng.intBetween(0, days - 1);
    const hoursAgo = rng.intBetween(1, 23);
    const reviewDate = subDays(endDate, daysAgo);
    reviewDate.setHours(hoursAgo);
    
    // Owner reply (55-75% response rate)
    let owner_reply: OwnerReply | undefined;
    const hasReply = rng.next() < rng.between(0.55, 0.75);
    if (hasReply) {
      repliedCount++;
      const replyHoursLater = rng.intBetween(1, 48);
      totalResponseTimeHours += replyHoursLater;
      const replyDate = new Date(reviewDate.getTime() + replyHoursLater * 60 * 60 * 1000);
      owner_reply = {
        text: rng.pick(DRAFT_REPLIES),
        created_at: replyDate.toISOString(),
        status: rng.next() > 0.3 ? 'published' : 'draft',
      };
    }
    
    reviews.push({
      id: `review-${i}-${hashString(authorName + location.id)}`,
      platform: platformChoice,
      location_id: location.id,
      location_name: location.name,
      author_name: authorName,
      author_avatar_letter: authorName.charAt(0).toUpperCase(),
      rating,
      created_at: reviewDate.toISOString(),
      text,
      owner_reply,
      source_label: PLATFORM_LABELS[platformChoice],
    });
  }
  
  // Sort reviews by date (newest first)
  reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Calculate summary
  const rating_avg = reviewCount > 0 ? totalRating / reviewCount : 0;
  const response_rate = reviewCount > 0 ? (repliedCount / reviewCount) * 100 : 0;
  const avg_response_time_hours = repliedCount > 0 ? totalResponseTimeHours / repliedCount : 0;
  
  // Star breakdown
  const star_breakdown: StarBreakdown[] = ([5, 4, 3, 2, 1] as const).map(stars => ({
    stars,
    count: starCounts[stars],
    pct: reviewCount > 0 ? (starCounts[stars] / reviewCount) * 100 : 0,
  }));
  
  // Rating over time
  const rating_over_time: RatingOverTimePoint[] = [];
  for (let d = 0; d < Math.min(days, 14); d++) {
    const date = subDays(endDate, days - 1 - d);
    const dayRng = new SeededRandom(hashString(format(date, 'yyyy-MM-dd') + seedStr));
    rating_over_time.push({
      date: format(date, 'yyyy-MM-dd'),
      rating_avg: dayRng.between(4.2, 4.9),
    });
  }
  
  // Rating by location
  const rating_by_location: LocationRatingData[] = LOCATIONS.map(loc => {
    const locRng = new SeededRandom(hashString(loc.id + seedStr));
    const locReviews = reviews.filter(r => r.id.includes(loc.id) || locRng.next() > 0.5);
    const locTotalRatings = locRng.intBetween(5, 35);
    const locReplied = locRng.intBetween(2, locTotalRatings);
    
    return {
      location_id: loc.id,
      location_name: loc.name,
      rating_avg: locRng.between(4.0, 4.95),
      total_ratings: locTotalRatings,
      response_rate: (locReplied / locTotalRatings) * 100,
      distribution: {
        pos: locRng.between(60, 90),
        neutral: locRng.between(5, 20),
        neg: locRng.between(2, 15),
      },
    };
  });
  
  return {
    summary: {
      rating_avg,
      ratings_in_period: reviewCount,
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
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));
      return generateMockReviews(params);
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
