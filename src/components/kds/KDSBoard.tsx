import { KDSOrderCard } from './KDSOrderCard';
import { KDSKeyboardHints } from './KDSKeyboardHints';
import type { KDSOrder, KDSTicketLine } from '@/hooks/useKDSData';

interface KDSSelection {
  cardIndex: number;
  itemIndex: number;
}

interface KDSBoardProps {
  orders: KDSOrder[];
  onItemStatusChange: (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => void;
  onCompleteOrder: (ticketId: string) => void;
  getItemOverdueInfo?: (item: KDSTicketLine) => { isOverdue: boolean; isWarning: boolean; overdueMinutes: number; elapsedMinutes: number; threshold: number; progressPercent: number };
  selection?: KDSSelection;
  keyboardEnabled?: boolean;
}

export function KDSBoard({ 
  orders, 
  onItemStatusChange, 
  onCompleteOrder, 
  getItemOverdueInfo,
  selection,
  keyboardEnabled = false,
}: KDSBoardProps) {
  if (orders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">👨‍🍳</div>
          <h2 className="text-2xl font-bold text-zinc-400">Sin comandas pendientes</h2>
          <p className="text-zinc-500 mt-2">Las nuevas comandas aparecerán aquí automáticamente</p>
        </div>
        {keyboardEnabled && (
          <div className="mt-8">
            <KDSKeyboardHints />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-auto flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 flex-1">
        {orders.map((order, index) => (
          <KDSOrderCard
            key={order.ticketId}
            order={order}
            onItemStatusChange={onItemStatusChange}
            onCompleteOrder={onCompleteOrder}
            isNew={index === 0}
            getItemOverdueInfo={getItemOverdueInfo}
            isSelected={selection?.cardIndex === index}
            selectedItemIndex={selection?.cardIndex === index ? selection.itemIndex : undefined}
          />
        ))}
      </div>
      
      {/* Keyboard hints at bottom */}
      {keyboardEnabled && (
        <div className="mt-4 flex justify-center">
          <KDSKeyboardHints compact />
        </div>
      )}
    </div>
  );
}
