import { useState, useMemo } from 'react';
import { POSProduct } from '@/hooks/usePOSData';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';

// Import product images
import aguaMineral from '@/assets/products/agua-mineral.jpg';
import bacalao from '@/assets/products/bacalao.jpg';
import cafeConLeche from '@/assets/products/cafe-con-leche.jpg';
import calamares from '@/assets/products/calamares.jpg';
import cerveza from '@/assets/products/cerveza.jpg';
import chuleta from '@/assets/products/chuleta.jpg';
import cocaCola from '@/assets/products/coca-cola.jpg';
import coulant from '@/assets/products/coulant.jpg';
import cremaCatalana from '@/assets/products/crema-catalana.jpg';
import croquetasJamon from '@/assets/products/croquetas-jamon.jpg';
import ensaladaCesar from '@/assets/products/ensalada-cesar.jpg';
import gambasAjillo from '@/assets/products/gambas-ajillo.jpg';
import gazpacho from '@/assets/products/gazpacho.jpg';
import jamonIberico from '@/assets/products/jamon-iberico.jpg';
import lubina from '@/assets/products/lubina.jpg';
import paella from '@/assets/products/paella.jpg';
import patatasBravas from '@/assets/products/patatas-bravas.jpg';
import pimientosPadron from '@/assets/products/pimientos-padron.jpg';
import pulpoGallega from '@/assets/products/pulpo-gallega.jpg';
import sangria from '@/assets/products/sangria.jpg';
import tartaQueso from '@/assets/products/tarta-queso.jpg';
import tiramisu from '@/assets/products/tiramisu.jpg';
import tortillaEspanola from '@/assets/products/tortilla-espanola.jpg';
import vinoTinto from '@/assets/products/vino-tinto.jpg';

// Map image paths to imported images
const imageMap: Record<string, string> = {
  '/src/assets/products/agua-mineral.jpg': aguaMineral,
  '/src/assets/products/bacalao.jpg': bacalao,
  '/src/assets/products/cafe-con-leche.jpg': cafeConLeche,
  '/src/assets/products/calamares.jpg': calamares,
  '/src/assets/products/cerveza.jpg': cerveza,
  '/src/assets/products/chuleta.jpg': chuleta,
  '/src/assets/products/coca-cola.jpg': cocaCola,
  '/src/assets/products/coulant.jpg': coulant,
  '/src/assets/products/crema-catalana.jpg': cremaCatalana,
  '/src/assets/products/croquetas-jamon.jpg': croquetasJamon,
  '/src/assets/products/ensalada-cesar.jpg': ensaladaCesar,
  '/src/assets/products/gambas-ajillo.jpg': gambasAjillo,
  '/src/assets/products/gazpacho.jpg': gazpacho,
  '/src/assets/products/jamon-iberico.jpg': jamonIberico,
  '/src/assets/products/lubina.jpg': lubina,
  '/src/assets/products/paella.jpg': paella,
  '/src/assets/products/patatas-bravas.jpg': patatasBravas,
  '/src/assets/products/pimientos-padron.jpg': pimientosPadron,
  '/src/assets/products/pulpo-gallega.jpg': pulpoGallega,
  '/src/assets/products/sangria.jpg': sangria,
  '/src/assets/products/tarta-queso.jpg': tartaQueso,
  '/src/assets/products/tiramisu.jpg': tiramisu,
  '/src/assets/products/tortilla-espanola.jpg': tortillaEspanola,
  '/src/assets/products/vino-tinto.jpg': vinoTinto,
};

function getProductImage(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  // Check if it's a local path that needs mapping
  if (imageMap[imageUrl]) {
    return imageMap[imageUrl];
  }
  // Otherwise return as-is (for external URLs)
  return imageUrl;
}

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
          {filteredProducts.map((product) => {
            const imageSrc = getProductImage(product.image_url);
            
            return (
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
                  {imageSrc ? (
                    <img 
                      src={imageSrc} 
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
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
