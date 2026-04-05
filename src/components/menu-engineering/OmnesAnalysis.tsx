import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowUpDown,
  BarChart3,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface OmnesAnalysisProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
  selectedCategory: string | null;
}

type OmnesStatus = 'pass' | 'warning' | 'fail';

interface OmnesPrinciple {
  id: string;
  title: string;
  subtitle: string;
  value: number | string;
  target: string;
  status: OmnesStatus;
  detail: string;
  icon: React.ReactNode;
}

interface PriceRange {
  label: string;
  min: number;
  max: number;
  count: number;
  pct: number;
}

function formatCurrency(v: number): string {
  return `€${v.toFixed(2)}`;
}

function statusIcon(s: OmnesStatus) {
  switch (s) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function statusBg(s: OmnesStatus) {
  switch (s) {
    case 'pass':
      return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
    case 'warning':
      return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
    case 'fail':
      return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
  }
}

/**
 * OMNES Pricing Analysis — Principles 1-3
 *
 * P1: Amplitude Ratio (Max/Min ≤ 2.5, acceptable ≤ 3.0)
 * P2: Price Range Distribution (>50% items in Medium Range)
 * P3: Category Ratio (Avg Check / Avg Menu Price between 0.90–1.10)
 *
 * Based on Obsidian spec: menu-engineering.md § 4. ANALISIS OMNES
 */
export function OmnesAnalysis({ items, stats, loading, selectedCategory }: OmnesAnalysisProps) {
  const analysis = useMemo(() => {
    if (!stats || items.length < 3) return null;

    const prices = items
      .map((i) => i.selling_price_ex_vat)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (prices.length < 3) return null;

    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];

    // ═══ P1: Amplitude Ratio ═══
    const amplitudeRatio = maxPrice / minPrice;
    const p1Status: OmnesStatus =
      amplitudeRatio <= 2.5 ? 'pass' : amplitudeRatio <= 3.0 ? 'warning' : 'fail';
    const p1Detail =
      p1Status === 'pass'
        ? `Good: prices are well-balanced (${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)})`
        : p1Status === 'warning'
          ? `Borderline: the price gap is stretching. Consider adjusting extremes.`
          : `Too wide: customers perceive incoherence. Close the gap between ${formatCurrency(minPrice)} and ${formatCurrency(maxPrice)}.`;

    // ═══ P2: Price Range Distribution ═══
    const variance = maxPrice - minPrice;
    const rangeSize = variance / 3;
    const lowMax = minPrice + rangeSize;
    const medMax = minPrice + 2 * rangeSize;

    const ranges: PriceRange[] = [
      {
        label: 'Low',
        min: minPrice,
        max: lowMax,
        count: prices.filter((p) => p >= minPrice && p < lowMax).length,
        pct: 0,
      },
      {
        label: 'Medium',
        min: lowMax,
        max: medMax,
        count: prices.filter((p) => p >= lowMax && p < medMax).length,
        pct: 0,
      },
      {
        label: 'High',
        min: medMax,
        max: maxPrice,
        count: prices.filter((p) => p >= medMax && p <= maxPrice).length,
        pct: 0,
      },
    ];
    ranges.forEach((r) => (r.pct = Math.round((r.count / prices.length) * 100)));

    const mediumPct = ranges[1].pct;
    const p2Status: OmnesStatus = mediumPct >= 50 ? 'pass' : mediumPct >= 35 ? 'warning' : 'fail';
    const p2Detail =
      p2Status === 'pass'
        ? `Healthy: ${mediumPct}% of items in the medium range anchors customer expectations.`
        : p2Status === 'warning'
          ? `Only ${mediumPct}% in medium range. Aim for >50% to stabilize perceived value.`
          : `Only ${mediumPct}% in medium range. Pricing feels polarized — add mid-priced options.`;

    // ═══ P3: Category Ratio ═══
    const avgMenuPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
    const totalWeightedRevenue = items.reduce(
      (s, i) => s + i.selling_price_ex_vat * i.units_sold,
      0,
    );
    const totalUnits = items.reduce((s, i) => s + i.units_sold, 0);
    const avgCheck = totalUnits > 0 ? totalWeightedRevenue / totalUnits : 0;
    const categoryRatio = avgMenuPrice > 0 ? avgCheck / avgMenuPrice : 0;

    const p3Status: OmnesStatus =
      categoryRatio >= 0.9 && categoryRatio <= 1.1
        ? 'pass'
        : categoryRatio >= 0.8 && categoryRatio <= 1.2
          ? 'warning'
          : 'fail';
    const p3Detail =
      categoryRatio < 0.9
        ? `Ratio ${categoryRatio.toFixed(2)}: customers choose cheaper items. Review value perception of premium dishes.`
        : categoryRatio > 1.1
          ? `Ratio ${categoryRatio.toFixed(2)}: customers buy expensive items. Room to raise mid-range prices.`
          : `Ratio ${categoryRatio.toFixed(2)}: customers choose a balanced price mix — pricing is well-calibrated.`;

    const principles: OmnesPrinciple[] = [
      {
        id: 'P1',
        title: 'Amplitude Ratio',
        subtitle: 'Max / Min Price',
        value: amplitudeRatio.toFixed(2),
        target: '≤ 2.5',
        status: p1Status,
        detail: p1Detail,
        icon: <ArrowUpDown className="h-4 w-4" />,
      },
      {
        id: 'P2',
        title: 'Range Distribution',
        subtitle: '% items in Medium Range',
        value: `${mediumPct}%`,
        target: '> 50%',
        status: p2Status,
        detail: p2Detail,
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        id: 'P3',
        title: 'Category Ratio',
        subtitle: 'Avg Check / Avg Menu Price',
        value: categoryRatio.toFixed(2),
        target: '0.90 – 1.10',
        status: p3Status,
        detail: p3Detail,
        icon: <Target className="h-4 w-4" />,
      },
    ];

    const overallPass = principles.every((p) => p.status === 'pass');
    const overallFail = principles.some((p) => p.status === 'fail');

    return {
      principles,
      ranges,
      overallStatus: overallPass ? 'pass' : overallFail ? 'fail' : ('warning' as OmnesStatus),
      avgMenuPrice,
      avgCheck,
    };
  }, [items, stats]);

  // Only show when category is selected (Omnes is per-category)
  if (!selectedCategory) return null;
  if (loading || !analysis) return null;

  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-1',
          analysis.overallStatus === 'pass'
            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
            : analysis.overallStatus === 'warning'
              ? 'bg-gradient-to-r from-amber-400 to-amber-600'
              : 'bg-gradient-to-r from-red-400 to-red-600',
        )}
      />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Pricing Structure
            <Badge variant="secondary" className="text-[10px] font-normal">
              OMNES P1–P3
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {statusIcon(analysis.overallStatus)}
            <span
              className={cn(
                'text-xs font-medium',
                analysis.overallStatus === 'pass'
                  ? 'text-emerald-600'
                  : analysis.overallStatus === 'warning'
                    ? 'text-amber-600'
                    : 'text-red-600',
              )}
            >
              {analysis.overallStatus === 'pass'
                ? 'All checks pass'
                : analysis.overallStatus === 'warning'
                  ? 'Needs attention'
                  : 'Issues detected'}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Validates that the pricing structure of <strong>{selectedCategory}</strong> is coherent and
          well-balanced
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Principles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {analysis.principles.map((p) => (
            <div
              key={p.id}
              className={cn('rounded-lg border p-3 space-y-2', statusBg(p.status))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {p.icon}
                  <div>
                    <span className="text-xs font-bold">{p.id}</span>
                    <h4 className="text-sm font-semibold leading-tight">{p.title}</h4>
                  </div>
                </div>
                {statusIcon(p.status)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold tabular-nums">{p.value}</span>
                <span className="text-[10px] text-muted-foreground">target: {p.target}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{p.detail}</p>
            </div>
          ))}
        </div>

        {/* P2 Distribution Bars */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Price Range Distribution
          </h4>
          <div className="space-y-1.5">
            {analysis.ranges.map((range) => (
              <div key={range.label} className="flex items-center gap-2">
                <span className="text-[10px] w-14 text-muted-foreground">{range.label}</span>
                <span className="text-[10px] w-24 text-muted-foreground tabular-nums">
                  {formatCurrency(range.min)} – {formatCurrency(range.max)}
                </span>
                <div className="flex-1">
                  <Progress
                    value={range.pct}
                    className={cn(
                      'h-2',
                      range.label === 'Medium' ? '[&>div]:bg-blue-500' : '[&>div]:bg-muted-foreground/30',
                    )}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums w-10 text-right">
                  {range.count} ({range.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Reference values */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span>
            Avg Menu Price: <strong className="text-foreground">{formatCurrency(analysis.avgMenuPrice)}</strong>
          </span>
          <span>
            Avg Check (weighted): <strong className="text-foreground">{formatCurrency(analysis.avgCheck)}</strong>
          </span>
          <span>
            Items analyzed: <strong className="text-foreground">{items.length}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
