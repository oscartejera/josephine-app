import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PricingOmnesCategoryResult, PricingAction } from '@/lib/pricing-omnes-engine';
import { useTranslation } from 'react-i18next';

interface PricingHealthCardsProps {
  result: PricingOmnesCategoryResult | null;
  topActions: PricingAction[];
  loading: boolean;
}

const STATE_STYLES = {
  // Price range state
  too_narrow: { label: 'Too narrow', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Minus },
  healthy: { label: 'Healthy', color: 'text-success', bg: 'bg-success/10', icon: TrendingUp },
  too_wide: { label: 'Too wide', color: 'text-destructive', bg: 'bg-destructive/10', icon: TrendingDown },
  // Pricing health
  too_expensive: { label: 'Perceived expensive', color: 'text-destructive', bg: 'bg-destructive/10', icon: TrendingDown },
  underpriced: { label: 'Underpriced', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: TrendingUp },
  // Band distribution
  balanced: { label: 'Balanced', color: 'text-success', bg: 'bg-success/10', icon: TrendingUp },
  weak_middle: { label: 'Weak middle band', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: AlertTriangle },
  too_many_lower: { label: 'Lower band heavy', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: TrendingDown },
  too_many_upper: { label: 'Upper band heavy', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: TrendingUp },
};

function getStateStyle(state: string) {
  return STATE_STYLES[state as keyof typeof STATE_STYLES] || STATE_STYLES.healthy;
}

export function PricingHealthCards({ result, topActions, loading }: PricingHealthCardsProps) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-6 w-20 mb-2" /><Skeleton className="h-10 w-16" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!result) return null;

  const priceState = getStateStyle(result.price_range_state);
  const healthState = getStateStyle(result.pricing_health_state);
  const bandState = getStateStyle(result.band_distribution_state);

  return (
    <div className="space-y-4">
      {/* OMNES KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* OMNES 1: Price Range Ratio */}
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{t('pricing-omnes.PricingHealthCards.priceRangeRatio')}</span>
              <Badge className={`text-xs ${priceState.bg} ${priceState.color} border-0`}>
                {priceState.label}
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{result.price_range_ratio.toFixed(2)}×</div>
            <p className="text-xs text-muted-foreground">
              €{result.min_price.toFixed(2)} – €{result.max_price.toFixed(2)} · Ideal: 2.5–3.0×
            </p>
          </CardContent>
        </Card>

        {/* OMNES 2: Band Distribution */}
        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{t('pricing-omnes.PricingHealthCards.bandDistribution')}</span>
              <Badge className={`text-xs ${bandState.bg} ${bandState.color} border-0`}>
                {bandState.label}
              </Badge>
            </div>
            {/* Visual band distribution bar */}
            <div className="flex h-6 rounded-full overflow-hidden mb-2">
              <div
                className="bg-blue-400 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ width: `${Math.max(result.lower_band_pct, 5)}%` }}
              >
                {result.lower_band_pct > 10 ? `${result.lower_band_pct}%` : ''}
              </div>
              <div
                className="bg-violet-500 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ width: `${Math.max(result.middle_band_pct, 5)}%` }}
              >
                {result.middle_band_pct > 10 ? `${result.middle_band_pct}%` : ''}
              </div>
              <div
                className="bg-rose-400 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ width: `${Math.max(result.upper_band_pct, 5)}%` }}
              >
                {result.upper_band_pct > 10 ? `${result.upper_band_pct}%` : ''}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Lower {result.lower_band_count} · Middle {result.middle_band_count} · Upper {result.upper_band_count} · Target: 25/50/25%
            </p>
          </CardContent>
        </Card>

        {/* OMNES 3: Category Ratio */}
        <Card className="border-l-4 border-l-fuchsia-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{t('pricing-omnes.PricingHealthCards.categoryRatio')}</span>
              <Badge className={`text-xs ${healthState.bg} ${healthState.color} border-0`}>
                {healthState.label}
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{result.category_ratio.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Avg check: €{result.average_check_per_plate.toFixed(2)} · Avg price: €{result.average_menu_price.toFixed(2)} · Target: 0.90–1.00
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Actions */}
      {topActions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          <span className="text-xs font-medium text-muted-foreground self-center">{t('pricing-omnes.PricingHealthCards.actions')}</span>
          {topActions.map((action, i) => (
            <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-1.5 text-xs max-w-sm">
              <span className="font-medium shrink-0">{action.title}</span>
              <span className="text-muted-foreground hidden sm:inline">— {action.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* OMNES Info bar */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
        <Info className="h-3.5 w-3.5" />
        <span>
          OMNES Analysis — {result.item_count} products · Range: €{result.lower_band_min.toFixed(2)}–€{result.upper_band_max.toFixed(2)}
          {result.promotion_zone === 'middle' && ' · Promotion zone: middle band'}
        </span>
      </div>
    </div>
  );
}
