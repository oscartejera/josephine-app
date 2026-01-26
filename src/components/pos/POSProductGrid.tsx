import { useState, useMemo } from 'react';
import { POSProduct } from '@/hooks/usePOSData';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';

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

      {/* Products Grid - Large touch-friendly cards with images */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className={cn(
                "p-3 rounded-xl border-2 border-border bg-card",
                "hover:bg-accent hover:border-primary/50",
                "transition-all duration-150 flex flex-col items-center gap-2",
                "active:scale-95 active:bg-primary/10",
                "min-h-[140px]"
              )}
            >
              {/* Product Image - Much larger */}
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex items-center justify-center shrink-0 shadow-sm">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              
              {/* Product Name - Larger and bolder */}
              <span className="text-sm font-semibold line-clamp-2 text-center leading-tight">
                {product.name}
              </span>
              
              {/* Price - Larger and more prominent */}
              <span className="text-base font-bold text-primary">
                €{product.price.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
