import { Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StarBreakdown } from '@/hooks/useReviewsData';
import { cn } from '@/lib/utils';

interface StarBreakdownTableProps {
  data: StarBreakdown[];
  isLoading: boolean;
}

export function StarBreakdownTable({ data, isLoading }: StarBreakdownTableProps) {
  return (
    <Card className="p-5 bg-card border border-border/60 rounded-xl">
      <h3 className="text-base font-semibold text-foreground mb-4">Rating</h3>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Rating</th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-2 pr-4 w-24">Total ratings</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-2 w-48">% of rating</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.stars} className="border-b border-border/30 last:border-0">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: row.stars }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        />
                      ))}
                      {Array.from({ length: 5 - row.stars }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 text-muted-foreground/30"
                        />
                      ))}
                      <span className="ml-1.5 text-sm text-foreground">{row.stars} stars</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className="text-sm font-medium text-foreground">{row.count}</span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            row.stars >= 4 ? "bg-primary/70" : row.stars === 3 ? "bg-amber-400" : "bg-destructive/70"
                          )}
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {row.pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
