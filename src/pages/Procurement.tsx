import { useEffect, useState } from 'react';
import { useProcurementData } from '@/hooks/useProcurementData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, History, ChevronRight, MoreHorizontal, Database, Loader2, Sparkles, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAIPredictiveOrdering, OrderGuide } from '@/hooks/useAIPredictiveOrdering';
import { useApp } from '@/contexts/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useTranslation } from 'react-i18next';

export default function Procurement() {
  const { t } = useTranslation();
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

  // AI Predictive Ordering — cross-supplier order guide from forecast
  const { selectedLocationId } = useApp();
  const aiLocationId = selectedLocationId !== 'all' ? selectedLocationId : null;
  const { orderGuide, loading: aiLoading, generateOrderGuide } = useAIPredictiveOrdering(aiLocationId);
  const [showAIGuide, setShowAIGuide] = useState(false);

  // Group AI guide items by supplier
  const aiGuideBySupplier = orderGuide?.items?.reduce((acc, item) => {
    const supplier = item.supplierName || 'Sin proveedor';
    if (!acc[supplier]) acc[supplier] = [];
    acc[supplier].push(item);
    return acc;
  }, {} as Record<string, typeof orderGuide.items>) || {};

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
            <h1 className="text-2xl font-display font-bold text-foreground">{t('procurement.procurement')}</h1>
            {isLoading ? (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('procurement.loadingInventory')}
              </Badge>
            {t('procurement.hasrealdata')}
              <Badge variant="outline" className="gap-1.5 text-success border-success/30 bg-success/5">
                <Database className="h-3 w-3" />
                {t('procurement.liveInventory')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5 text-xs">
                {t('procurement.demoData')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <span>{t('procurement.insights')}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{t('procurement.procurement1')}</span>
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

          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
            onClick={async () => {
              await generateOrderGuide(7);
              setShowAIGuide(true);
            }}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('procurement.generando')}
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                {t('procurement.pedidoAi')}
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.location.href = '/procurement/orders'}>
                {t('procurement.suppliersOrders')}
              </DropdownMenuItem>
              <DropdownMenuItem>{t('procurement.manageSuppliers')}</DropdownMenuItem>
              <DropdownMenuItem>{t('procurement.exportData')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-11">
          <TabsTrigger value="order" className="gap-2 px-6 h-9">
            <ShoppingCart className="h-4 w-4" />
            {t('procurement.newOrder')}
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
                    <p className="text-lg font-semibold">€{orderSummary.total.toFixed(2)}</p>
                  </div>
                  <Button
                    size="lg"
                    className="px-8"
                    onClick={() => window.location.href = '/procurement/cart'}
                    disabled={orderSummary.items.length === 0}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {t('procurement.viewCart')}
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

      {/* AI Order Guide Dialog */}
      <Dialog open={showAIGuide && !!orderGuide} onOpenChange={setShowAIGuide}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-500" />
              {t('procurement.pedidoAiGuiaDePedido')}
            </DialogTitle>
          </DialogHeader>

          {orderGuide && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Período: {orderGuide.forecastStartDate} — {orderGuide.forecastEndDate}</span>
                <Badge variant="outline" className="text-violet-600 border-violet-200">
                  Coste estimado: €{orderGuide.totalEstimatedCost.toFixed(2)}
                </Badge>
              </div>

              {Object.entries(aiGuideBySupplier).map(([supplier, items]) => (
                <div key={supplier} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                    <span className="font-medium text-sm">{supplier}</span>
                    <span className="text-xs text-muted-foreground">
                      {items.length} items · €{items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2)}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left p-2 pl-4">{t('procurement.producto')}</th>
                        <th className="text-right p-2">{t('procurement.necesario')}</th>
                        <th className="text-right p-2">{t('procurement.enStock')}</th>
                        <th className="text-right p-2">{t('procurement.pedir')}</th>
                        <th className="text-right p-2 pr-4">{t('procurement.coste')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.inventoryItemId} className="border-b last:border-b-0">
                          <td className="p-2 pl-4">
                            <span className="font-medium">{item.itemName}</span>
                            <span className="text-muted-foreground ml-1 text-xs">({item.unit})</span>
                          </td>
                          <td className="text-right p-2">{item.forecastNeedQty.toFixed(1)}</td>
                          <td className="text-right p-2 text-muted-foreground">{item.onHandQty.toFixed(1)}</td>
                          <td className="text-right p-2 font-medium text-violet-700">{item.orderQty.toFixed(1)}</td>
                          <td className="text-right p-2 pr-4">€{item.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAIGuide(false)}>
              {t('procurement.cerrar')}
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
              onClick={() => {
                // Pre-fill cart with AI-suggested items by using autofill
                clearCart();
                orderGuide?.items?.forEach(item => {
                  const sku = filteredSkus.find(s =>
                    s.name.toLowerCase().includes(item.itemName.toLowerCase().split(' ')[0])
                  );
                  if (sku) {
                    updateCartItem(sku.id, Math.ceil(item.orderQty));
                  }
                });
                setShowAIGuide(false);
                setActiveTab('order');
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              {t('procurement.anadirAlPedido')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
