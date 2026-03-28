import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Crown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface PromotionalStrategyProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
  selectedCategory: string | null;
}

interface Recommendation {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: { name: string; reason: string }[];
  color: string;
  borderColor: string;
}

function formatCurrency(value: number): string {
  return `€${value.toFixed(2)}`;
}

/**
 * OMNES Principle 4 — Promotional Strategy
 *
 * Automatically identifies which dishes to promote based on their
 * position in the price range and classification:
 *
 * 1. "Promote these" — Mid-range price, high margins → best upsell candidates
 * 2. "Flagship opportunity" — Premium priced, low popularity → promote as chef's special
 * 3. "Quick wins" — Low price, very popular → small price bump won't hurt demand
 */
export function PromotionalStrategy({ items, stats, loading, selectedCategory }: PromotionalStrategyProps) {
  const recommendations = useMemo((): Recommendation[] => {
    if (!stats || items.length < 4) return [];

    const prices = items.map(i => i.selling_price_ex_vat).sort((a, b) => a - b);
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];
    const priceRange = maxPrice - minPrice;
    if (priceRange <= 0) return [];

    // Define thirds of the price range
    const lowThreshold = minPrice + priceRange * 0.33;
    const highThreshold = minPrice + priceRange * 0.67;

    // 1. "Promote these" — mid-range price + high GP (Puzzles or Stars in mid range)
    const midRangeHighMargin = items
      .filter(i =>
        i.selling_price_ex_vat > lowThreshold &&
        i.selling_price_ex_vat <= highThreshold &&
        i.unit_gross_profit >= stats.marginThreshold
      )
      .sort((a, b) => b.unit_gross_profit - a.unit_gross_profit)
      .slice(0, 3);

    // 2. "Flagship opportunity" — high price + low popularity (Puzzles in high range)
    const flagshipOpportunities = items
      .filter(i =>
        i.selling_price_ex_vat > highThreshold &&
        i.popularity_pct < stats.popThreshold &&
        i.unit_gross_profit > 0
      )
      .sort((a, b) => b.unit_gross_profit - a.unit_gross_profit)
      .slice(0, 3);

    // 3. "Quick wins" — low/mid price + very popular (Plow Horses)
    const quickWins = items
      .filter(i =>
        i.selling_price_ex_vat <= highThreshold &&
        i.popularity_pct >= stats.popThreshold &&
        i.unit_gross_profit < stats.marginThreshold
      )
      .sort((a, b) => b.units_sold - a.units_sold)
      .slice(0, 3);

    const result: Recommendation[] = [];

    if (midRangeHighMargin.length > 0) {
      result.push({
        icon: <Megaphone className="h-5 w-5" />,
        title: 'Promote these',
        subtitle: 'Mid-price, high margin — ideal upsell candidates',
        items: midRangeHighMargin.map(i => ({
          name: i.name,
          reason: `${formatCurrency(i.unit_gross_profit)} profit/plate · ${i.popularity_pct.toFixed(1)}% popularity`,
        })),
        color: 'text-violet-700 dark:text-violet-400',
        borderColor: 'border-l-violet-500',
      });
    }

    if (flagshipOpportunities.length > 0) {
      result.push({
        icon: <Crown className="h-5 w-5" />,
        title: 'Flagship opportunity',
        subtitle: 'Premium price, low orders — promote as chef\'s special',
        items: flagshipOpportunities.map(i => ({
          name: i.name,
          reason: `${formatCurrency(i.selling_price_ex_vat)} price · only ${i.units_sold} sold`,
        })),
        color: 'text-amber-700 dark:text-amber-400',
        borderColor: 'border-l-amber-500',
      });
    }

    if (quickWins.length > 0) {
      result.push({
        icon: <Zap className="h-5 w-5" />,
        title: 'Quick wins',
        subtitle: 'Very popular, low margin — small price increase won\'t hurt demand',
        items: quickWins.map(i => {
          const potentialGain = i.units_sold * 0.50; // €0.50 increase impact
          return {
            name: i.name,
            reason: `${i.units_sold} sold · +€0.50 = +${formatCurrency(potentialGain)}/month`,
          };
        }),
        color: 'text-emerald-700 dark:text-emerald-400',
        borderColor: 'border-l-emerald-500',
      });
    }

    return result;
  }, [items, stats]);

  // Only show when a category is selected (OMNES is per-category)
  if (!selectedCategory) return null;
  if (loading || !stats || items.length < 4) return null;
  if (recommendations.length === 0) return null;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-amber-500 to-emerald-500" />
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-violet-500" />
          Promotional Strategy
          <Badge variant="secondary" className="text-[10px] font-normal">OMNES P4</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Based on price distribution in <strong>{selectedCategory}</strong> — which dishes to push, feature, or adjust
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-lg border-l-4 bg-muted/20 p-4 space-y-3',
                rec.borderColor,
              )}
            >
              <div className="flex items-center gap-2">
                <span className={rec.color}>{rec.icon}</span>
                <div>
                  <h4 className={cn('text-sm font-semibold', rec.color)}>{rec.title}</h4>
                  <p className="text-[10px] text-muted-foreground">{rec.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {rec.items.map((item, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{item.name}</span>
                    <p className="text-muted-foreground text-[10px]">{item.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
