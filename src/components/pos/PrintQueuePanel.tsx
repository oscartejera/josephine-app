/**
 * PrintQueuePanel Component
 * Manages kitchen print queue
 */

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Printer, Check, X, RefreshCw } from 'lucide-react';
import { usePrintQueue } from '@/hooks/usePrintQueue';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface PrintQueuePanelProps {
  locationId: string;
}

export function PrintQueuePanel({ locationId }: PrintQueuePanelProps) {
  const { jobs: queue, pendingCount, markAsPrinted, retryJob: retry, refetch } = usePrintQueue(locationId);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Cola de Impresión</h3>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={refetch}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay tickets en cola</p>
            </div>
          ) : (
            queue.map(item => (
              <div
                key={item.id}
                className="p-3 border rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.ticket_id || 'Ticket'}</span>
                  <Badge
                    variant={
                      item.status === 'pending' ? 'secondary' :
                      item.status === 'printed' ? 'default' : 'destructive'
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
                <div className="flex gap-2">
                  {item.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsPrinted(item.id)}
                      className="gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Marcar impreso
                    </Button>
                  )}
                  {item.status === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retry(item.id)}
                      className="gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reintentar
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
