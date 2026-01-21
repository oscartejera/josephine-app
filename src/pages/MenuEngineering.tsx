import { 
  MenuEngineeringHeader,
  MenuEngineeringKPICards,
  MenuEngineeringMatrix,
  MenuEngineeringRecommendations,
  MenuEngineeringTable
} from '@/components/menu-engineering';
import { useMenuEngineeringData } from '@/hooks/useMenuEngineeringData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw } from 'lucide-react';

export default function MenuEngineering() {
  const {
    items,
    scatterItems,
    stats,
    categories,
    recommendations,
    loading,
    error,
    selectedLocationId,
    setSelectedLocationId,
    datePreset,
    setDatePreset,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    selectedCategory,
    setSelectedCategory,
    includeLowData,
    setIncludeLowData,
    usePerCategoryThresholds,
    setUsePerCategoryThresholds,
    refetch,
  } = useMenuEngineeringData();

  // Empty state when no data
  const showEmptyState = !loading && items.length === 0 && !error;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with filters */}
      <MenuEngineeringHeader
        selectedLocationId={selectedLocationId}
        onLocationChange={setSelectedLocationId}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        customDateFrom={customDateFrom}
        customDateTo={customDateTo}
        onCustomDateFromChange={setCustomDateFrom}
        onCustomDateToChange={setCustomDateTo}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        includeLowData={includeLowData}
        onIncludeLowDataChange={setIncludeLowData}
        usePerCategoryThresholds={usePerCategoryThresholds}
        onPerCategoryThresholdsChange={setUsePerCategoryThresholds}
        onRefresh={refetch}
        loading={loading}
      />

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p className="font-medium">Error al cargar datos</p>
              <p className="text-sm mt-1">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={refetch}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No hay datos de ventas</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                No se encontraron datos de ventas de productos para el rango de fechas y ubicación seleccionados.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content */}
      {!showEmptyState && !error && (
        <>
          {/* KPI Cards */}
          <MenuEngineeringKPICards stats={stats} loading={loading} />

          {/* Matrix and Recommendations */}
          <div className="grid lg:grid-cols-2 gap-6">
            <MenuEngineeringMatrix 
              items={scatterItems} 
              stats={stats} 
              loading={loading} 
            />
            <MenuEngineeringRecommendations 
              recommendations={recommendations} 
              loading={loading} 
            />
          </div>

          {/* Products Table */}
          <MenuEngineeringTable items={items} loading={loading} />
        </>
      )}
    </div>
  );
}
