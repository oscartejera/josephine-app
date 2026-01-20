import { useEffect } from 'react';
import { useProcurementData } from '@/hooks/useProcurementData';
import {
  ProcurementHeader,
  SupplierHeader,
  IngredientList,
  OrderSummaryPanel,
  CoverageBanner,
} from '@/components/procurement';

export default function Procurement() {
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
    cart,
    updateCartItem,
    clearCart,
    autofillCart,
    getRecommendedPacks,
    orderSummary,
    searchQuery,
    setSearchQuery,
  } = useProcurementData();

  // Auto-fill on first load
  useEffect(() => {
    if (cart.size === 0) {
      autofillCart();
    }
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <ProcurementHeader
        suppliers={suppliers}
        selectedSupplierId={selectedSupplierId}
        onSupplierChange={setSelectedSupplierId}
      />

      {/* Supplier Header with search & date */}
      <SupplierHeader
        supplier={selectedSupplier}
        deliveryDaysLabel={deliveryDaysLabel}
        orderDate={orderDate}
        onDateChange={setOrderDate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cutoffInfo={cutoffInfo}
      />

      {/* Coverage Banner */}
      <CoverageBanner
        coverageEndDate={orderSummary.coverageEndDate}
        hasItems={orderSummary.items.length > 0}
      />

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: Ingredient List */}
        <div className="min-w-0">
          <IngredientList
            skus={filteredSkus}
            categories={categories}
            cart={cart}
            dayLabels={dayLabels}
            getRecommendedPacks={getRecommendedPacks}
            onUpdatePacks={updateCartItem}
          />
        </div>

        {/* Right: Order Summary (sticky) */}
        <div className="hidden lg:block">
          <OrderSummaryPanel
            summary={orderSummary}
            onAutofill={autofillCart}
            onClearCart={clearCart}
          />
        </div>
      </div>

      {/* Mobile sticky cart button */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
        <OrderSummaryPanel
          summary={orderSummary}
          onAutofill={autofillCart}
          onClearCart={clearCart}
        />
      </div>
    </div>
  );
}
