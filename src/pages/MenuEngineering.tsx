import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, RefreshCw, ChefHat, SlidersHorizontal } from 'lucide-react';
import { useMenuEngineeringData } from '@/hooks/useMenuEngineeringData';
import { type DateMode, type DateRangeValue, type ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import {
  MenuEngineeringHeader,
  MenuEngineeringKPICards,
  MenuEngineeringMatrix,
  MenuEngineeringActions,
  MenuEngineeringTable,
  DynamicPricingPanel,
  WhatIfSimulator,
} from '@/components/menu-engineering';
import { SetupBanner } from '@/components/menu-engineering/SetupBanner';

export default function MenuEngineering() {
  const {
    items,
    stats,
    categories: meCategories,
    itemsByClassification,
    loading: meLoading,
    error: meError,
    selectedLocationId,
    setSelectedLocationId,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    selectedCategory,
    setSelectedCategory,
    popularityMode,
    setPopularityMode,
    refetch: meRefetch,
    saveAction,
    accessibleLocations,
  } = useMenuEngineeringData();



  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [activeTab, setActiveTab] = useState('menu-engineering');

  // Sync filters
  const handleDateChange = (range: DateRangeValue, mode: DateMode, _granularity: ChartGranularity) => {
    setDateFrom(range.from);
    setDateTo(range.to);
    setDateMode(mode);
  };

  const handleLocationChange = (id: string | null) => {
    setSelectedLocationId(id);
  };

  const handleCategoryChange = (cat: string | null) => {
    setSelectedCategory(cat);
  };

  const handleRefresh = () => {
    meRefetch();
  };

  const allCategories = meCategories;

  const loading = meLoading;
  const error = meError;
  const showEmptyState = !loading && !error && items.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <MenuEngineeringHeader
        selectedLocationId={selectedLocationId}
        onLocationChange={handleLocationChange}
        dateRange={{ from: dateFrom, to: dateTo }}
        dateMode={dateMode}
        onDateChange={handleDateChange}
        onDateModeChange={setDateMode}
        categories={allCategories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        onRefresh={handleRefresh}
        loading={loading}
        accessibleLocations={accessibleLocations}
      />

      {/* Setup completeness banner */}
      <SetupBanner />

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No data for this period</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              No product sales found in the selected date range. Try expanding the
              period or selecting a different location.
            </p>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main content — Two Tabs */}
      {!error && !showEmptyState && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-lg">
            <TabsTrigger value="menu-engineering" className="gap-2">
              <ChefHat className="h-4 w-4" />
              Menu Engineering
            </TabsTrigger>
            <TabsTrigger value="simulator" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              What-If Simulator
            </TabsTrigger>
          </TabsList>

          {/* ═══════ TAB 1: MENU ENGINEERING ═══════ */}
          <TabsContent value="menu-engineering" className="space-y-6 mt-0">
            {/* KPI Cards */}
            <MenuEngineeringKPICards stats={stats} loading={meLoading} />

            {/* Matrix + Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MenuEngineeringMatrix
                  items={items}
                  stats={stats}
                  loading={meLoading}
                />
              </div>
              <div className="lg:col-span-1">
                <MenuEngineeringActions
                  itemsByClassification={itemsByClassification}
                  loading={meLoading}
                  onSaveAction={saveAction}
                />
              </div>
            </div>

            {/* AI Pricing Advisor */}
            <DynamicPricingPanel
              items={items}
              stats={stats}
              locationName={
                selectedLocationId
                  ? accessibleLocations.find((l) => l.id === selectedLocationId)?.name || 'Location'
                  : 'All locations'
              }
              categoryName={selectedCategory || undefined}
            />

            {/* Products Table */}
            <MenuEngineeringTable items={items} loading={meLoading} />

            {/* Methodology Explainer */}
            <Card className="bg-muted/30 border-muted">
              <CardContent className="py-4">
                <h4 className="text-sm font-semibold mb-2">📊 How Josephine Classifies — Kasavana & Smith (1982)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">Popularity</p>
                    <p>popularity_pct = units sold / category total × 100</p>
                    <p>Threshold = (100 / N) × 70% (70% rule)</p>
                    <p>High if popularity_pct ≥ threshold</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Profitability</p>
                    <p>Unit GP = price ex VAT − food cost</p>
                    <p>Avg GP = Σ(GP × units) / Σ(units) within category</p>
                    <p>High if unit GP ≥ avg GP</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Quadrant</p>
                    <p>⭐ Star = High pop + High GP</p>
                    <p>🐴 Plow Horse = High pop + Low GP</p>
                    <p>💎 Puzzle = Low pop + High GP</p>
                    <p>🔍 Dog = Low pop + Low GP</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">⚠️ Important</p>
                    <p>Per-category analysis only</p>
                    <p>Prices normalized ex-VAT (10%)</p>
                    <p>Decision support tool, not absolute truth</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          {/* ═══════ TAB 3: WHAT-IF SIMULATOR ═══════ */}
          <TabsContent value="simulator" className="space-y-6 mt-0">
            <WhatIfSimulator
              items={items}
              stats={stats}
              loading={meLoading}
            />
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}
