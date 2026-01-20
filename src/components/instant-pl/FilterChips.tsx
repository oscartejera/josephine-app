/**
 * FilterChips - Horizontal row of filter pills for Instant P&L
 */

import { cn } from '@/lib/utils';
import { ChipFilter } from '@/hooks/useInstantPLData';

interface ChipConfig {
  key: ChipFilter;
  label: string;
}

const CHIPS: ChipConfig[] = [
  { key: 'all_locations', label: 'All locations' },
  { key: 'profit_over_target', label: 'Profit over target' },
  { key: 'sales_above_forecast', label: 'Sales 10%+ above forecast' },
  { key: 'cogs_below_average', label: 'CoGS below average' },
  { key: 'under_planned_labour', label: 'Under planned labour' },
];

interface FilterChipsProps {
  counts: Record<ChipFilter, number>;
  activeChips: ChipFilter[];
  onChipToggle: (chip: ChipFilter) => void;
}

export function FilterChips({ counts, activeChips, onChipToggle }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-2">
      {CHIPS.map(chip => {
        const isActive = activeChips.includes(chip.key);
        const count = counts[chip.key] || 0;
        
        return (
          <button
            key={chip.key}
            onClick={() => onChipToggle(chip.key)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              "border hover:shadow-sm",
              isActive
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border/60 text-foreground/80 hover:border-border hover:bg-muted/50"
            )}
          >
            <span>{chip.label}</span>
            <span 
              className={cn(
                "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
