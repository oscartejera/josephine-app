import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

export type WasteReasonCode =
    | 'spillage'
    | 'expiry'
    | 'kitchen_error'
    | 'courtesy'
    | 'theft'
    | 'broken'
    | 'end_of_day'
    | 'other';

export const WASTE_REASONS: { code: WasteReasonCode; label: string; icon: string; color: string }[] = [
    { code: 'spillage', label: 'Derrame', icon: '💧', color: 'bg-blue-500' },
    { code: 'expiry', label: 'Caducidad', icon: '📅', color: 'bg-amber-500' },
    { code: 'kitchen_error', label: 'Error Cocina', icon: '🍳', color: 'bg-red-500' },
    { code: 'courtesy', label: 'Cortesía', icon: '🎁', color: 'bg-purple-500' },
    { code: 'theft', label: 'Robo', icon: '🚨', color: 'bg-rose-600' },
    { code: 'broken', label: 'Rotura', icon: '💥', color: 'bg-orange-500' },
    { code: 'end_of_day', label: 'Fin de día', icon: '🌙', color: 'bg-indigo-500' },
    { code: 'other', label: 'Otro', icon: '📋', color: 'bg-gray-500' },
];

export interface WasteEntryPayload {
    item_id: string;
    location_id: string;
    reason: WasteReasonCode;
    quantity: number; // Always positive — function makes it negative
    unit_cost?: number;
    notes?: string;
}

/**
 * Unified waste entry hook.
 *
 * Writes to BOTH waste_events (for dashboard analytics) and
 * stock_movements (for inventory adjustment) in a single mutation.
 * This ensures both systems stay in sync.
 */
export function useWasteEntry() {
    const { group } = useApp();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const logWaste = useMutation({
        mutationFn: async (entry: WasteEntryPayload) => {
            if (!group?.id) throw new Error('No group');

            // Get unit cost from item if not provided
            let unitCost = entry.unit_cost;
            if (unitCost === undefined) {
                const { data: item } = await supabase
                    .from('inventory_items')
                    .select('last_cost')
                    .eq('id', entry.item_id)
                    .single();
                unitCost = item?.last_cost ?? 0;
            }

            const wasteValue = Math.abs(entry.quantity) * unitCost;

            // 1. Insert into waste_events (source of truth for analytics)
            const { error: weError } = await supabase
                .from('waste_events')
                .insert({
                    org_id: group.id,
                    inventory_item_id: entry.item_id,
                    location_id: entry.location_id,
                    quantity: Math.abs(entry.quantity),
                    reason: entry.reason,
                    waste_value: wasteValue,
                    notes: entry.notes ?? null,
                    logged_by: user?.id ?? null,
                });

            if (weError) throw weError;

            // 2. Insert into stock_movements (for inventory adjustment)
            const { error: smError } = await supabase
                .from('stock_movements')
                .insert({
                    org_id: group.id,
                    item_id: entry.item_id,
                    location_id: entry.location_id,
                    movement_type: 'waste',
                    qty_delta: -Math.abs(entry.quantity), // Always negative
                    unit_cost: unitCost,
                    reason: entry.reason,
                    source_ref: entry.notes ?? null,
                    created_by: user?.id ?? null,
                });

            if (smError) {
                console.warn('[WasteEntry] stock_movements insert failed (non-blocking):', smError.message);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['waste'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
        },
    });

    return { logWaste };
}
