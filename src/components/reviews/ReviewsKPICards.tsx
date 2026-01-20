import { Star, MessageSquare, Clock, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewsSummary } from '@/hooks/useReviewsData';

interface ReviewsKPICardsProps {
  summary: ReviewsSummary;
  isLoading: boolean;
}

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  isLoading: boolean;
}

function KPICard({ title, value, icon, isLoading }: KPICardProps) {
  return (
    <Card className="p-4 bg-card border border-border/60 rounded-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-primary/10">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function ReviewsKPICards({ summary, isLoading }: ReviewsKPICardsProps) {
  const formatRating = (rating: number) => {
    return rating.toFixed(2);
  };

  const formatResponseRate = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  const formatResponseTime = (hours: number) => {
    if (hours < 1) return '<1hr';
    return `${Math.round(hours)}hrs`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Rating"
        value={formatRating(summary.rating_avg)}
        icon={<Star className="h-5 w-5 text-primary" />}
        isLoading={isLoading}
      />
      <KPICard
        title="Ratings in the period"
        value={summary.ratings_in_period.toString()}
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
        isLoading={isLoading}
      />
      <KPICard
        title="Response rate"
        value={formatResponseRate(summary.response_rate)}
        icon={<MessageSquare className="h-5 w-5 text-primary" />}
        isLoading={isLoading}
      />
      <KPICard
        title="Avg response time"
        value={formatResponseTime(summary.avg_response_time_hours)}
        icon={<Clock className="h-5 w-5 text-primary" />}
        isLoading={isLoading}
      />
    </div>
  );
}
