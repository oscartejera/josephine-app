import { useState, useCallback } from 'react';
import {
  Sparkles, Loader2, TrendingUp, TrendingDown, ArrowRight, AlertCircle,
  Shield, Scissors, Megaphone, Trash2, RefreshCw, ChefHat,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';
import { useTranslation } from 'react-i18next';

interface PricingSuggestion {
  product: string;
  current_price: number;
  suggested_price: number;
  change_pct: number;
  reason: string;
  estimated_impact_eur: number;
  priority: 'high' | 'medium' | 'low';
  action_type?: 'protect' | 'reduce_cost' | 'raise_price' | 'promote' | 'redesign' | 'remove';
}

interface OmnesData {
  price_range_ratio: number;
  price_range_state: string;
  category_ratio: number;
  pricing_health_state: string;
  band_distribution_state: string;
  lower_band_pct: number;
  middle_band_pct: number;
  upper_band_pct: number;
  average_menu_price: number;
  average_check_per_plate: number;
}

interface DynamicPricingPanelProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  locationName: string;
  categoryName?: string;
  omnesData?: OmnesData | null;
}

const PRICING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pricing_suggestions`;

const ACTION_ICONS: Record<string, React.ElementType> = {
  protect: Shield,
  reduce_cost: Scissors,
  raise_price: TrendingUp,
  promote: Megaphone,
  redesign: RefreshCw,
  remove: Trash2,
};

const ACTION_COLORS: Record<string, string> = {
  protect: 'text-emerald-600',
  reduce_cost: 'text-blue-600',
  raise_price: 'text-amber-600',
  promote: 'text-violet-600',
  redesign: 'text-orange-600',
  remove: 'text-red-600',
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'High' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Medium' },
  low: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Low' },
};

/**
 * Theory-grounded local fallback engine.
 * Used when Edge Function is unavailable (no OPENAI_API_KEY).
 * Follows the same Kasavana-Smith + OMNES rules as the AI prompt.
 */
function generateTheoryBasedSuggestions(
  menuItems: MenuEngineeringItem[],
  omnes?: OmnesData | null,
): PricingSuggestion[] {
  const results: PricingSuggestion[] = [];

  // --- PLOW HORSES: reduce cost first, raise price only if cost is already low ---
  const plowHorses = menuItems
    .filter(i => i.classification === 'plow_horse')
    .sort((a, b) => b.total_gross_profit - a.total_gross_profit)
    .slice(0, 2);

  for (const item of plowHorses) {
    const fcPct = item.selling_price_ex_vat > 0
      ? (item.unit_food_cost / item.selling_price_ex_vat) * 100
      : 0;

    if (fcPct > 30) {
      // Primary: reduce food cost
      const savingPerUnit = item.unit_food_cost * 0.10; // target 10% food cost reduction
      const impact = Math.round(savingPerUnit * item.units_sold);
      results.push({
        product: item.name,
        current_price: item.selling_price_ex_vat,
        suggested_price: item.selling_price_ex_vat, // no price change
        change_pct: 0,
        reason: `Food cost ${fcPct.toFixed(0)}% is high. Review recipe, portions, or suppliers. Saving €${savingPerUnit.toFixed(2)}/plate × ${item.units_sold} plates.`,
        estimated_impact_eur: impact,
        priority: impact > 300 ? 'high' : impact > 100 ? 'medium' : 'low',
        action_type: 'reduce_cost',
      });
    } else {
      // Secondary: careful price increase (cost already under control)
      const pctChange = 4;
      const suggestedPrice = Math.round(item.selling_price_ex_vat * 1.04 * 100) / 100;
      const impact = Math.round(item.units_sold * item.selling_price_ex_vat * 0.04);
      results.push({
        product: item.name,
        current_price: item.selling_price_ex_vat,
        suggested_price: suggestedPrice,
        change_pct: pctChange,
        reason: `Popular dish (${item.popularity_pct.toFixed(0)}% of sales). Food cost is controlled at ${fcPct.toFixed(0)}%. Small increase is safe.`,
        estimated_impact_eur: impact,
        priority: impact > 300 ? 'high' : impact > 100 ? 'medium' : 'low',
        action_type: 'raise_price',
      });
    }
  }

  // --- PUZZLES: promote visibility, NOT price cuts ---
  const puzzles = menuItems
    .filter(i => i.classification === 'puzzle')
    .sort((a, b) => b.unit_gross_profit - a.unit_gross_profit)
    .slice(0, 2);

  for (const item of puzzles) {
    const estimatedExtraUnits = Math.round(item.units_sold * 0.20);
    const impact = Math.round(estimatedExtraUnits * item.unit_gross_profit);
    results.push({
      product: item.name,
      current_price: item.selling_price_ex_vat,
      suggested_price: item.selling_price_ex_vat, // no price change
      change_pct: 0,
      reason: `€${item.unit_gross_profit.toFixed(2)} profit/plate but only ${item.popularity_pct.toFixed(0)}% of sales. Promote: menu placement, waiter recommendations, daily specials.`,
      estimated_impact_eur: impact > 0 ? impact : 50,
      priority: 'medium',
      action_type: 'promote',
    });
  }

  // --- STARS: protect, don't change ---
  const stars = menuItems
    .filter(i => i.classification === 'star')
    .sort((a, b) => b.total_gross_profit - a.total_gross_profit)
    .slice(0, 1);

  for (const item of stars) {
    const fcPct = item.selling_price_ex_vat > 0
      ? (item.unit_food_cost / item.selling_price_ex_vat) * 100
      : 0;

    if (fcPct > 35) {
      results.push({
        product: item.name,
        current_price: item.selling_price_ex_vat,
        suggested_price: item.selling_price_ex_vat,
        change_pct: 0,
        reason: `Star performer but food cost is ${fcPct.toFixed(0)}% (high). Review recipe cost to protect your margin without changing the price.`,
        estimated_impact_eur: Math.round(item.unit_food_cost * 0.1 * item.units_sold),
        priority: 'medium',
        action_type: 'reduce_cost',
      });
    } else {
      results.push({
        product: item.name,
        current_price: item.selling_price_ex_vat,
        suggested_price: item.selling_price_ex_vat,
        change_pct: 0,
        reason: `Your top performer. Protect this dish — keep recipe, placement, and price consistent.`,
        estimated_impact_eur: 0,
        priority: 'low',
        action_type: 'protect',
      });
    }
  }

  // --- DOGS: evaluate removal/redesign ---
  const dogs = menuItems
    .filter(i => i.classification === 'dog')
    .sort((a, b) => a.total_gross_profit - b.total_gross_profit)
    .slice(0, 1);

  for (const item of dogs) {
    const fcPct = item.selling_price_ex_vat > 0
      ? (item.unit_food_cost / item.selling_price_ex_vat) * 100
      : 0;

    if (fcPct > 35 || item.total_gross_profit < 0) {
      results.push({
        product: item.name,
        current_price: item.selling_price_ex_vat,
        suggested_price: 0,
        change_pct: -100,
        reason: `Low sales (${item.popularity_pct.toFixed(0)}%), low margin. Consider removing — it costs kitchen time without return.`,
        estimated_impact_eur: Math.round(Math.abs(item.total_gross_profit) * 0.5),
        priority: 'low',
        action_type: 'remove',
      });
    } else {
      results.push({
        product: item.name,
        current_price: item.selling_price_ex_vat,
        suggested_price: item.selling_price_ex_vat,
        change_pct: 0,
        reason: `Not selling well. Redesign the dish or replace with something your customers want.`,
        estimated_impact_eur: Math.round(item.units_sold * 3),
        priority: 'low',
        action_type: 'redesign',
      });
    }
  }

  // --- OMNES-driven insight (if available) ---
  if (omnes) {
    if (omnes.pricing_health_state === 'too_expensive' && results.length < 6) {
      results.push({
        product: '💡 Price perception',
        current_price: omnes.average_menu_price,
        suggested_price: omnes.average_check_per_plate,
        change_pct: 0,
        reason: `Customers pick cheaper options (avg check €${omnes.average_check_per_plate.toFixed(2)} vs avg price €${omnes.average_menu_price.toFixed(2)}). Avoid further increases.`,
        estimated_impact_eur: 0,
        priority: 'medium',
        action_type: 'protect',
      });
    }

    if (omnes.price_range_state === 'too_narrow' && results.length < 6) {
      results.push({
        product: '💡 Price range',
        current_price: 0,
        suggested_price: 0,
        change_pct: 0,
        reason: `Price range ratio ${omnes.price_range_ratio.toFixed(1)} is too narrow. Differentiate: add a premium or value option.`,
        estimated_impact_eur: 0,
        priority: 'low',
        action_type: 'promote',
      });
    }
  }

  return results.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
  });
}

export function DynamicPricingPanel({ items, stats, locationName, categoryName, omnesData }: DynamicPricingPanelProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [source, setSource] = useState<'ai' | 'local' | null>(null);

  const generateSuggestions = useCallback(async () => {
    if (!stats || items.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (token) {
        try {
          const resp = await fetch(PRICING_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              methodology: 'kasavana_smith_1982',
              schema_version: 2,
              is_canonical: stats.isCanonical,
              thresholds: {
                ideal_average_popularity: stats.popThreshold,
                average_gross_profit: stats.marginThreshold,
              },
              items: items.map((i) => ({
                name: i.name,
                category: i.category,
                classification: i.classification,
                classification_reason: i.classification_reason,
                selling_price_ex_vat: i.selling_price_ex_vat,
                unit_food_cost: i.unit_food_cost,
                unit_gross_profit: i.unit_gross_profit,
                food_cost_pct: i.selling_price_ex_vat > 0
                  ? Math.round((i.unit_food_cost / i.selling_price_ex_vat) * 100)
                  : 0,
                units_sold: i.units_sold,
                popularity_pct: i.popularity_pct,
                cost_source: i.cost_source,
                data_confidence: i.data_confidence,
              })),
              omnes: omnesData ? {
                price_range_ratio: omnesData.price_range_ratio,
                price_range_state: omnesData.price_range_state,
                category_ratio: omnesData.category_ratio,
                pricing_health_state: omnesData.pricing_health_state,
                band_distribution_state: omnesData.band_distribution_state,
                lower_band_pct: omnesData.lower_band_pct,
                middle_band_pct: omnesData.middle_band_pct,
                upper_band_pct: omnesData.upper_band_pct,
                average_menu_price: omnesData.average_menu_price,
                average_check_per_plate: omnesData.average_check_per_plate,
              } : undefined,
              totalSales: stats.totalSales,
              totalUnits: stats.totalUnits,
              locationName,
              categoryName: categoryName || 'All categories',
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data.suggestions?.length > 0) {
              setSuggestions(data.suggestions);
              setSource('ai');
              setHasGenerated(true);
              return;
            }
          }
        } catch {
          // Edge Function unavailable — fall through to local engine
        }
      }

      // Fallback: theory-based local engine
      const localSuggestions = generateTheoryBasedSuggestions(items, omnesData);
      setSuggestions(localSuggestions);
      setSource('local');
      setHasGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generating suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [items, stats, locationName, categoryName, omnesData]);

  const totalImpact = suggestions.reduce((sum, s) => sum + s.estimated_impact_eur, 0);
  const actionSuggestions = suggestions.filter(s => !s.product.startsWith('💡'));
  const insightSuggestions = suggestions.filter(s => s.product.startsWith('💡'));

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-amber-500 to-emerald-500" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Pricing Advisor
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
            {hasGenerated ? 'Refresh analysis' : 'Get recommendations'}
          </Button>
        </div>
        {hasGenerated && source && (
          <p className="text-xs text-muted-foreground mt-1">
            {source === 'ai' ? '🤖 Powered by GPT-4o · ' : '📊 Rule-based analysis · '}
            Based on Kasavana-Smith classification{omnesData ? ' + OMNES pricing analysis' : ''}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {/* Initial state */}
        {!hasGenerated && !isLoading && !error && (
          <div className="py-6 text-center space-y-2">
            <ChefHat className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Get personalized pricing recommendations based on your menu performance data.
            </p>
            <p className="text-xs text-muted-foreground">
              Uses Menu Engineering classification + OMNES price structure analysis
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <span className="text-sm text-muted-foreground">Analyzing {items.length} products...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="link" size="sm" className="px-0 h-auto text-xs" onClick={generateSuggestions}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {hasGenerated && suggestions.length > 0 && (
          <div className="space-y-4">
            {/* Impact summary */}
            {totalImpact > 0 && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                <span className="text-sm font-medium">Estimated monthly impact</span>
                <span className="text-lg font-bold text-emerald-600">
                  +€{totalImpact.toLocaleString()}
                </span>
              </div>
            )}

            {/* Action suggestions */}
            <div className="space-y-2">
              {actionSuggestions.map((suggestion, idx) => {
                const ActionIcon = ACTION_ICONS[suggestion.action_type || 'protect'] || Shield;
                const actionColor = ACTION_COLORS[suggestion.action_type || 'protect'] || 'text-muted-foreground';
                const priority = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.low;
                const isRemoval = suggestion.change_pct === -100;
                const isNoChange = suggestion.change_pct === 0 && !isRemoval;

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    {/* Action icon */}
                    <div className={`mt-0.5 ${actionColor}`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{suggestion.product}</span>
                        <Badge className={cn('text-[10px] px-1.5 py-0 h-5 border-0', priority.bg, priority.text)}>
                          {priority.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.reason}</p>
                    </div>

                    {/* Price change */}
                    <div className="text-right shrink-0">
                      {isRemoval ? (
                        <div className="text-xs text-red-600 font-medium">Remove</div>
                      ) : isNoChange ? (
                        <div className="text-xs text-muted-foreground">No price change</div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="text-muted-foreground">€{suggestion.current_price.toFixed(2)}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-bold">€{suggestion.suggested_price.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1 text-xs mt-0.5">
                            {suggestion.change_pct > 0 ? (
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-amber-500" />
                            )}
                            <span className={suggestion.change_pct > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                              {suggestion.change_pct > 0 ? '+' : ''}{suggestion.change_pct.toFixed(1)}%
                            </span>
                          </div>
                        </>
                      )}
                      {suggestion.estimated_impact_eur > 0 && (
                        <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          +€{suggestion.estimated_impact_eur}/mo
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* OMNES insights */}
            {insightSuggestions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground">Price structure insights (OMNES)</p>
                {insightSuggestions.map((insight, idx) => (
                  <div key={idx} className="p-2.5 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{insight.product}</span>
                    <span className="mx-1">—</span>
                    {insight.reason}
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              Recommendations based on Kasavana-Smith (1982) classification and OMNES pricing methodology.
              Review before applying changes in your POS.
            </p>
          </div>
        )}

        {/* No suggestions */}
        {hasGenerated && suggestions.length === 0 && !error && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No pricing recommendations for current data. Your menu looks well-balanced.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
