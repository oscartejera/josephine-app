import { cn } from '@/lib/utils';

export type KDSViewMode = 'kitchen' | 'expeditor';

interface KDSViewToggleProps {
  mode: KDSViewMode;
  onChange: (mode: KDSViewMode) => void;
  kitchenCount: number;
  expeditorCount: number;
}

export function KDSViewToggle({ mode, onChange, kitchenCount, expeditorCount }: KDSViewToggleProps) {
  return (
    <div className="flex bg-zinc-800 rounded-lg p-1">
      <button
        onClick={() => onChange('kitchen')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all text-sm",
          mode === 'kitchen'
            ? "bg-emerald-600 text-white shadow"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        <span>👨‍🍳</span>
        <span>Cocina</span>
        {kitchenCount > 0 && (
          <span className={cn(
            "min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold",
            mode === 'kitchen' ? "bg-white/20" : "bg-zinc-700"
          )}>
            {kitchenCount}
          </span>
        )}
      </button>
      
      <button
        onClick={() => onChange('expeditor')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all text-sm",
          mode === 'expeditor'
            ? "bg-amber-600 text-white shadow"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        <span>🔔</span>
        <span>Expedidor</span>
        {expeditorCount > 0 && (
          <span className={cn(
            "min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold animate-pulse",
            mode === 'expeditor' ? "bg-white/20" : "bg-amber-600/50"
          )}>
            {expeditorCount}
          </span>
        )}
      </button>
    </div>
  );
}
