import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

export interface InventoryCount {
    id: string;
    org_id: string;
    location_id: string;
    item_id: string;
    counted_by: string | null;
    count_date: string;
    stock_expected: number;
    stock_actual: number;
    variance: number;
    variance_pct: number;
    unit_cost: number;
    notes: string | null;
    created_at: string;
    // Joined
    item_name?: string;
    category?: string;
}

export interface DeadStockItem {
    item_id: string;
    item_name: string;
    category: string;
    on_hand: number;
    last_cost: number;
    stock_value: number;
    last_movement_at: string | null;
    days_idle: number;
}

export interface VarianceSummaryItem {
    item_id: string;
    item_name: string;
    category: string;
    stock_expected: number;
    stock_actual: number;
    variance: number;
    variance_pct: number;
    unit_cost: number;
    financial_loss: number;
    count_date: string;
}

export function useStockAudit(locationId: string | null) {
    const { group } = useApp();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Fetch recent counts for a location
    const countsQuery = useQuery({
        queryKey: ['inventory-counts', locationId],
        queryFn: async (): Promise<InventoryCount[]> => {
            if (!group?.id || !locationId) return [];

            const { data, error } = await (supabase
                .from('inventory_counts' as any)
                .select('*')
                .eq('org_id', group.id)
                .eq('location_id', locationId)
                .order('count_date', { ascending: false })
                .limit(200) as any);
            if (error) throw error;

            // Enrich with item names
            const itemIds = [...new Set((data || []).map((c: any) => c.item_id))] as string[];
            const { data: items } = await supabase
                .from('inventory_items')
                .select('id, name, category_id')
                .in('id', itemIds);

            const itemMap = new Map((items || []).map(i => [i.id, i]));

            return (data || []).map((c: any) => ({
                ...c,
                item_name: itemMap.get(c.item_id)?.name ?? 'Unknown',
            }));
        },
        enabled: !!group?.id && !!locationId,
    });

    // Dead stock RPC
    const deadStockQuery = useQuery({
        queryKey: ['dead-stock', locationId],
        queryFn: async (): Promise<DeadStockItem[]> => {
            if (!group?.id) return [];

            const { data, error } = await (supabase
                .rpc('get_dead_stock', {
                    p_org_id: group.id,
                    p_location_id: locationId ?? null,
                    p_days: 30,
                }) as any);
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!group?.id,
    });

    // Variance summary RPC
    const varianceQuery = useQuery({
        queryKey: ['variance-summary', locationId],
        queryFn: async (): Promise<VarianceSummaryItem[]> => {
            if (!group?.id) return [];

            const { data, error } = await (supabase
                .rpc('get_variance_summary', {
                    p_org_id: group.id,
                    p_location_id: locationId ?? null,
                }) as any);
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!group?.id,
    });

    // Submit a physical count
    const submitCount = useMutation({
        mutationFn: async (count: {
            item_id: string;
            stock_expected: number;
            stock_actual: number;
            unit_cost?: number;
            notes?: string;
        }) => {
            if (!group?.id || !locationId) throw new Error('Missing context');

            const { error } = await (supabase
                .from('inventory_counts' as any)
                .insert({
                    org_id: group.id,
                    location_id: locationId,
                    item_id: count.item_id,
                    counted_by: user?.id ?? null,
                    stock_expected: count.stock_expected,
                    stock_actual: count.stock_actual,
                    unit_cost: count.unit_cost ?? 0,
                    notes: count.notes ?? null,
                }) as any);
            if (error) throw error;

            // Also create a stock_movement of type 'count' to adjust inventory
            const variance = count.stock_actual - count.stock_expected;
            if (variance !== 0) {
                await supabase
                    .from('stock_movements')
                    .insert({
                        org_id: group.id,
                        item_id: count.item_id,
                        location_id: locationId,
                        movement_type: 'count',
                        qty_delta: variance,
                        unit_cost: count.unit_cost ?? 0,
                        reason: 'Physical count adjustment',
                        created_by: user?.id ?? null,
                    });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
            queryClient.invalidateQueries({ queryKey: ['variance-summary'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
    });

    // Computed metrics
    const variance = varianceQuery.data ?? [];
    const totalFinancialLoss = variance.reduce((sum, v) => sum + (v.variance < 0 ? v.financial_loss : 0), 0);
    const criticalItems = variance.filter(v => v.variance_pct < -5);
    const deadStock = deadStockQuery.data ?? [];
    const totalDeadStockValue = deadStock.reduce((sum, d) => sum + d.stock_value, 0);

    return {
        counts: countsQuery.data ?? [],
        variance,
        deadStock,
        isLoading: countsQuery.isLoading || varianceQuery.isLoading || deadStockQuery.isLoading,
        totalFinancialLoss: Math.round(totalFinancialLoss * 100) / 100,
        criticalItems,
        totalDeadStockValue: Math.round(totalDeadStockValue * 100) / 100,
        submitCount,
    };
}
