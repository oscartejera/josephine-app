import { useState, useCallback } from 'react';
import { Sparkles, Loader2, TrendingUp, TrendingDown, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface PricingSuggestion {
  product: string;
  current_price: number;
  suggested_price: number;
  change_pct: number;
  reason: string;
  estimated_impact_eur: number;
  priority: 'high' | 'medium' | 'low';
}

interface DynamicPricingPanelProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  locationName: string;
}

const PRICING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pricing_suggestions`;

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Alta' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Media' },
  low: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Baja' },
};

export function DynamicPricingPanel({ items, stats, locationName }: DynamicPricingPanelProps) {
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateSuggestions = useCallback(async () => {
    if (!stats || items.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(PRICING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            name: i.name,
            category: i.category,
            units: i.units,
            sales: i.sales,
            cogs: i.cogs,
            margin_pct: i.margin_pct,
            classification: i.classification,
            popularity_share: i.popularity_share,
          })),
          totalSales: stats.totalSales,
          totalUnits: stats.totalUnits,
          locationName,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      setSuggestions(data.suggestions || []);
      setHasGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar sugerencias');
    } finally {
      setIsLoading(false);
    }
  }, [items, stats, locationName]);

  const totalImpact = suggestions.reduce((sum, s) => sum + s.estimated_impact_eur, 0);

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Dynamic Pricing AI
          </CardTitle>
          <Button
            variant={hasGenerated ? 'outline' : 'default'}
            size="sm"
            className={cn(!hasGenerated && 'bg-amber-600 hover:bg-amber-700')}
            onClick={generateSuggestions}
            disabled={isLoading || !stats || items.length === 0}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            {hasGenerated ? 'Recalcular' : 'Analizar precios'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Initial state */}
        {!hasGenerated && !isLoading && !error && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Analiza tu menú con IA para obtener recomendaciones de pricing basadas en demanda, margen y clasificación BCG.
          </p>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <span className="text-sm text-muted-foreground">Analizando {items.length} productos...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="link" size="sm" className="px-0 h-auto text-xs" onClick={generateSuggestions}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {/* Suggestions list */}
        {hasGenerated && suggestions.length > 0 && (
          <div className="space-y-4">
            {/* Total impact header */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Impacto mensual estimado</span>
              <span className="text-lg font-bold text-emerald-600">
                +€{totalImpact.toLocaleString('es-ES')}
              </span>
            </div>

            {/* Individual suggestions */}
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => {
                const isIncrease = suggestion.change_pct > 0;
                const priority = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.low;

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{suggestion.product}</span>
                        <Badge className={cn('text-[10px] px-1.5 py-0 h-5 border-0', priority.bg, priority.text)}>
                          {priority.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                    </div>

                    {/* Price change */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">€{suggestion.current_price.toFixed(2)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-bold">€{suggestion.suggested_price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs mt-0.5">
                        {isIncrease ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-amber-500" />
                        )}
                        <span className={isIncrease ? 'text-emerald-600' : 'text-amber-600'}>
                          {isIncrease ? '+' : ''}{suggestion.change_pct.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground ml-1">
                          (+€{suggestion.estimated_impact_eur}/mes)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Sugerencias basadas en clasificación BCG, elasticidad estimada y benchmarks del sector.
              Aplica cambios en tu POS.
            </p>
          </div>
        )}

        {/* No suggestions */}
        {hasGenerated && suggestions.length === 0 && !error && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay recomendaciones de pricing para los datos actuales.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
