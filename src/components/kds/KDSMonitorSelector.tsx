/**
 * KDSMonitorSelector Component
 * Selector de monitor activo para KDS
 */

import { Monitor, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { KDSMonitor } from '@/services/kds/types';

interface KDSMonitorSelectorProps {
  monitors: KDSMonitor[];
  activeMonitorId: string | null;
  onSelectMonitor: (monitorId: string) => void;
}

export function KDSMonitorSelector({
  monitors,
  activeMonitorId,
  onSelectMonitor,
}: KDSMonitorSelectorProps) {
  const activeMonitor = monitors.find(m => m.id === activeMonitorId);

  if (monitors.length === 0) {
    return (
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <Monitor className="h-4 w-4" />
        <span>No hay monitores configurados</span>
      </div>
    );
  }

  if (monitors.length === 1) {
    // If only one monitor, just display it
    return (
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-zinc-400" />
        <div className="flex flex-col">
          <span className="font-medium text-sm">{monitors[0].name}</span>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {getTypeLabel(monitors[0].type)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {getViewModeLabel(monitors[0].view_mode)}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Monitor className="h-4 w-4 text-zinc-400" />
      <Select value={activeMonitorId || undefined} onValueChange={onSelectMonitor}>
        <SelectTrigger className="w-[280px] bg-zinc-900 border-zinc-800 text-sm">
          <SelectValue>
            {activeMonitor ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{activeMonitor.name}</span>
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel(activeMonitor.type)}
                </Badge>
              </div>
            ) : (
              'Seleccionar monitor'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-800">
          {monitors.map(monitor => (
            <SelectItem
              key={monitor.id}
              value={monitor.id}
              className="cursor-pointer hover:bg-zinc-800"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{monitor.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {getTypeLabel(monitor.type)}
                  </Badge>
                </div>
                <span className="text-xs text-zinc-500">
                  {monitor.destinations.join(', ')} • {getViewModeLabel(monitor.view_mode)}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    restaurant: 'Restaurant',
    fast_food: 'Fast Food',
    expeditor: 'Pase',
    customer_display: 'Cliente',
  };
  return labels[type] || type;
}

function getViewModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    classic: 'Clásico',
    rows_interactive: 'Rows',
    mixed: 'Mixto',
  };
  return labels[mode] || mode;
}
