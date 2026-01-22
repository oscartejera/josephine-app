import { useState, useMemo } from 'react';
import { POSProduct } from '@/hooks/usePOSData';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface POSProductGridProps {
  products: POSProduct[];
  onProductClick: (product: POSProduct) => void;
}

export function POSProductGrid({ products, onProductClick }: POSProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || 'Otros'));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter(p => (p.category || 'Otros') === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div className="h-full flex flex-col">
      {/* Category Tabs */}
      <ScrollArea className="shrink-0">
        <div className="flex gap-1 p-2 border-b border-border">
          <Button
            variant={selectedCategory === null ? "secondary" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() => setSelectedCategory(null)}
          >
            Todo
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "secondary" : "ghost"}
              size="sm"
              className="shrink-0"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </ScrollArea>

      {/* Products Grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-3 gap-2 p-2">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className={cn(
                "p-2 rounded-lg border border-border bg-background hover:bg-accent",
                "transition-colors text-left flex flex-col justify-between",
                "min-h-[60px] active:scale-95"
              )}
            >
              <span className="text-xs font-medium line-clamp-2">{product.name}</span>
              <span className="text-xs text-primary font-bold mt-1">
                €{product.price.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
