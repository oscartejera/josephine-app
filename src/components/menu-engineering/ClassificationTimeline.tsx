import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock, TrendingUp, TrendingDown, History, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClassificationChange } from '@/hooks/useMenuEngineeringHistory';

interface ClassificationTimelineProps {
  changes: ClassificationChange[];
  timelineLoading: boolean;
  saving: boolean;
  hasData: boolean;
}

const CLASS_CONFIG: Record<string, { emoji: string; label: string; color: string; rank: number }> = {
  star:        { emoji: '⭐', label: 'Star',       color: 'text-emerald-600', rank: 4 },
  plow_horse:  { emoji: '🐴', label: 'Plow Horse', color: 'text-blue-600',    rank: 2 },
  puzzle:      { emoji: '💎', label: 'Puzzle',     color: 'text-amber-600',   rank: 3 },
  dog:         { emoji: '🔍', label: 'Dog',        color: 'text-red-600',     rank: 1 },
};

function isUpgrade(from: string, to: string): boolean {
  return (CLASS_CONFIG[to]?.rank ?? 0) > (CLASS_CONFIG[from]?.rank ?? 0);
}

function formatPeriod(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  } catch {
    return dateStr;
  }
}

export function ClassificationTimeline({
  changes,
  timelineLoading,
  saving,
  hasData,
}: ClassificationTimelineProps) {
  // No snapshots saved yet
  if (!hasData && !timelineLoading) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-8 text-center">
          <History className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <h4 className="text-sm font-medium mb-1">No historical data yet</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Josephine automatically saves a snapshot each time you view this page.
            Come back next month to see which dishes improved or declined.
          </p>
          {saving && (
            <Badge variant="outline" className="mt-3 animate-pulse">
              <Sparkles className="h-3 w-3 mr-1" />
              Saving first snapshot...
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

  // Loading
  if (timelineLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  // Has data but no changes between periods
  if (changes.length === 0) {
    return (
      <Card className="bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800">
        <CardContent className="py-6 text-center">
          <div className="text-2xl mb-2">✅</div>
          <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Menu is stable
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            No dish has changed classification since the last period. Keep monitoring.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show changes
  const upgrades = changes.filter((c) => isUpgrade(c.previous_classification, c.current_classification));
  const downgrades = changes.filter((c) => !isUpgrade(c.previous_classification, c.current_classification));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Classification Changes
          <Badge variant="secondary" className="ml-auto text-xs">
            {changes.length} change{changes.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {/* Downgrades first (more urgent) */}
        {downgrades.map((change) => {
          const from = CLASS_CONFIG[change.previous_classification];
          const to = CLASS_CONFIG[change.current_classification];
          return (
            <div
              key={`${change.product_id}-${change.current_period}`}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30"
            >
              <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{change.product_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {change.category} · {formatPeriod(change.previous_period)} → {formatPeriod(change.current_period)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className={cn("text-[10px]", from?.color)}>
                  {from?.emoji} {from?.label}
                </Badge>
                <ArrowRight className="h-3 w-3 text-red-400" />
                <Badge variant="outline" className={cn("text-[10px]", to?.color)}>
                  {to?.emoji} {to?.label}
                </Badge>
              </div>
            </div>
          );
        })}

        {/* Upgrades */}
        {upgrades.map((change) => {
          const from = CLASS_CONFIG[change.previous_classification];
          const to = CLASS_CONFIG[change.current_classification];
          return (
            <div
              key={`${change.product_id}-${change.current_period}`}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30"
            >
              <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{change.product_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {change.category} · {formatPeriod(change.previous_period)} → {formatPeriod(change.current_period)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className={cn("text-[10px]", from?.color)}>
                  {from?.emoji} {from?.label}
                </Badge>
                <ArrowRight className="h-3 w-3 text-emerald-400" />
                <Badge variant="outline" className={cn("text-[10px]", to?.color)}>
                  {to?.emoji} {to?.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
