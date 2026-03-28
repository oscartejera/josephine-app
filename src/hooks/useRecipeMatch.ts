import { useMemo } from 'react';
import { useRecipes } from './useRecipes';
import type { MenuEngineeringItem } from './useMenuEngineeringData';

export interface RecipeMatchResult {
  recipe_id: string;
  recipe_name: string;
  recipe_food_cost: number;
  recipe_food_cost_pct: number;
  ingredient_count: number;
  link: string;
}

/**
 * Normalize a string for fuzzy matching:
 * lowercase, remove accents, trim, collapse whitespace.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '')    // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance between two strings.
 * Returns edit distance (lower = more similar).
 */
function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= an; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bn; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return matrix[an][bn];
}

/**
 * Calculate similarity score between two normalized strings.
 * Returns a value between 0 and 1 (1 = exact match).
 *
 * Uses a multi-strategy approach:
 * 1. Exact match → 1.0
 * 2. One contains the other → 0.85
 * 3. Word overlap (Jaccard) → 0.5..0.8
 * 4. Levenshtein distance → 0.5..0.75 (catches abbreviations like "Hmb." ↔ "Hamburguesa")
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.85;

  // Word-level Jaccard similarity
  const wordsA = new Set(a.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 1));
  let jaccard = 0;
  if (wordsA.size > 0 && wordsB.size > 0) {
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    jaccard = union > 0 ? intersection / union : 0;
  }

  // Character-level Levenshtein similarity (normalized 0-1)
  const maxLen = Math.max(a.length, b.length);
  const lev = maxLen > 0 ? 1 - levenshtein(a, b) / maxLen : 0;
  // Scale Levenshtein to max 0.75 to avoid false positives on short strings
  const levScore = lev * 0.75;

  // Return the best score from either strategy
  return Math.max(jaccard, levScore);
}

const MATCH_THRESHOLD = 0.5;

/**
 * Hook that fuzzy-matches Menu Engineering items to Recipes (Escandallos).
 *
 * Returns a Map<product_id, RecipeMatchResult> for items that have a match,
 * and a method to get the link for unmatched items (generic recipes page).
 */
export function useRecipeMatch(items: MenuEngineeringItem[]) {
  const { recipes, isLoading: recipesLoading } = useRecipes();

  const matchMap = useMemo(() => {
    const map = new Map<string, RecipeMatchResult>();
    if (recipes.length === 0 || items.length === 0) return map;

    // Pre-normalize recipe names for fast lookup
    const normalizedRecipes = recipes.map(r => ({
      ...r,
      normalized: normalize(r.menu_item_name),
    }));

    for (const item of items) {
      const normalizedName = normalize(item.name);
      let bestMatch: (typeof normalizedRecipes)[0] | null = null;
      let bestScore = 0;

      for (const recipe of normalizedRecipes) {
        const score = similarity(normalizedName, recipe.normalized);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = recipe;
        }
      }

      if (bestMatch && bestScore >= MATCH_THRESHOLD) {
        map.set(item.product_id, {
          recipe_id: bestMatch.id,
          recipe_name: bestMatch.menu_item_name,
          recipe_food_cost: bestMatch.food_cost,
          recipe_food_cost_pct: bestMatch.food_cost_pct,
          ingredient_count: bestMatch.ingredient_count,
          link: `/inventory-setup/recipes/${bestMatch.id}`,
        });
      }
    }

    return map;
  }, [items, recipes]);

  /** Total items with recipe cost vs fallback */
  const stats = useMemo(() => {
    const withRecipe = items.filter(i => i.cost_source === 'recipe_actual').length;
    const withFallback = items.filter(i => i.cost_source === 'fallback_average').length;
    const withEstimated = items.filter(i => i.cost_source === 'recipe_estimated').length;
    const total = items.length;
    const coveragePct = total > 0 ? Math.round((withRecipe / total) * 100) : 0;
    return { withRecipe, withFallback, withEstimated, total, coveragePct };
  }, [items]);

  return {
    matchMap,
    stats,
    recipesLoading,
    /** Get link for a specific item (matched recipe or generic recipes page) */
    getRecipeLink: (productId: string) => {
      const match = matchMap.get(productId);
      return match ? match.link : '/inventory-setup/recipes';
    },
  };
}
