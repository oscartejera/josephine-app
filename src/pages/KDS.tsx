import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useKDSData } from '@/hooks/useKDSData';
import { 
  KDSHeader, 
  KDSBoard, 
  KDSDestinationFilter, 
  KDSViewToggle,
  KDSExpeditorBoard,
  type KDSDestination,
  type KDSViewMode 
} from '@/components/kds';

export default function KDS() {
  const { locationId } = useParams<{ locationId: string }>();
  const { locations } = useApp();
  const [selectedDestination, setSelectedDestination] = useState<KDSDestination>('all');
  const [viewMode, setViewMode] = useState<KDSViewMode>('kitchen');
  
  const location = locations.find(l => l.id === locationId);
  const { 
    orders, 
    loading, 
    isConnected, 
    updateItemStatus, 
    completeOrder 
  } = useKDSData(locationId || '');

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  
  // Filter orders by destination (for kitchen view)
  const filteredOrders = useMemo(() => {
    if (selectedDestination === 'all') return orders;
    
    return orders
      .map(order => ({
        ...order,
        items: order.items.filter(item => item.destination === selectedDestination)
      }))
      .filter(order => order.items.length > 0);
  }, [orders, selectedDestination]);

  // Calculate destination counts
  const destinationCounts = useMemo(() => {
    const counts = { all: 0, kitchen: 0, bar: 0, prep: 0 };
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.prep_status === 'pending' || item.prep_status === 'preparing') {
          counts.all++;
          counts[item.destination]++;
        }
      });
    });
    
    return counts;
  }, [orders]);

  // Calculate view mode counts
  const kitchenCount = useMemo(() => {
    return orders.reduce((acc, order) => 
      acc + order.items.filter(i => i.prep_status === 'pending' || i.prep_status === 'preparing').length, 
    0);
  }, [orders]);

  const expeditorCount = useMemo(() => {
    return orders.reduce((acc, order) => 
      acc + order.items.filter(i => i.prep_status === 'ready').length, 
    0);
  }, [orders]);

  // Calculate stats for filtered orders
  const pendingCount = filteredOrders.reduce(
    (acc, order) => acc + order.items.filter(i => i.prep_status === 'pending').length, 
    0
  );
  const preparingCount = filteredOrders.reduce(
    (acc, order) => acc + order.items.filter(i => i.prep_status === 'preparing').length, 
    0
  );

  // CONDITIONAL RETURNS AFTER ALL HOOKS
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

  const handleItemStatusChange = async (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => {
    await updateItemStatus(lineId, newStatus);
  };

  const handleCompleteOrder = async (ticketId: string) => {
    await completeOrder(ticketId);
  };

  const handleServeItem = async (lineId: string) => {
    await updateItemStatus(lineId, 'served');
  };

  const handleServeAll = async (ticketId: string) => {
    // Mark all ready items in the order as served
    const order = orders.find(o => o.ticketId === ticketId);
    if (order) {
      const readyItems = order.items.filter(i => i.prep_status === 'ready');
      await Promise.all(readyItems.map(item => updateItemStatus(item.id, 'served')));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <KDSHeader 
        locationName={location.name}
        isConnected={isConnected}
        pendingCount={viewMode === 'kitchen' ? pendingCount : expeditorCount}
        preparingCount={viewMode === 'kitchen' ? preparingCount : 0}
      />
      
      {/* View Mode Toggle + Destination Filter */}
      <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center gap-4">
        <KDSViewToggle
          mode={viewMode}
          onChange={setViewMode}
          kitchenCount={kitchenCount}
          expeditorCount={expeditorCount}
        />
        
        {viewMode === 'kitchen' && (
          <KDSDestinationFilter
            selected={selectedDestination}
            onChange={setSelectedDestination}
            counts={destinationCounts}
          />
        )}
      </div>
      
      {viewMode === 'kitchen' ? (
        <KDSBoard 
          orders={filteredOrders}
          onItemStatusChange={handleItemStatusChange}
          onCompleteOrder={handleCompleteOrder}
        />
      ) : (
        <KDSExpeditorBoard
          orders={orders}
          onServeItem={handleServeItem}
          onServeAll={handleServeAll}
        />
      )}
    </div>
  );
}
