/**
 * useImplicitWaste — Hook for implicit waste (merma implícita) data
 *
 * Calls calculate_implicit_waste RPC to compare theoretical ingredient
 * consumption (POS sales × recipes) against actual stock counts.
 * Identifies unaccounted shrinkage per ingredient.
 */

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ImplicitWasteItem {
  item_id: string;
  item_name: string;
  unit: string;
  category: string | null;
  opening_qty: number;
  purchase_qty: number;
  theoretical_qty: number;
  explicit_waste_qty: number;
  closing_qty: number;
  implicit_waste_qty: number;
  implicit_waste_cost: number;
  unit_cost: number;
  variance_pct: number | null;
  opening_date: string | null;
  closing_date: string | null;
}

export interface ImplicitWasteSummary {
  total_items: number;
  items_with_variance: number;
  total_implicit_waste_cost: number;
  total_explicit_waste_cost: number;
  avg_variance_pct: number | null;
}

export interface ImplicitWasteResult {
  items: ImplicitWasteItem[];
  summary: ImplicitWasteSummary;
  period: { from: string; to: string };
}

export function useImplicitWaste(
  locationId: string | null,
  dateFrom: Date,
  dateTo: Date,
  enabled = true
) {
  const { profile } = useAuth();
  const orgId = profile?.group_id;

  return useQuery({
    queryKey: [
      'implicit-waste',
      orgId,
      locationId,
      format(dateFrom, 'yyyy-MM-dd'),
      format(dateTo, 'yyyy-MM-dd'),
    ],
    queryFn: async (): Promise<ImplicitWasteResult | null> => {
      if (!orgId || !locationId) return null;

      const { data, error } = await supabase.rpc(
        'calculate_implicit_waste',
        {
          p_org_id: orgId,
          p_location_id: locationId,
          p_from: format(dateFrom, 'yyyy-MM-dd'),
          p_to: format(dateTo, 'yyyy-MM-dd'),
        }
      );

      if (error) {
        console.warn('[useImplicitWaste] RPC error:', error.message);
        return null;
      }

      return data as ImplicitWasteResult;
    },
    enabled: !!orgId && !!locationId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
