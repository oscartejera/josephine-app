import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useKDSData } from '@/hooks/useKDSData';
import { useKDSAlerts } from '@/hooks/useKDSAlerts';
import { useKDSKeyboard } from '@/hooks/useKDSKeyboard';
import { useKDSKiosk } from '@/hooks/useKDSKiosk';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  KDSHeader, 
  KDSBoard, 
  KDSDestinationFilter, 
  KDSHistoryBoard,
  KDSStatsPanel,
  KDSAlertsPanel,
  KDSRecallPanel,
  type KDSDestination,
} from '@/components/kds';

export default function KDS() {
  const { locationId } = useParams<{ locationId: string }>();
  const { locations } = useApp();
  const [selectedDestination, setSelectedDestination] = useState<KDSDestination>('all');
  const [showStats, setShowStats] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  
  const location = locations.find(l => l.id === locationId);
  const { 
    orders, 
    loading, 
    isConnected, 
    updateItemStatus, 
    completeOrder,
    refetch
  } = useKDSData(locationId || '');

  // Use KDS alerts hook
  const {
    settings: alertSettings,
    updateSettings: updateAlertSettings,
    soundSettings,
    updateSoundSettings,
    testSound,
    alerts,
    alertCount,
    dismissAlert,
    dismissAllAlerts,
    getItemOverdueInfo,
  } = useKDSAlerts(orders);

  // Use Kiosk mode hook
  const {
    isFullscreen,
    toggleFullscreen,
  } = useKDSKiosk();

  // Filter orders by destination - only show orders with active items
  const filteredOrders = useMemo(() => {
    // First filter to only orders with pending/preparing items
    const ordersWithActiveItems = orders
      .map(order => ({
        ...order,
        items: order.items.filter(item => 
          item.prep_status === 'pending' || item.prep_status === 'preparing'
        )
      }))
      .filter(order => order.items.length > 0);

    if (selectedDestination === 'all') return ordersWithActiveItems;
    
    return ordersWithActiveItems
      .map(order => ({
        ...order,
        items: order.items.filter(item => item.destination === selectedDestination)
      }))
      .filter(order => order.items.length > 0);
  }, [orders, selectedDestination]);

  // Keyboard status change handler
  const handleKeyboardItemStatusChange = useCallback(async (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => {
    await updateItemStatus(lineId, newStatus);
  }, [updateItemStatus]);

  // Keyboard complete order handler
  const handleKeyboardCompleteOrder = useCallback(async (ticketId: string) => {
    await completeOrder(ticketId);
  }, [completeOrder]);

  // Use keyboard shortcuts hook
  const {
    selection,
    recallStack,
    recall,
    clearRecall,
  } = useKDSKeyboard({
    orders: filteredOrders,
    onItemStatusChange: handleKeyboardItemStatusChange,
    onCompleteOrder: handleKeyboardCompleteOrder,
    enabled: keyboardEnabled && !showHistory,
  });

  // Calculate destination counts (only pending/preparing items)
  const destinationCounts = useMemo(() => {
    const counts = { all: 0, kitchen: 0, bar: 0, prep: 0 };
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.prep_status === 'pending' || item.prep_status === 'preparing') {
          counts.all++;
          if (item.destination === 'kitchen') counts.kitchen++;
          if (item.destination === 'bar') counts.bar++;
          if (item.destination === 'prep') counts.prep++;
        }
      });
    });
    
    return counts;
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

  // Recover order handler - moves items back from served to pending
  const handleRecoverOrder = useCallback(async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('ticket_lines')
        .update({ 
          prep_status: 'pending',
          ready_at: null
        })
        .eq('ticket_id', ticketId)
        .eq('prep_status', 'served');

      if (error) throw error;

      toast.success('Comanda recuperada');
      refetch();
      setShowHistory(false);
    } catch (error) {
      console.error('Error recovering order:', error);
      toast.error('Error al recuperar comanda');
    }
  }, [refetch]);

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

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <KDSHeader 
        locationName={location.name}
        isConnected={isConnected}
        pendingCount={pendingCount}
        preparingCount={preparingCount}
        onShowStats={() => setShowStats(true)}
        onShowHistory={() => setShowHistory(prev => !prev)}
        showingHistory={showHistory}
        alertSettings={alertSettings}
        onUpdateAlertSettings={updateAlertSettings}
        soundSettings={soundSettings}
        onUpdateSoundSettings={updateSoundSettings}
        onTestSound={testSound}
        alertCount={alertCount}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        keyboardEnabled={keyboardEnabled}
        onToggleKeyboard={() => setKeyboardEnabled(prev => !prev)}
        locationId={locationId}
        onRefetch={refetch}
      />
      
      {/* Destination Filter - only show when not in history */}
      {!showHistory && (
        <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-4">
          <KDSDestinationFilter
            selected={selectedDestination}
            onChange={setSelectedDestination}
            counts={destinationCounts}
          />
        </div>
      )}
      
      {showHistory ? (
        <KDSHistoryBoard
          locationId={locationId}
          onRecoverOrder={handleRecoverOrder}
        />
      ) : (
        <KDSBoard 
          orders={filteredOrders}
          onItemStatusChange={handleItemStatusChange}
          onCompleteOrder={handleCompleteOrder}
          getItemOverdueInfo={getItemOverdueInfo}
          selection={keyboardEnabled ? selection : undefined}
          keyboardEnabled={keyboardEnabled}
        />
      )}

      {/* Stats Panel Overlay */}
      {showStats && locationId && (
        <KDSStatsPanel
          locationId={locationId}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* Alerts Panel */}
      {!showHistory && (
        <KDSAlertsPanel
          alerts={alerts}
          onDismiss={dismissAlert}
          onDismissAll={dismissAllAlerts}
        />
      )}

      {/* Recall Panel */}
      {keyboardEnabled && !showHistory && (
        <KDSRecallPanel
          recallStack={recallStack}
          onRecall={recall}
          onClear={clearRecall}
        />
      )}
    </div>
  );
}
