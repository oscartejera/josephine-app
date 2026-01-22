import { KDSExpeditorCard } from './KDSExpeditorCard';
import type { KDSOrder } from '@/hooks/useKDSData';

interface KDSExpeditorBoardProps {
  orders: KDSOrder[];
  onServeItem: (lineId: string) => void;
  onServeAll: (ticketId: string) => void;
}

export function KDSExpeditorBoard({ orders, onServeItem, onServeAll }: KDSExpeditorBoardProps) {
  // Filter to only orders with ready items
  const ordersWithReadyItems = orders.filter(
    order => order.items.some(item => item.prep_status === 'ready')
  );

  if (ordersWithReadyItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-zinc-400">Sin items pendientes de servir</h2>
          <p className="text-zinc-500 mt-2">Los items listos aparecerán aquí automáticamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ordersWithReadyItems.map((order) => (
          <KDSExpeditorCard
            key={order.ticketId}
            order={order}
            onServeItem={onServeItem}
            onServeAll={onServeAll}
          />
        ))}
      </div>
    </div>
  );
}
