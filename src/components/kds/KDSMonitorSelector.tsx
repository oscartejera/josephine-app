/**
 * KDS Monitor Selector
 * Selector de monitor activo estilo Ágora
 */

import { Monitor } from 'lucide-react';
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
  currentMonitor: KDSMonitor | null;
  onSelectMonitor: (monitorId: string) => void;
}

export function KDSMonitorSelector({
  monitors,
  currentMonitor,
  onSelectMonitor,
}: KDSMonitorSelectorProps) {
  if (monitors.length === 0) {
    return null;
  }

  if (monitors.length === 1) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg">
        <Monitor className="h-4 w-4 text-zinc-400" />
        <span className="text-sm text-zinc-200">{monitors[0].name}</span>
        <Badge variant="secondary" className="text-xs">
          {monitors[0].type}
        </Badge>
      </div>
    );
  }

  return (
    <Select
      value={currentMonitor?.id || ''}
      onValueChange={onSelectMonitor}
    >
      <SelectTrigger className="w-[280px] bg-zinc-800 border-zinc-700 text-zinc-200">
        <Monitor className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Selecciona monitor" />
      </SelectTrigger>
      <SelectContent>
        {monitors.map((monitor) => (
          <SelectItem key={monitor.id} value={monitor.id}>
            <div className="flex items-center gap-2">
              <span>{monitor.name}</span>
              <Badge variant="outline" className="text-xs">
                {monitor.type}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
