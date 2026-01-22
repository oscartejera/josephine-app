import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useKDSData } from '@/hooks/useKDSData';
import { KDSHeader, KDSBoard } from '@/components/kds';

export default function KDS() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const { locations } = useApp();
  
  const location = locations.find(l => l.id === locationId);
  const { 
    orders, 
    loading, 
    isConnected, 
    updateItemStatus, 
    completeOrder 
  } = useKDSData(locationId || '');

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

  // Calculate stats
  const pendingCount = orders.reduce(
    (acc, order) => acc + order.items.filter(i => i.prep_status === 'pending').length, 
    0
  );
  const preparingCount = orders.reduce(
    (acc, order) => acc + order.items.filter(i => i.prep_status === 'preparing').length, 
    0
  );

  const handleItemStatusChange = async (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => {
    await updateItemStatus(lineId, newStatus);
  };

  const handleCompleteOrder = async (ticketId: string) => {
    await completeOrder(ticketId);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <KDSHeader 
        locationName={location.name}
        isConnected={isConnected}
        pendingCount={pendingCount}
        preparingCount={preparingCount}
      />
      
      <KDSBoard 
        orders={orders}
        onItemStatusChange={handleItemStatusChange}
        onCompleteOrder={handleCompleteOrder}
      />
    </div>
  );
}
