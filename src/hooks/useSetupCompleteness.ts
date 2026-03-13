import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SetupCompleteness {
  inventory_items_count: number;
  recipes_count: number;
  recipes_with_ingredients_count: number;
  menu_items_count: number;
  menu_items_with_recipe: number;
  has_pos_data: boolean;
  completeness_pct: number;
  missing_steps: string[];
}

export function useSetupCompleteness() {
  const { profile } = useAuth();
  const orgId = profile?.group_id;

  return useQuery({
    queryKey: ['setup-completeness', orgId],
    queryFn: async (): Promise<SetupCompleteness> => {
      if (!orgId) throw new Error('No org');

      const { data, error } = await supabase.rpc('get_setup_completeness', {
        p_org_id: orgId,
      });

      if (error) throw error;
      return data as SetupCompleteness;
    },
    enabled: !!orgId,
    staleTime: 60_000, // refresh every minute
  });
}
