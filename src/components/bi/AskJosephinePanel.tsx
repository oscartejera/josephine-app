import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BISalesData } from '@/hooks/useBISalesData';

interface AskJosephinePanelProps {
  open: boolean;
  onClose: () => void;
  data: BISalesData | undefined;
}

export function AskJosephinePanel({ open, onClose, data }: AskJosephinePanelProps) {
  const isPositive = data ? data.kpis.salesToDateDelta >= 0 : true;

  const suggestedQuestions = [
    'Why is sales vs forecast up/down?',
    'What are the top drivers of sales?',
    'Which products are underperforming?',
    'How does this compare to last week?'
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask Josephine
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Quick Insight */}
          {data && (
            <div className={cn(
              "p-4 rounded-xl",
              isPositive ? "bg-[hsl(var(--bi-badge-positive))]/50" : "bg-[hsl(var(--bi-badge-negative))]/50"
            )}>
              <div className="flex items-start gap-3">
                {isPositive ? (
                  <TrendingUp className="h-5 w-5 text-[hsl(var(--bi-badge-positive-text))] shrink-0 mt-0.5" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-[hsl(var(--bi-badge-negative-text))] shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={cn(
                    "font-medium",
                    isPositive ? "text-[hsl(var(--bi-badge-positive-text))]" : "text-[hsl(var(--bi-badge-negative-text))]"
                  )}>
                    Sales are {isPositive ? 'above' : 'below'} forecast by {Math.abs(data.kpis.salesToDateDelta).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isPositive 
                      ? 'Great performance! Dine-in channel is driving most of the gains.'
                      : 'Consider reviewing delivery operations and marketing spend.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Drivers */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top Drivers
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Dine-in Sales</span>
                <span className="text-sm font-medium text-[hsl(var(--bi-badge-positive-text))]">+12.3%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Average Check Size</span>
                <span className="text-sm font-medium text-[hsl(var(--bi-badge-positive-text))]">+2.5%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Pick-up Volume</span>
                <span className="text-sm font-medium text-[hsl(var(--bi-badge-negative-text))]">-1.8%</span>
              </div>
            </div>
          </div>

          {/* Suggested Questions */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Suggested Questions
            </h3>
            <div className="space-y-2">
              {suggestedQuestions.map((question, i) => (
                <Button 
                  key={i}
                  variant="outline" 
                  className="w-full justify-start h-auto py-3 text-left"
                  disabled
                >
                  {question}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              AI-powered insights coming soon
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
