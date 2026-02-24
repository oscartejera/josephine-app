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

export function useWasteEntry() {
    const { group } = useApp();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const logWaste = useMutation({
        mutationFn: async (entry: WasteEntryPayload) => {
            if (!group?.id) throw new Error('No group');

            // Get unit cost and unit from item if not provided
            let unitCost = entry.unit_cost;
            let itemUnit = 'ud';
            const { data: item } = await supabase
                .from('inventory_items')
                .select('last_cost, unit')
                .eq('id', entry.item_id)
                .single();
            if (unitCost === undefined) {
                unitCost = item?.last_cost ?? 0;
            }
            itemUnit = item?.unit ?? 'ud';

            // Build notes: combine reason label + user notes
            const reasonLabel = WASTE_REASONS.find(r => r.code === entry.reason)?.label ?? entry.reason;
            const notesText = entry.notes
                ? `${reasonLabel}: ${entry.notes}`
                : reasonLabel;

            // Insert into stock_movements (production schema)
            const { error } = await supabase
                .from('stock_movements')
                .insert({
                    item_id: entry.item_id,
                    location_id: entry.location_id,
                    movement_type: 'waste',
                    quantity: -Math.abs(entry.quantity), // Always negative for waste
                    unit: itemUnit,
                    cost: unitCost,
                    notes: notesText,
                } as any);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['waste'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
        },
    });

    return { logWaste };
}
