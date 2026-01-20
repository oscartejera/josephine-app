import { Star, ArrowRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReviewCard } from './ReviewCard';
import { Review } from '@/hooks/useReviewsData';

interface CustomerReviewsPanelProps {
  reviews: Review[];
  isLoading: boolean;
  onRefine: (reviewId: string, tone: 'friendly' | 'professional' | 'concise', currentText: string) => Promise<string>;
  onSubmit: (reviewId: string, replyText: string) => Promise<void>;
  maxItems?: number;
}

export function CustomerReviewsPanel({
  reviews,
  isLoading,
  onRefine,
  onSubmit,
  maxItems = 5,
}: CustomerReviewsPanelProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const displayedReviews = reviews.slice(0, maxItems);

  const handleSeeAll = () => {
    navigate(`/insights/reviews/all?${searchParams.toString()}`);
  };

  return (
    <Card className="p-5 bg-card border border-border/60 rounded-xl h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Customer Reviews</h3>
        </div>
        <Button variant="ghost" size="sm" className="gap-1" onClick={handleSeeAll}>
          See All
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-3 flex-1">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-3 pb-2">
            {displayedReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onRefine={onRefine}
                onSubmit={onSubmit}
              />
            ))}
            {displayedReviews.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No reviews found for this period</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
