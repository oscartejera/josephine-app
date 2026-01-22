import { KDSOrderCard } from './KDSOrderCard';
import type { KDSOrder, KDSTicketLine } from '@/hooks/useKDSData';

interface KDSBoardProps {
  orders: KDSOrder[];
  onItemStatusChange: (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => void;
  onCompleteOrder: (ticketId: string) => void;
  getItemOverdueInfo?: (item: KDSTicketLine) => { isOverdue: boolean; overdueMinutes: number; threshold: number };
}

export function KDSBoard({ orders, onItemStatusChange, onCompleteOrder, getItemOverdueInfo }: KDSBoardProps) {
  if (orders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">👨‍🍳</div>
          <h2 className="text-2xl font-bold text-zinc-400">Sin comandas pendientes</h2>
          <p className="text-zinc-500 mt-2">Las nuevas comandas aparecerán aquí automáticamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {orders.map((order, index) => (
          <KDSOrderCard
            key={order.ticketId}
            order={order}
            onItemStatusChange={onItemStatusChange}
            onCompleteOrder={onCompleteOrder}
            isNew={index === 0}
            getItemOverdueInfo={getItemOverdueInfo}
          />
        ))}
      </div>
    </div>
  );
}
