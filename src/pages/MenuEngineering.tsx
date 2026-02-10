import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw } from 'lucide-react';
import { useMenuEngineeringData } from '@/hooks/useMenuEngineeringData';
import { type DateMode, type DateRangeValue, type ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import {
  MenuEngineeringHeader,
  MenuEngineeringKPICards,
  MenuEngineeringMatrix,
  MenuEngineeringActions,
  MenuEngineeringTable,
  DynamicPricingPanel,
} from '@/components/menu-engineering';

export default function MenuEngineering() {
  const {
    items,
    stats,
    categories,
    itemsByClassification,
    loading,
    error,
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
    refetch,
    saveAction,
    accessibleLocations,
  } = useMenuEngineeringData();

  const [dateMode, setDateMode] = useState<DateMode>('monthly');

  const handleDateChange = (range: DateRangeValue, mode: DateMode, _granularity: ChartGranularity) => {
    setDateFrom(range.from);
    setDateTo(range.to);
    setDateMode(mode);
  };

  const showEmptyState = !loading && !error && items.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <MenuEngineeringHeader
        selectedLocationId={selectedLocationId}
        onLocationChange={setSelectedLocationId}
        dateRange={{ from: dateFrom, to: dateTo }}
        dateMode={dateMode}
        onDateChange={handleDateChange}
        onDateModeChange={setDateMode}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onRefresh={refetch}
        loading={loading}
        accessibleLocations={accessibleLocations}
      />

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin datos en este periodo</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              No hay ventas de productos en el rango de fechas seleccionado. Prueba a ampliar el
              periodo o seleccionar otro local.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={refetch}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      {!error && !showEmptyState && (
        <>
          {/* KPI Cards */}
          <MenuEngineeringKPICards stats={stats} loading={loading} />

          {/* Matrix + Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MenuEngineeringMatrix
                items={items}
                stats={stats}
                loading={loading}
                popularityMode={popularityMode}
                onPopularityModeChange={setPopularityMode}
              />
            </div>
            <div className="lg:col-span-1">
              <MenuEngineeringActions
                itemsByClassification={itemsByClassification}
                loading={loading}
                onSaveAction={saveAction}
              />
            </div>
          </div>

          {/* Dynamic Pricing AI */}
          <DynamicPricingPanel
            items={items}
            stats={stats}
            locationName={
              selectedLocationId
                ? accessibleLocations.find((l) => l.id === selectedLocationId)?.name || 'Local'
                : 'Todos los locales'
            }
          />

          {/* Products Table */}
          <MenuEngineeringTable items={items} loading={loading} />
        </>
      )}
    </div>
  );
}
