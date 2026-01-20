import { IngredientRow } from './IngredientRow';
import type { IngredientSku } from '@/hooks/useProcurementData';

interface IngredientListProps {
  skus: IngredientSku[];
  categories: string[];
  cart: Map<string, number>;
  dayLabels: string[];
  getRecommendedPacks: (sku: IngredientSku) => number;
  onUpdatePacks: (skuId: string, packs: number) => void;
}

export function IngredientList({
  skus,
  categories,
  cart,
  dayLabels,
  getRecommendedPacks,
  onUpdatePacks,
}: IngredientListProps) {
  if (skus.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-muted-foreground">No ingredients found matching your search.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map(category => {
        const categorySkus = skus.filter(s => s.category === category);
        if (categorySkus.length === 0) return null;

        return (
          <div key={category} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <h3 className="font-semibold text-foreground">{category}</h3>
              <p className="text-xs text-muted-foreground">{categorySkus.length} items</p>
            </div>
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
              {categorySkus.map(sku => (
                <IngredientRow
                  key={sku.id}
                  sku={sku}
                  packs={cart.get(sku.id) || 0}
                  recommendedPacks={getRecommendedPacks(sku)}
                  dayLabels={dayLabels}
                  onUpdatePacks={onUpdatePacks}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
