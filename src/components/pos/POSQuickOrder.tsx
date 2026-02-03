/**
 * POSQuickOrder Component
 * Quick order mode without table assignment
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { POSProduct, CashSession } from '@/hooks/usePOSData';

interface POSQuickOrderProps {
  locationId: string;
  products: POSProduct[];
  cashSession: CashSession | null;
  onRefresh: () => void;
}

interface CartItem {
  product: POSProduct;
  quantity: number;
}

export function POSQuickOrder({
  locationId,
  products,
  cashSession,
  onRefresh,
}: POSQuickOrderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const addToCart = (product: POSProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="h-full flex">
      {/* Products section */}
      <div className="flex-1 flex flex-col border-r">
        {/* Search and categories */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={!selectedCategory ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(null)}
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="p-3 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => addToCart(product)}
              >
                <div className="text-sm font-medium line-clamp-2">{product.name}</div>
                <div className="text-lg font-bold mt-1">€{product.price.toFixed(2)}</div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart section */}
      <div className="w-80 flex flex-col bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Pedido Rápido</h3>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Añade productos al pedido
              </p>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      €{item.product.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="w-16 text-right font-medium">
                    €{(item.product.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-3">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>€{total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={cart.length === 0} className="gap-2">
              <Banknote className="h-4 w-4" />
              Efectivo
            </Button>
            <Button disabled={cart.length === 0} className="gap-2">
              <CreditCard className="h-4 w-4" />
              Tarjeta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
