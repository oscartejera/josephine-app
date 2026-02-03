/**
 * KDS Monitor Page - Ágora Implementation
 * Página KDS completa usando servicios Ágora
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useKDSDataV2 } from '@/hooks/useKDSDataV2';
import { KDSHeader } from '@/components/kds/KDSHeader';
import { KDSMonitorSelector } from '@/components/kds/KDSMonitorSelector';
import { KDSProductsSidebar } from '@/components/kds/KDSProductsSidebar';
import { KDSBoard } from '@/components/kds/KDSBoard';
import { KDSMarchBadge } from '@/components/kds/KDSMarchBadge';
import { Button } from '@/components/ui/button';
import { Settings, History, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function KDSMonitor() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const { locations } = useApp();
  const [showSidebar, setShowSidebar] = useState(true);
  
  const location = locations.find(l => l.id === locationId);
  
  const {
    monitors,
    currentMonitor,
    orders,
    closedOrders,
    productAggregation,
    loading,
    showHistory,
    setShowHistory,
    selectMonitor,
    startItem,
    finishItem,
    serveItem,
    marchOrder,
    unmarchOrder,
    refetch,
  } = useKDSDataV2(locationId || '');

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

  const ordersToDisplay = showHistory ? closedOrders : orders;

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-100">{location.name}</h1>
              <p className="text-sm text-zinc-400">
                {currentMonitor?.name || 'KDS'} • {orders.length} comandas activas
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Monitor Selector */}
              {monitors.length > 0 && (
                <KDSMonitorSelector
                  monitors={monitors}
                  currentMonitor={currentMonitor}
                  onSelectMonitor={selectMonitor}
                />
              )}

              {/* Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              >
                <History className="h-4 w-4 mr-2" />
                {showHistory ? 'Activas' : 'Historial'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              >
                <List className="h-4 w-4 mr-2" />
                Productos
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/kds/settings')}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              >
                <Settings className="h-4 w-4 mr-2" />
                Config
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-zinc-400">Pendientes:</span>
              <span className="text-zinc-100 font-bold">
                {orders.reduce((sum, o) => 
                  sum + o.orders.reduce((s, co) => 
                    s + co.items.filter(i => i.prep_status === 'pending').length, 0
                  ), 0
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-zinc-400">En preparación:</span>
              <span className="text-zinc-100 font-bold">
                {orders.reduce((sum, o) => 
                  sum + o.orders.reduce((s, co) => 
                    s + co.items.filter(i => i.prep_status === 'preparing').length, 0
                  ), 0
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-zinc-400">Listos:</span>
              <span className="text-zinc-100 font-bold">
                {orders.reduce((sum, o) => 
                  sum + o.orders.reduce((s, co) => 
                    s + co.items.filter(i => i.prep_status === 'ready').length, 0
                  ), 0
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="flex-1 overflow-auto p-6">
          {ordersToDisplay.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-zinc-400 text-lg mb-2">
                  {showHistory ? 'Sin comandas en historial' : 'Sin comandas pendientes'}
                </p>
                <p className="text-zinc-500 text-sm">
                  Las nuevas comandas aparecerán aquí automáticamente
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ordersToDisplay.map((order) => (
                <div key={order.ticket_id} className="space-y-3">
                  {order.orders.map((courseOrder) => (
                    <div key={`${order.ticket_id}-${courseOrder.course}`}>
                      {/* March Badge */}
                      {courseOrder.is_marched && (
                        <KDSMarchBadge
                          isMarched={true}
                          course={courseOrder.course}
                          className="mb-2"
                        />
                      )}

                      {/* Order Card */}
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-zinc-100">
                              {order.table_name || 'Sin mesa'}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {order.covers} pax • {new Date(order.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          
                          {/* Course Badge */}
                          <div className="text-xs bg-zinc-800 px-2 py-1 rounded">
                            {courseOrder.course === 0 ? '🍹 Bebidas' :
                             courseOrder.course === 1 ? '🥗 1º' :
                             courseOrder.course === 2 ? '🍖 2º' : '🍰 Postre'}
                          </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                          {courseOrder.items.map((item) => (
                            <div
                              key={item.id}
                              className="bg-zinc-800 rounded px-3 py-2 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-200 font-medium">
                                  {item.quantity}x {item.item_name}
                                </span>
                                {item.is_rush && (
                                  <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">
                                    RUSH
                                  </span>
                                )}
                              </div>

                              {/* Modifiers */}
                              {item.modifiers.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {item.modifiers.map((mod, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded"
                                    >
                                      {mod.option_name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Notes */}
                              {item.notes && (
                                <p className="text-xs text-amber-400">⚠️ {item.notes}</p>
                              )}

                              {/* Status */}
                              <div className="text-xs text-zinc-500">
                                {item.prep_status === 'pending' && '⏳ Pendiente'}
                                {item.prep_status === 'preparing' && '👨‍🍳 Preparando'}
                                {item.prep_status === 'ready' && '✅ Listo'}
                                {item.prep_status === 'served' && '🍽️ Servido'}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        {currentMonitor && (
                          <div className="flex gap-2 pt-2 border-t border-zinc-800">
                            {currentMonitor.show_start_btn && 
                             courseOrder.items.some(i => i.prep_status === 'pending') && (
                              <Button
                                size="sm"
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                onClick={() => {
                                  const pendingIds = courseOrder.items
                                    .filter(i => i.prep_status === 'pending')
                                    .map(i => i.id);
                                  pendingIds.forEach(id => startItem(id));
                                }}
                              >
                                ▶ Start
                              </Button>
                            )}

                            {currentMonitor.show_finish_btn && 
                             courseOrder.items.some(i => i.prep_status === 'preparing') && (
                              <Button
                                size="sm"
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => {
                                  const preparingIds = courseOrder.items
                                    .filter(i => i.prep_status === 'preparing')
                                    .map(i => i.id);
                                  preparingIds.forEach(id => finishItem(id));
                                }}
                              >
                                ✓ Finish
                              </Button>
                            )}

                            {currentMonitor.show_serve_btn && 
                             courseOrder.items.some(i => i.prep_status === 'ready') && (
                              <Button
                                size="sm"
                                className="flex-1 bg-purple-600 hover:bg-purple-700"
                                onClick={() => {
                                  const readyIds = courseOrder.items
                                    .filter(i => i.prep_status === 'ready')
                                    .map(i => i.id);
                                  readyIds.forEach(id => serveItem(id));
                                }}
                              >
                                🍽️ Serve
                              </Button>
                            )}

                            {/* March toggle */}
                            {!showHistory && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={courseOrder.is_marched 
                                  ? 'bg-orange-500 text-white border-orange-600' 
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                                }
                                onClick={() => {
                                  if (courseOrder.is_marched) {
                                    unmarchOrder(order.ticket_id, courseOrder.course);
                                  } else {
                                    marchOrder(order.ticket_id, courseOrder.course);
                                  }
                                }}
                              >
                                🔥
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Product Aggregation */}
      {showSidebar && (
        <KDSProductsSidebar products={productAggregation} />
      )}
    </div>
  );
}
