/**
 * KDSFilterPanel Component
 * Panel lateral con agregación de productos y filtros
 */

import { useState } from 'react';
import { Filter, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProductAggregation } from '@/services/kds/types';

interface KDSFilterPanelProps {
  products: ProductAggregation[];
  selectedProducts: Set<string>;
  onToggleProduct: (productName: string) => void;
  onClearFilters: () => void;
}

export function KDSFilterPanel({
  products,
  selectedProducts,
  onToggleProduct,
  onClearFilters,
}: KDSFilterPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(p =>
    p.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasFilters = selectedProducts.size > 0;

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-zinc-400" />
            <h3 className="font-semibold text-white">Filtros</h3>
          </div>
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearFilters}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Search */}
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar producto..."
          className="bg-zinc-800 border-zinc-700"
        />
      </div>

      {/* Summary */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-800/50">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {products.reduce((sum, p) => sum + p.total_quantity, 0)}
            </div>
            <div className="text-xs text-zinc-400">Total Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {products.reduce((sum, p) => sum + p.pending_quantity + p.preparing_quantity, 0)}
            </div>
            <div className="text-xs text-zinc-400">Activos</div>
          </div>
        </div>
      </div>

      {/* Products list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {filteredProducts.map((product) => (
            <ProductFilterItem
              key={product.product_name}
              product={product}
              isSelected={selectedProducts.has(product.product_name)}
              onToggle={() => onToggleProduct(product.product_name)}
            />
          ))}

          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-zinc-500">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductFilterItemProps {
  product: ProductAggregation;
  isSelected: boolean;
  onToggle: () => void;
}

function ProductFilterItem({ product, isSelected, onToggle }: ProductFilterItemProps) {
  const activeCount = product.pending_quantity + product.preparing_quantity;

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full p-3 rounded-lg border-2 transition-all text-left',
        isSelected
          ? 'bg-emerald-500/20 border-emerald-500'
          : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm truncate">
            {product.product_name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {product.total_quantity} total
            </Badge>
            {activeCount > 0 && (
              <Badge className="bg-blue-500 text-xs">
                {activeCount} activo{activeCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="flex flex-col items-end gap-1 text-xs">
          {product.pending_quantity > 0 && (
            <div className="text-zinc-400">
              {product.pending_quantity} pendiente{product.pending_quantity > 1 ? 's' : ''}
            </div>
          )}
          {product.preparing_quantity > 0 && (
            <div className="text-blue-400">
              {product.preparing_quantity} preparando
            </div>
          )}
          {product.ready_quantity > 0 && (
            <div className="text-emerald-400">
              {product.ready_quantity} listo{product.ready_quantity > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
