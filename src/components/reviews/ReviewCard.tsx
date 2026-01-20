import { useState } from 'react';
import { Star, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Review } from '@/hooks/useReviewsData';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface ReviewCardProps {
  review: Review;
  onRefine: (reviewId: string, tone: 'friendly' | 'professional' | 'concise', currentText: string) => Promise<string>;
  onSubmit: (reviewId: string, replyText: string) => Promise<void>;
}

const REFINE_OPTIONS = [
  { value: 'friendly' as const, label: 'Friendly', description: 'Personable, welcoming, and casual' },
  { value: 'professional' as const, label: 'Professional', description: 'Respectful, polished, and slightly formal' },
  { value: 'concise' as const, label: 'Concise', description: 'Short, direct, and to the point' },
];

export function ReviewCard({ review, onRefine, onSubmit }: ReviewCardProps) {
  const [replyText, setReplyText] = useState(review.owner_reply?.text || '');
  const [isRefining, setIsRefining] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);

  const isPublished = review.owner_reply?.status === 'published';
  const timeAgo = formatDistanceToNow(new Date(review.created_at), { addSuffix: true });

  const handleRefine = async (tone: 'friendly' | 'professional' | 'concise') => {
    setIsRefining(true);
    setRefineOpen(false);
    try {
      const refined = await onRefine(review.id, tone, replyText || 'Thank you for your feedback!');
      setReplyText(refined);
      toast.success('Reply refined successfully');
    } catch (error) {
      toast.error('Failed to refine reply');
    } finally {
      setIsRefining(false);
    }
  };

  const handleSubmit = async () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(review.id, replyText);
      toast.success('Reply submitted successfully');
    } catch (error) {
      toast.error('Couldn\'t publish — saved as draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-card border border-border/60 rounded-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
            {review.author_avatar_letter}
          </div>
          {/* Name and rating */}
          <div>
            <p className="text-sm font-medium text-foreground">{review.author_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5',
                      i < review.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
        </div>
        {/* Source badge */}
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{review.source_label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{review.location_name}</p>
        </div>
      </div>

      {/* Review text */}
      <p className="text-sm text-foreground mb-3">{review.text}</p>

      {/* Published badge */}
      {isPublished && (
        <Badge variant="secondary" className="mb-3 bg-success/10 text-success border-0">
          Replied
        </Badge>
      )}

      {/* Reply textarea */}
      <Textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="Write your reply..."
        className="min-h-[80px] text-sm resize-none mb-3"
        disabled={isRefining || isSubmitting}
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Popover open={refineOpen} onOpenChange={setRefineOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isRefining || isSubmitting}
            >
              {isRefining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refine
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 py-1.5">
              Rewrite as
            </p>
            <div className="space-y-0.5">
              {REFINE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className="w-full text-left px-2 py-2 rounded-md hover:bg-muted transition-colors"
                  onClick={() => handleRefine(option.value)}
                >
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90"
          onClick={handleSubmit}
          disabled={isRefining || isSubmitting || !replyText.trim()}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          {isPublished ? 'Update' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
