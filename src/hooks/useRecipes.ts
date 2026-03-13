import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE } from '@/data/cache-config';
import { useApp } from '@/contexts/AppContext';
import type { RecipeSummary } from './bom/types';

const RECIPES_KEY = ['recipes'];

export function useRecipes() {
    const { group } = useApp();
    const queryClient = useQueryClient();

    const recipesQuery = useQuery({
        queryKey: RECIPES_KEY,
        queryFn: async (): Promise<RecipeSummary[]> => {
            if (!group?.id) return [];

            // Fetch recipes (no PostgREST join — ingredients are in menu_items domain)
            const { data, error } = await supabase
                .from('recipes')
                .select(`
          id, group_id, menu_item_name, selling_price, category,
          yield_qty, yield_unit, notes, is_sub_recipe, created_at
        `)
                .eq('group_id', group.id)
                .order('menu_item_name');

            if (error) throw error;

            // Enrich with food cost + ingredient count via bridging RPCs
            const recipes: RecipeSummary[] = await Promise.all(
                (data || []).map(async (r: any) => {
                    let foodCost = 0;
                    let ingredientCount = 0;
                    try {
                        const [costRes, countRes] = await Promise.all([
                            supabase.rpc('get_recipe_food_cost', { p_recipe_id: r.id }),
                            supabase.rpc('get_recipe_ingredient_count', { p_recipe_id: r.id }),
                        ]);
                        foodCost = costRes.data ?? 0;
                        ingredientCount = countRes.data ?? 0;
                    } catch {
                        // RPCs may not be available
                    }
                    const sellingPrice = r.selling_price ?? 0;
                    return {
                        id: r.id,
                        group_id: r.group_id,
                        menu_item_name: r.menu_item_name,
                        selling_price: r.selling_price,
                        category: r.category ?? 'Main',
                        yield_qty: r.yield_qty ?? 1,
                        yield_unit: r.yield_unit ?? 'portion',
                        notes: r.notes,
                        is_sub_recipe: r.is_sub_recipe ?? false,
                        created_at: r.created_at,
                        ingredient_count: ingredientCount,
                        food_cost: foodCost,
                        food_cost_pct: sellingPrice > 0 ? Math.round((foodCost / sellingPrice) * 1000) / 10 : 0,
                    };
                })
            );

            return recipes;
        },
        enabled: !!group?.id,
        ...CACHE.CONFIG,
    });

    const createRecipe = useMutation({
        mutationFn: async (recipe: {
            menu_item_name: string;
            selling_price?: number;
            category?: string;
            yield_qty?: number;
            yield_unit?: string;
            is_sub_recipe?: boolean;
            notes?: string;
        }) => {
            if (!group?.id) throw new Error('No group');
            const { data, error } = await supabase
                .from('recipes')
                .insert({
                    group_id: group.id,
                    menu_item_name: recipe.menu_item_name,
                    selling_price: recipe.selling_price ?? null,
                    category: recipe.category ?? 'Main',
                    yield_qty: recipe.yield_qty ?? 1,
                    yield_unit: recipe.yield_unit ?? 'portion',
                    is_sub_recipe: recipe.is_sub_recipe ?? false,
                    notes: recipe.notes ?? null,
                })
                .select('id')
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPES_KEY }),
    });

    const updateRecipe = useMutation({
        mutationFn: async ({ id, ...updates }: { id: string } & Partial<{
            menu_item_name: string;
            selling_price: number | null;
            category: string;
            yield_qty: number;
            yield_unit: string;
            is_sub_recipe: boolean;
            notes: string | null;
        }>) => {
            const { error } = await supabase
                .from('recipes')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPES_KEY }),
    });

    const deleteRecipe = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('recipes')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: RECIPES_KEY }),
    });

    return {
        recipes: recipesQuery.data ?? [],
        isLoading: recipesQuery.isLoading,
        error: recipesQuery.error,
        createRecipe,
        updateRecipe,
        deleteRecipe,
    };
}
