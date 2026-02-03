/**
 * KDSMonitor Page
 * Página principal de KDS con monitores configurables estilo Ágora
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useKDSMonitor } from '@/hooks/useKDSMonitor';
import { cn } from '@/lib/utils';
import { Clock, Filter, History, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  KDSMonitorSelector,
  KDSFilterPanel,
  KDSClassicView,
  KDSMixedView,
  KDSRowsInteractiveView,
} from '@/components/kds';

export default function KDSMonitor() {
  const { locationId } = useParams<{ locationId: string }>();
  const { locations } = useApp();
  const location = locations.find(l => l.id === locationId);

  const {
    monitors,
    activeMonitor,
    setActiveMonitorId,
    orders,
    closedOrders,
    productAggregations,
    loading,
    isConnected,
    showHistory,
    setShowHistory,
    startLine,
    finishLine,
    serveLine,
    startAllInCourse,
    finishAllInCourse,
    serveAllInCourse,
    marchCourse,
    unmarchCourse,
    refetch,
  } = useKDSMonitor(locationId || '');

  const [showFilters, setShowFilters] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Filter orders by selected products
  const filteredOrders = useMemo(() => {
    if (selectedProducts.size === 0) return orders;

    return orders
      .map(order => ({
        ...order,
        orders: order.orders.map(courseOrder => ({
          ...courseOrder,
          items: courseOrder.items.filter(item =>
            selectedProducts.has(item.item_name)
          ),
        })).filter(co => co.items.length > 0),
      }))
      .filter(order => order.orders.length > 0);
  }, [orders, selectedProducts]);

  const displayOrders = showHistory ? closedOrders : filteredOrders;

  const handleToggleProduct = (productName: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSelectedProducts(new Set());
  };

  if (!locationId || !location) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Local no encontrado</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (monitors.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-2xl font-bold text-white mb-2">No hay monitores configurados</h2>
          <p className="text-zinc-400 mb-4">
            Configura monitores KDS para este local en la sección de configuración
          </p>
          <Button onClick={() => window.location.href = '/kds/settings'}>
            Ir a Configuración
          </Button>
        </div>
      </div>
    );
  }

  if (!activeMonitor) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Selecciona un monitor</p>
      </div>
    );
  }

  // Render view based on monitor configuration
  const renderView = () => {
    const viewProps = {
      orders: displayOrders,
      showStartBtn: activeMonitor.show_start_btn,
      showFinishBtn: activeMonitor.show_finish_btn,
      showServeBtn: activeMonitor.show_serve_btn,
      onStartLine: startLine,
      onFinishLine: finishLine,
      onServeLine: serveLine,
      onStartCourse: startAllInCourse,
      onFinishCourse: finishAllInCourse,
      onServeCourse: serveAllInCourse,
      onMarchCourse: marchCourse,
      onUnmarchCourse: unmarchCourse,
    };

    switch (activeMonitor.view_mode) {
      case 'rows_interactive':
        return (
          <KDSRowsInteractiveView
            {...viewProps}
            rowsCount={activeMonitor.rows_count}
            newestSide={activeMonitor.newest_side}
          />
        );
      case 'mixed':
        return (
          <KDSMixedView
            {...viewProps}
            rowsCount={activeMonitor.rows_count}
            newestSide={activeMonitor.newest_side}
          />
        );
      case 'classic':
      default:
        return <KDSClassicView {...viewProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <KDSMonitorSelector
              monitors={monitors}
              activeMonitorId={activeMonitor.id}
              onSelectMonitor={setActiveMonitorId}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm">Conectado</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm">Desconectado</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{displayOrders.length} comandas</span>
            </div>

            {/* History button */}
            <Button
              variant={showHistory ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                showHistory && 'bg-purple-600 hover:bg-purple-700'
              )}
            >
              <History className="h-4 w-4 mr-2" />
              {showHistory ? 'Ocultar Historial' : 'Ver Historial'}
            </Button>

            {/* Filters button */}
            {!showHistory && (
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  showFilters && 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {selectedProducts.size > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {selectedProducts.size}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* View */}
        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>

        {/* Filter panel */}
        {showFilters && !showHistory && (
          <KDSFilterPanel
            products={productAggregations}
            selectedProducts={selectedProducts}
            onToggleProduct={handleToggleProduct}
            onClearFilters={handleClearFilters}
          />
        )}
      </div>
    </div>
  );
}
