import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RecipeIngredient, RecipeWithIngredients } from './bom/types';

const recipeDetailKey = (id: string) => ['recipe', id];

export function useRecipeDetail(recipeId: string | null) {
    const queryClient = useQueryClient();
    const queryKey = recipeDetailKey(recipeId ?? '');

    const recipeQuery = useQuery({
        queryKey,
        queryFn: async (): Promise<RecipeWithIngredients | null> => {
            if (!recipeId) return null;

            // Fetch recipe
            const { data: recipe, error: recipeError } = await supabase
                .from('recipes')
                .select('*')
                .eq('id', recipeId)
                .single();
            if (recipeError) throw recipeError;

            // Fetch ingredients via bridging RPC (resolves recipes.id → menu_items.id)
            const { data: ingredients, error: ingError } = await supabase
                .rpc('get_recipe_ingredients', { p_recipe_id: recipeId });
            if (ingError) throw ingError;

            // Map RPC results to RecipeIngredient format
            const enriched: RecipeIngredient[] = (ingredients || []).map((ing: any) => ({
                menu_item_id: ing.menu_item_id,
                inventory_item_id: ing.inventory_item_id,
                sub_recipe_id: ing.sub_recipe_id,
                qty_base_units: ing.qty_base_units ?? 0,
                qty_gross: ing.qty_gross ?? ing.qty_base_units ?? 0,
                qty_net: ing.qty_net ?? ing.qty_base_units ?? 0,
                unit: ing.unit ?? 'kg',
                yield_pct: ing.yield_pct ?? 100,
                sort_order: ing.sort_order ?? 0,
                item_name: ing.item_name ?? '',
                item_unit: ing.item_unit ?? '',
                last_cost: ing.last_cost ?? 0,
                sub_recipe_name: '',
            }));

            // Calculate food cost
            const foodCost = enriched.reduce((sum, ing) => {
                return sum + ing.qty_gross * (ing.last_cost ?? 0);
            }, 0);

            const sellingPrice = recipe.selling_price ?? 0;
            const foodCostPct = sellingPrice > 0 ? Math.round((foodCost / sellingPrice) * 1000) / 10 : 0;

            return {
                id: recipe.id,
                group_id: recipe.group_id,
                menu_item_name: recipe.menu_item_name,
                selling_price: recipe.selling_price,
                category: recipe.category ?? 'Main',
                yield_qty: recipe.yield_qty ?? 1,
                yield_unit: recipe.yield_unit ?? 'portion',
                notes: recipe.notes,
                is_sub_recipe: recipe.is_sub_recipe ?? false,
                created_at: recipe.created_at,
                ingredients: enriched,
                food_cost: Math.round(foodCost * 100) / 100,
                food_cost_pct: foodCostPct,
            };
        },
        enabled: !!recipeId,
    });

    // Helper: resolve the actual menu_items.id from the recipes.id
    const resolveMenuItemId = async (rid: string): Promise<string> => {
        const { data } = await supabase.rpc('get_menu_item_id_for_recipe', { p_recipe_id: rid });
        if (data) return data;
        return rid; // fallback to recipe id (might be a menu_item_id already)
    };

    const addIngredient = useMutation({
        mutationFn: async (ingredient: {
            inventory_item_id: string;
            sub_recipe_id?: string;
            qty_gross: number;
            yield_pct?: number;
            unit?: string;
        }) => {
            if (!recipeId) throw new Error('No recipe');
            const menuItemId = await resolveMenuItemId(recipeId);
            const qtyNet = ingredient.qty_gross * ((ingredient.yield_pct ?? 100) / 100);
            const { error } = await supabase
                .from('recipe_ingredients')
                .insert({
                    menu_item_id: menuItemId,
                    inventory_item_id: ingredient.inventory_item_id,
                    sub_recipe_id: ingredient.sub_recipe_id ?? null,
                    qty_base_units: ingredient.qty_gross,
                    qty_gross: ingredient.qty_gross,
                    qty_net: qtyNet,
                    unit: ingredient.unit ?? 'kg',
                    yield_pct: ingredient.yield_pct ?? 100,
                    sort_order: 999,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    const updateIngredient = useMutation({
        mutationFn: async ({ inventoryItemId, ...updates }: {
            inventoryItemId: string;
            qty_gross?: number;
            yield_pct?: number;
            unit?: string;
        }) => {
            if (!recipeId) throw new Error('No recipe');
            const menuItemId = await resolveMenuItemId(recipeId);
            const payload: Record<string, any> = { ...updates };
            if (updates.qty_gross !== undefined) {
                payload.qty_base_units = updates.qty_gross;
                payload.qty_net = updates.qty_gross * ((updates.yield_pct ?? 100) / 100);
            }
            const { error } = await supabase
                .from('recipe_ingredients')
                .update(payload)
                .eq('menu_item_id', menuItemId)
                .eq('inventory_item_id', inventoryItemId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    const removeIngredient = useMutation({
        mutationFn: async (inventoryItemId: string) => {
            if (!recipeId) throw new Error('No recipe');
            const menuItemId = await resolveMenuItemId(recipeId);
            const { error } = await supabase
                .from('recipe_ingredients')
                .delete()
                .eq('menu_item_id', menuItemId)
                .eq('inventory_item_id', inventoryItemId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    return {
        recipe: recipeQuery.data ?? null,
        isLoading: recipeQuery.isLoading,
        error: recipeQuery.error,
        addIngredient,
        updateIngredient,
        removeIngredient,
    };
}
