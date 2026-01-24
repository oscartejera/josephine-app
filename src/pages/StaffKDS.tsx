import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { KDSBoard } from '@/components/kds/KDSBoard';
import { useKDSData } from '@/hooks/useKDSData';
import { Skeleton } from '@/components/ui/skeleton';

export default function StaffKDS() {
  const { locationId } = useParams<{ locationId: string }>();
  const { locations } = useApp();
  
  const location = locations.find(l => l.id === locationId);
  
  const { orders, loading, updateItemStatus, completeOrder } = useKDSData(locationId || '');

  if (!locationId) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-muted-foreground">Selecciona un local</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const handleItemStatusChange = (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => {
    updateItemStatus(lineId, newStatus);
  };

  const handleCompleteOrder = (ticketId: string) => {
    completeOrder(ticketId);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
      <div className="p-4 border-b border-border bg-card shrink-0">
        <h1 className="text-xl font-semibold">{location?.name || 'Cocina'}</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} comandas activas
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <KDSBoard
          orders={orders}
          onItemStatusChange={handleItemStatusChange}
          onCompleteOrder={handleCompleteOrder}
        />
      </div>
    </div>
  );
}
