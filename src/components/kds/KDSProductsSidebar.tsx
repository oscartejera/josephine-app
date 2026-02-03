/**
 * KDS Products Sidebar
 * Panel lateral con agregación de productos y filtros
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';
import type { ProductAggregation } from '@/services/kds/types';

interface KDSProductsSidebarProps {
  products: ProductAggregation[];
  onFilter?: (productName: string) => void;
}

export function KDSProductsSidebar({ products, onFilter }: KDSProductsSidebarProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Productos Activos
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {products.map((product) => (
            <Card
              key={product.product_name}
              className="p-3 bg-zinc-800 border-zinc-700 hover:bg-zinc-750 cursor-pointer transition-colors"
              onClick={() => onFilter?.(product.product_name)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200 truncate">
                    {product.product_name}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {product.total_quantity}
                  </Badge>
                </div>

                <div className="flex gap-2 text-xs">
                  {product.pending_quantity > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500">
                      {product.pending_quantity} pend.
                    </Badge>
                  )}
                  {product.preparing_quantity > 0 && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500">
                      {product.preparing_quantity} prep.
                    </Badge>
                  )}
                  {product.ready_quantity > 0 && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500">
                      {product.ready_quantity} listo
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
