import { useMemo } from 'react';
import { Sparkles, AlertTriangle, Lightbulb, Info, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buildDashboardInsights, type LowStockItem } from '@/lib/buildDashboardInsights';
import type { DashboardKpis } from '@/hooks/useDashboardMetrics';
import type { HonestProduct } from '@/hooks/useTopProductsHonest';

interface NarrativeInsightsPanelProps {
  kpis: DashboardKpis | null;
  previousKpis: DashboardKpis | null;
  topProducts: HonestProduct[] | null;
  lowStockItems: LowStockItem[] | null;
  loading?: boolean;
  className?: string;
}

export function NarrativeInsightsPanel({
  kpis,
  previousKpis,
  topProducts,
  lowStockItems,
  loading = false,
  className,
}: NarrativeInsightsPanelProps) {
  const insights = useMemo(
    () => buildDashboardInsights(kpis, previousKpis, topProducts, lowStockItems),
    [kpis, previousKpis, topProducts, lowStockItems],
  );

  const hasContent = insights.actions.length > 0 || insights.risks.length > 0;
  const hasMissing = insights.missing.length > 0;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          Josephine dice...
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loading */}
        {loading && (
          <p className="text-sm text-muted-foreground py-4">Cargando datos del dashboard...</p>
        )}

        {/* No signals at all */}
        {!loading && !hasContent && !hasMissing && (
          <div className="flex flex-col items-center py-6 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Sin señales relevantes para este periodo. Todo dentro de parámetros normales.
            </p>
          </div>
        )}

        {/* Actions */}
        {insights.actions.length > 0 && (
          <div className="space-y-2">
            {insights.actions.map((insight, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                {insight.type === 'info' ? (
                  <Info className="h-4 w-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                )}
                <span className="text-foreground/90 leading-relaxed">{insight.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Risks */}
        {insights.risks.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Riesgos</p>
            {insights.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span className="text-foreground/90 leading-relaxed">{risk.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Missing data */}
        {hasMissing && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Datos insuficientes para analizar:</span>{' '}
              {insights.missing.join(', ')}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
