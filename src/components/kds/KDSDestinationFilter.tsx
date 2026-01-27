import { cn } from '@/lib/utils';

export type KDSDestination = 'all' | 'kitchen' | 'bar';

interface KDSDestinationFilterProps {
  selected: KDSDestination;
  onChange: (destination: KDSDestination) => void;
  counts: {
    all: number;
    kitchen: number;
    bar: number;
  };
}

const destinations: { value: KDSDestination; label: string; icon: string }[] = [
  { value: 'all', label: 'Todo', icon: '📋' },
  { value: 'kitchen', label: 'Cocina', icon: '👨‍🍳' },
  { value: 'bar', label: 'Bar', icon: '🍺' },
];

export function KDSDestinationFilter({ selected, onChange, counts }: KDSDestinationFilterProps) {
  return (
    <div className="flex gap-2">
      {destinations.map((dest) => {
        const count = counts[dest.value];
        const isSelected = selected === dest.value;
        
        return (
          <button
            key={dest.value}
            onClick={() => onChange(dest.value)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
              "text-sm sm:text-base",
              isSelected
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            )}
          >
            <span>{dest.icon}</span>
            <span className="hidden sm:inline">{dest.label}</span>
            {count > 0 && (
              <span className={cn(
                "min-w-[24px] h-6 flex items-center justify-center rounded-full text-xs font-bold",
                isSelected ? "bg-white/20" : "bg-zinc-700"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
