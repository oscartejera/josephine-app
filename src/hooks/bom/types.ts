// BOM types — shared between hooks and components

export interface Recipe {
    id: string;
    group_id: string;
    menu_item_name: string;
    selling_price: number | null;
    category: string;
    yield_qty: number;
    yield_unit: string;
    notes: string | null;
    is_sub_recipe: boolean;
    created_at: string;
}

export interface RecipeSummary extends Recipe {
    ingredient_count: number;
    food_cost: number;
    food_cost_pct: number;
}

export interface RecipeIngredient {
    // Composite PK: menu_item_id + inventory_item_id
    menu_item_id: string;
    inventory_item_id: string;
    sub_recipe_id: string | null;
    qty_base_units: number;
    qty_gross: number;
    qty_net: number;
    unit: string;
    yield_pct: number;
    sort_order: number;
    // Joined fields
    item_name?: string;
    item_unit?: string;
    last_cost?: number;
    sub_recipe_name?: string;
}

export interface RecipeWithIngredients extends Recipe {
    ingredients: RecipeIngredient[];
    food_cost: number;
    food_cost_pct: number;
}
