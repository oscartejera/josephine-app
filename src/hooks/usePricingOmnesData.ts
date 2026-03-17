import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildQueryContext } from '@/data';
import {
  analyzePricingCategory,
  getTopPricingActions,
  type PricingOmnesCategoryResult,
  type PricingOmnesInput,
  type PricingAction,
} from '@/lib/pricing-omnes-engine';

import { useTranslation } from 'react-i18next';
export function usePricingOmnesData() {
  const { t } = useTranslation();
  const { accessibleLocations, dataSource, loading: appLoading } = useApp();
  const { profile } = useAuth();

  const [result, setResult] = useState<PricingOmnesCategoryResult | null>{t('hooks.usePricingOmnesData.nullConstTopactionsSettopactionsUsestate')}<PricingAction[]>{t('hooks.usePricingOmnesData.constLoadingSetloadingUsestatetrueConst')}<string | null>{t('hooks.usePricingOmnesData.nullFiltersSharedWithMe')}<string | null>{t('hooks.usePricingOmnesData.nullConstDatefromSetdatefromUsestate')}<Date>(() => {t('hooks.usePricingOmnesData.startofmonthnewDateConstDatetoSetdateto')}<Date>(() => {t('hooks.usePricingOmnesData.endofmonthnewDateConstSelectedcategorySe')}<string | null>{t('hooks.usePricingOmnesData.nullCategoriesFromItemsConst')}<string[]>([]);

  const fetchData = useCallback(async () => {
    if (appLoading) return;

    setLoading(true);
    setError(null);

    try {
      const from = format(dateFrom, 'yyyy-MM-dd');
      const to = format(dateTo, 'yyyy-MM-dd');

      // Call the OMNES RPC
      const { data, error: rpcError } = await supabase.rpc(
        'pricing_omnes_summary' as any,
        {
          p_date_from: from,
          p_date_to: to,
          p_location_id: selectedLocationId || undefined,
          p_data_source: dataSource,
          p_category: selectedCategory || undefined,
        },
      );

      if (rpcError) throw rpcError;

      // RPC returns array of category results
      const rows = (Array.isArray(data) ? data : []) as any[];

      // Extract all categories for the selector
      const allCats = [...new Set(rows.map((r: any) => r.category as string))].sort();
      setCategories(allCats);

      // If a specific category is selected, show that analysis
      // If no category selected, use first category or null
      if (rows.length === 0) {
        setResult(null);
        setTopActions([]);
        setLoading(false);
        return;
      }

      // Use server-side computed data directly, or fallback to frontend engine
      const targetRow = selectedCategory
        ? rows.find((r: any) => r.category === selectedCategory)
        : rows[0];

      if (targetRow) {
        // Map server result to our typed interface
        const mapped: PricingOmnesCategoryResult = {
          category: String(targetRow.category || ''),
          item_count: Number(targetRow.item_count) || 0,
          max_price: Number(targetRow.max_price) || 0,
          min_price: Number(targetRow.min_price) || 0,
          price_range_ratio: Number(targetRow.price_range_ratio) || 0,
          price_range_state: targetRow.price_range_state || 'too_narrow',
          range_length: Number(targetRow.range_length) || 0,
          band_width: Number(targetRow.band_width) || 0,
          lower_band_min: Number(targetRow.min_price) || 0,
          lower_band_max: Number(targetRow.lower_band_max) || 0,
          middle_band_min: Number(targetRow.lower_band_max) || 0,
          middle_band_max: Number(targetRow.middle_band_max) || 0,
          upper_band_min: Number(targetRow.middle_band_max) || 0,
          upper_band_max: Number(targetRow.max_price) || 0,
          lower_band_count: Number(targetRow.lower_band_count) || 0,
          middle_band_count: Number(targetRow.middle_band_count) || 0,
          upper_band_count: Number(targetRow.upper_band_count) || 0,
          lower_band_pct: Number(targetRow.lower_band_pct) || 0,
          middle_band_pct: Number(targetRow.middle_band_pct) || 0,
          upper_band_pct: Number(targetRow.upper_band_pct) || 0,
          band_distribution_state: targetRow.band_distribution_state || 'balanced',
          average_check_per_plate: Number(targetRow.average_check_per_plate) || 0,
          average_menu_price: Number(targetRow.average_menu_price) || 0,
          category_ratio: Number(targetRow.category_ratio) || 0,
          pricing_health_state: targetRow.pricing_health_state || 'healthy',
          promotion_zone: targetRow.promotion_zone || 'none',
          pricing_recommendation_reason: '',
          items: (targetRow.items || []).map((it: any) => ({
            item_name: String(it.name || ''),
            category: String(it.category || ''),
            listed_price: Number(it.listed_price) || 0,
            units_sold: Number(it.units_sold) || 0,
            item_revenue: Number(it.item_revenue) || 0,
            band: it.band || 'lower',
            is_promotion_candidate: Boolean(it.is_promotion_candidate),
          })),
        };

        // Generate actions using the frontend engine
        const actions = getTopPricingActions(mapped, 3);
        // Build recommendation reason from actions
        mapped.pricing_recommendation_reason = actions.map(a => a.description).join(' ');

        setResult(mapped);
        setTopActions(actions);
      } else {
        setResult(null);
        setTopActions([]);
      }
    } catch (err) {
      console.error('Pricing OMNES fetch error:', err);
      setError(err instanceof Error ? err.message : 'Error loading pricing analysis');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedLocationId, selectedCategory, dataSource, appLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    result,
    topActions,
    categories,
    loading,
    error,
    selectedLocationId,
    setSelectedLocationId,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    selectedCategory,
    setSelectedCategory,
    refetch: fetchData,
    accessibleLocations,
  };
}
