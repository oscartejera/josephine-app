/**
 * EstimatedLabel — Shows "Estimado" badge with tooltip for KPIs
 * that depend on assumptions (COGS%, hourly rates, channel ratios).
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface EstimatedLabelProps {
  reason?: string;
  className?: string;
}

export function EstimatedLabel({ reason, className = '' }: EstimatedLabelProps) {
  const defaultReason = 'Este valor usa supuestos (COGS%, tarifas horarias, etc.) que pueden no reflejar tus costos reales.';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium ${className}`}>
            <Info className="h-3 w-3" />
            Estimado
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {reason || defaultReason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
