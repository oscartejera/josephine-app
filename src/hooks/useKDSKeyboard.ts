import { useState, useEffect, useCallback, useRef } from 'react';
import type { KDSOrder, KDSTicketLine } from './useKDSData';

interface KDSSelection {
  cardIndex: number;
  itemIndex: number;
}

interface RecallItem {
  lineId: string;
  previousStatus: 'pending' | 'preparing' | 'ready';
  newStatus: 'preparing' | 'ready' | 'served';
  timestamp: number;
  itemName: string;
  tableName: string | null;
}

interface UseKDSKeyboardOptions {
  orders: KDSOrder[];
  onItemStatusChange: (lineId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served') => void;
  onCompleteOrder: (ticketId: string) => void;
  enabled?: boolean;
}

export function useKDSKeyboard({
  orders,
  onItemStatusChange,
  onCompleteOrder,
  enabled = true,
}: UseKDSKeyboardOptions) {
  const [selection, setSelection] = useState<KDSSelection>({ cardIndex: 0, itemIndex: 0 });
  const [recallStack, setRecallStack] = useState<RecallItem[]>([]);
  const recallTimeoutRef = useRef<number | null>(null);

  // Get active items (pending or preparing) for a given order
  const getActiveItems = useCallback((order: KDSOrder) => {
    return order.items.filter(
      item => item.prep_status === 'pending' || item.prep_status === 'preparing'
    );
  }, []);

  // Clear old recall items (older than 60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecallStack(prev => prev.filter(item => now - item.timestamp < 60000));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Bump current item (advance status)
  const bumpItem = useCallback(() => {
    if (orders.length === 0) return;

    const currentOrder = orders[selection.cardIndex];
    if (!currentOrder) return;

    const activeItems = getActiveItems(currentOrder);
    const currentItem = activeItems[selection.itemIndex];
    if (!currentItem) return;

    const previousStatus = currentItem.prep_status as 'pending' | 'preparing';
    const newStatus = previousStatus === 'pending' ? 'preparing' : 'ready';

    // Add to recall stack
    setRecallStack(prev => [
      {
        lineId: currentItem.id,
        previousStatus,
        newStatus,
        timestamp: Date.now(),
        itemName: currentItem.item_name,
        tableName: currentOrder.tableName,
      },
      ...prev.slice(0, 9), // Keep max 10 items
    ]);

    onItemStatusChange(currentItem.id, newStatus);

    // If item was moved to ready, move selection to next item
    if (newStatus === 'ready') {
      const remainingItems = activeItems.length - 1;
      if (remainingItems > 0 && selection.itemIndex >= remainingItems) {
        setSelection(prev => ({ ...prev, itemIndex: Math.max(0, remainingItems - 1) }));
      }
    }
  }, [orders, selection, getActiveItems, onItemStatusChange]);

  // Bump all items in current order
  const bumpAll = useCallback(() => {
    if (orders.length === 0) return;

    const currentOrder = orders[selection.cardIndex];
    if (!currentOrder) return;

    onCompleteOrder(currentOrder.ticketId);

    // Move to next card if available
    if (selection.cardIndex < orders.length - 1) {
      setSelection({ cardIndex: selection.cardIndex, itemIndex: 0 });
    } else if (orders.length > 1) {
      setSelection({ cardIndex: Math.max(0, selection.cardIndex - 1), itemIndex: 0 });
    }
  }, [orders, selection, onCompleteOrder]);

  // Recall last bump
  const recall = useCallback(() => {
    if (recallStack.length === 0) return;

    const lastBump = recallStack[0];
    onItemStatusChange(lastBump.lineId, lastBump.previousStatus);
    setRecallStack(prev => prev.slice(1));
  }, [recallStack, onItemStatusChange]);

  // Clear recall stack
  const clearRecall = useCallback(() => {
    setRecallStack([]);
  }, []);

  // Navigate between cards
  const navigateCard = useCallback((direction: 'left' | 'right') => {
    if (orders.length === 0) return;

    setSelection(prev => {
      const newCardIndex = direction === 'left'
        ? Math.max(0, prev.cardIndex - 1)
        : Math.min(orders.length - 1, prev.cardIndex + 1);
      return { cardIndex: newCardIndex, itemIndex: 0 };
    });
  }, [orders.length]);

  // Navigate between items within a card
  const navigateItem = useCallback((direction: 'up' | 'down') => {
    if (orders.length === 0) return;

    const currentOrder = orders[selection.cardIndex];
    if (!currentOrder) return;

    const activeItems = getActiveItems(currentOrder);
    if (activeItems.length === 0) return;

    setSelection(prev => {
      const newItemIndex = direction === 'up'
        ? Math.max(0, prev.itemIndex - 1)
        : Math.min(activeItems.length - 1, prev.itemIndex + 1);
      return { ...prev, itemIndex: newItemIndex };
    });
  }, [orders, selection.cardIndex, getActiveItems]);

  // Keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          bumpItem();
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          bumpAll();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          recall();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigateCard('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateCard('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigateItem('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigateItem('down');
          break;
        case 'Escape':
          e.preventDefault();
          clearRecall();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, bumpItem, bumpAll, recall, navigateCard, navigateItem, clearRecall]);

  // Ensure selection stays valid when orders change
  useEffect(() => {
    if (orders.length === 0) {
      setSelection({ cardIndex: 0, itemIndex: 0 });
      return;
    }

    setSelection(prev => {
      const validCardIndex = Math.min(prev.cardIndex, orders.length - 1);
      const currentOrder = orders[validCardIndex];
      const activeItems = currentOrder ? getActiveItems(currentOrder) : [];
      const validItemIndex = Math.min(prev.itemIndex, Math.max(0, activeItems.length - 1));
      return { cardIndex: validCardIndex, itemIndex: validItemIndex };
    });
  }, [orders, getActiveItems]);

  return {
    selection,
    setSelection,
    recallStack,
    bumpItem,
    bumpAll,
    recall,
    clearRecall,
    navigateCard,
    navigateItem,
  };
}
