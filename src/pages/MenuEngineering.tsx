import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, RefreshCw, ChefHat, DollarSign } from 'lucide-react';
import { useMenuEngineeringData } from '@/hooks/useMenuEngineeringData';
import { usePricingOmnesData } from '@/hooks/usePricingOmnesData';
import { type DateMode, type DateRangeValue, type ChartGranularity } from '@/components/bi/DateRangePickerNoryLike';
import {
  MenuEngineeringHeader,
  MenuEngineeringKPICards,
  MenuEngineeringMatrix,
  MenuEngineeringActions,
  MenuEngineeringTable,
  DynamicPricingPanel,
} from '@/components/menu-engineering';
import {
  PricingHealthCards,
  PricingBandChart,
  PricingOmnesTable,
} from '@/components/pricing-omnes';

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

  const omnes = usePricingOmnesData();

  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [activeTab, setActiveTab] = useState('menu-engineering');

  // Sync filters between engines
  const handleDateChange = (range: DateRangeValue, mode: DateMode, _granularity: ChartGranularity) => {
    setDateFrom(range.from);
    setDateTo(range.to);
    setDateMode(mode);
    omnes.setDateFrom(range.from);
    omnes.setDateTo(range.to);
  };

  const handleLocationChange = (id: string | null) => {
    setSelectedLocationId(id);
    omnes.setSelectedLocationId(id);
  };

  const handleCategoryChange = (cat: string | null) => {
    setSelectedCategory(cat);
    omnes.setSelectedCategory(cat);
  };

  const handleRefresh = () => {
    meRefetch();
    omnes.refetch();
  };

  // Merge categories from both engines
  const allCategories = [...new Set([...meCategories, ...omnes.categories])].sort();

  const loading = meLoading || omnes.loading;
  const error = meError || omnes.error;
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

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={handleRefresh}>
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
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
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
              Ingeniería de Menú
            </TabsTrigger>
            <TabsTrigger value="pricing-omnes" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Análisis de Precios
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

            {/* Dynamic Pricing AI (ME-driven suggestions, NOT OMNES) */}
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
            <MenuEngineeringTable items={items} loading={meLoading} />

            {/* Methodology Explainer */}
            <Card className="bg-muted/30 border-muted">
              <CardContent className="py-4">
                <h4 className="text-sm font-semibold mb-2">📊 Cómo clasifica Josephine — Kasavana & Smith (1982)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">Popularidad</p>
                    <p>popularity_pct = unidades vendidas / total categoría × 100</p>
                    <p>Umbral = (100 / N) × 70% (regla del 70%)</p>
                    <p>Alta si popularity_pct ≥ umbral</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Rentabilidad</p>
                    <p>GP unitario = precio sin IVA − coste materia</p>
                    <p>Media GP = Σ(GP × uds) / Σ(uds) de la categoría</p>
                    <p>Alta si GP unitario ≥ media GP</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Cuadrante</p>
                    <p>⭐ Estrella = Pop alta + GP alto</p>
                    <p>🐴 Caballo = Pop alta + GP bajo</p>
                    <p>💎 Joya = Pop baja + GP alto</p>
                    <p>🔍 Revisar = Pop baja + GP bajo</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">⚠️ Importante</p>
                    <p>Análisis por categoría individual</p>
                    <p>Precios normalizados ex-IVA (10%)</p>
                    <p>Herramienta de soporte, no verdad absoluta</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ TAB 2: PRICING / OMNES ═══════ */}
          <TabsContent value="pricing-omnes" className="space-y-6 mt-0">
            {!selectedCategory && (
              <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="py-6 text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-amber-500 mb-3" />
                  <h3 className="text-base font-semibold mb-1">Selecciona una categoría</h3>
                  <p className="text-sm text-muted-foreground">
                    El análisis OMNES se aplica a una categoría individual. Selecciona una en el filtro superior.
                  </p>
                </CardContent>
              </Card>
            )}

            {selectedCategory && (
              <>
                {/* OMNES Health Cards */}
                <PricingHealthCards
                  result={omnes.result}
                  topActions={omnes.topActions}
                  loading={omnes.loading}
                />

                {/* Band Distribution Chart */}
                <PricingBandChart
                  result={omnes.result}
                  loading={omnes.loading}
                />

                {/* OMNES Table */}
                <PricingOmnesTable
                  result={omnes.result}
                  loading={omnes.loading}
                />

                {/* OMNES Methodology Explainer */}
                <Card className="bg-muted/30 border-muted">
                  <CardContent className="py-4">
                    <h4 className="text-sm font-semibold mb-2">💰 Cómo analiza Josephine los Precios — Método OMNES</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground mb-1">OMNES 1: Ratio de Precios</p>
                        <p>ratio = precio máximo / precio mínimo</p>
                        <p>&lt; 2.5 = demasiado estrecho</p>
                        <p>2.5–3.0 = saludable</p>
                        <p>&gt; 3.0 = demasiado amplio</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">OMNES 2: Distribución por Bandas</p>
                        <p>3 bandas iguales: baja / media / alta</p>
                        <p>Ideal: 25% baja · 50% media · 25% alta</p>
                        <p>Promover productos de banda media</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">OMNES 3: Ratio de Categoría</p>
                        <p>ratio = ticket medio / precio medio carta</p>
                        <p>&lt; 0.90 = percepción de menú caro</p>
                        <p>0.90–1.00 = saludable</p>
                        <p>&gt; 1.00 = infraprecios</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">⚠️ Separación de motores</p>
                        <p>OMNES NO afecta la clasificación Estrella/Caballo/Joya/Revisar</p>
                        <p>OMNES analiza coherencia de precios</p>
                        <p>Menu Engineering analiza popularidad + rentabilidad</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
