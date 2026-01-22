import { Undo2, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RecallItem {
  lineId: string;
  previousStatus: 'pending' | 'preparing' | 'ready';
  newStatus: 'preparing' | 'ready' | 'served';
  timestamp: number;
  itemName: string;
  tableName: string | null;
}

interface KDSRecallPanelProps {
  recallStack: RecallItem[];
  onRecall: () => void;
  onClear: () => void;
}

export function KDSRecallPanel({ recallStack, onRecall, onClear }: KDSRecallPanelProps) {
  if (recallStack.length === 0) return null;

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 10) return 'ahora';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-white">
              Recall ({recallStack.length})
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-zinc-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main recall button */}
        <button
          onClick={onRecall}
          className="w-full px-3 py-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors"
        >
          <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Undo2 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white truncate">
              {recallStack[0].itemName}
            </p>
            <p className="text-xs text-zinc-400">
              {recallStack[0].tableName || 'Sin mesa'} · {getTimeAgo(recallStack[0].timestamp)}
            </p>
          </div>
          <kbd className="px-2 py-1 text-xs font-mono bg-zinc-700 rounded text-zinc-300">
            R
          </kbd>
        </button>

        {/* Additional items preview */}
        {recallStack.length > 1 && (
          <div className="px-3 py-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              +{recallStack.length - 1} más en cola
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
