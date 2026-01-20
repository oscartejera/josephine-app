import { useEffect, useState } from 'react';
import { useProcurementData } from '@/hooks/useProcurementData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, History, ChevronRight, MoreHorizontal, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SupplierCard } from '@/components/procurement/SupplierCard';
import { IngredientTable } from '@/components/procurement/IngredientTable';
import { OrderSummaryDesktop } from '@/components/procurement/OrderSummaryDesktop';
import { CoverageBannerDesktop } from '@/components/procurement/CoverageBannerDesktop';
import { OrderHistoryPanel } from '@/components/procurement/OrderHistoryPanel';
import { AIRecommendPanel } from '@/components/procurement/AIRecommendPanel';
import { ProcurementSettingsDialog } from '@/components/procurement/ProcurementSettingsDialog';

export default function Procurement() {
  const [activeTab, setActiveTab] = useState('order');
  
  const {
    suppliers,
    selectedSupplier,
    selectedSupplierId,
    setSelectedSupplierId,
    filteredSkus,
    categories,
    orderDate,
    setOrderDate,
    cutoffInfo,
    deliveryDaysLabel,
    dayLabels,
    deliveryDate,
    cart,
    updateCartItem,
    clearCart,
    autofillCart,
    aiRecommend,
    getRecommendedPacks,
    getRecommendationBreakdown,
    orderSummary,
    searchQuery,
    setSearchQuery,
    isCalculating,
    recommendationSettings,
    setRecommendationSettings,
    categorySettings,
    setCategorySettings,
    isLoading,
    hasRealData,
  } = useProcurementData();

  // Check URL params for supplier
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const supplierParam = params.get('supplier');
    if (supplierParam && suppliers.some(s => s.id === supplierParam)) {
      setSelectedSupplierId(supplierParam);
    }
  }, []);

  const handleReorder = (items: { skuId: string; packs: number }[]) => {
    clearCart();
    items.forEach(item => {
      updateCartItem(item.skuId, item.packs);
    });
    setActiveTab('order');
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold text-foreground">Procurement</h1>
            {isLoading ? (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading inventory...
              </Badge>
            ) : hasRealData ? (
              <Badge variant="outline" className="gap-1.5 text-success border-success/30 bg-success/5">
                <Database className="h-3 w-3" />
                Live Inventory
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5 text-xs">
                Demo Data
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <span>Insights</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Procurement</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger className="w-[160px] bg-card h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {s.logo || s.name[0]}
                    </span>
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <ProcurementSettingsDialog
            categorySettings={categorySettings}
            onSettingsChange={setCategorySettings}
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.location.href = '/procurement/orders'}>
                Suppliers & Orders
              </DropdownMenuItem>
              <DropdownMenuItem>Manage Suppliers</DropdownMenuItem>
              <DropdownMenuItem>Export Data</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-11">
          <TabsTrigger value="order" className="gap-2 px-6 h-9">
            <ShoppingCart className="h-4 w-4" />
            New Order
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 px-6 h-9">
            <History className="h-4 w-4" />
            Order History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="order" className="mt-6 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-48 w-full rounded-xl" />
                </div>
                <Skeleton className="hidden xl:block h-[500px] w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <>
          {/* Supplier Card with search & date */}
          <SupplierCard
            supplier={selectedSupplier}
            deliveryDaysLabel={deliveryDaysLabel}
            orderDate={orderDate}
            onDateChange={setOrderDate}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cutoffInfo={cutoffInfo}
          />

          {/* AI Recommendation Panel */}
          <AIRecommendPanel
            settings={recommendationSettings}
            onSettingsChange={setRecommendationSettings}
            onRecommend={aiRecommend}
            isCalculating={isCalculating}
          />

          {/* Coverage Banner */}
          <CoverageBannerDesktop
            coverageEndDate={orderSummary.coverageEndDate}
            hasItems={orderSummary.items.length > 0}
            orderDate={orderDate}
            deliveryDate={deliveryDate}
          />

          {/* Main 2-column layout - 70/30 split */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            {/* Left: Ingredient Table */}
            <div className="min-w-0">
              <IngredientTable
                skus={filteredSkus}
                categories={categories}
                cart={cart}
                dayLabels={dayLabels}
                getRecommendedPacks={getRecommendedPacks}
                getRecommendationBreakdown={getRecommendationBreakdown}
                onUpdatePacks={updateCartItem}
              />
            </div>

            {/* Right: Order Summary (sticky) */}
            <div className="hidden xl:block">
              <OrderSummaryDesktop
                summary={orderSummary}
                onAutofill={autofillCart}
                onClearCart={clearCart}
              />
            </div>
          </div>

          {/* Mobile/Tablet sticky summary */}
          <div className="xl:hidden fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
            <div className="max-w-[800px] mx-auto flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{orderSummary.items.length} items</p>
                <p className="text-lg font-semibold">£{orderSummary.total.toFixed(2)}</p>
              </div>
              <Button 
                size="lg" 
                className="px-8"
                onClick={() => window.location.href = '/procurement/cart'}
                disabled={orderSummary.items.length === 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Cart
              </Button>
            </div>
          </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <OrderHistoryPanel onReorder={handleReorder} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
