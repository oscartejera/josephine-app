import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Printer, 
  Check, 
  CheckCheck, 
  AlertCircle, 
  RefreshCw, 
  Trash2,
  ChefHat,
  Wine,
  Clock,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePrintQueue, PrintJob } from '@/hooks/usePrintQueue';
import { cn } from '@/lib/utils';

interface PrintQueuePanelProps {
  locationId: string;
}

const destinationConfig = {
  kitchen: { icon: ChefHat, label: 'Cocina', color: 'text-orange-500' },
  bar: { icon: Wine, label: 'Bar', color: 'text-purple-500' },
  prep: { icon: Clock, label: 'Prep', color: 'text-blue-500' },
  receipt: { icon: Receipt, label: 'Ticket', color: 'text-zinc-500' },
};

const statusConfig = {
  pending: { label: 'Pendiente', variant: 'default' as const, color: 'bg-amber-500' },
  printed: { label: 'Impreso', variant: 'secondary' as const, color: 'bg-blue-500' },
  acknowledged: { label: 'Confirmado', variant: 'outline' as const, color: 'bg-emerald-500' },
  failed: { label: 'Error', variant: 'destructive' as const, color: 'bg-red-500' },
};

function PrintJobCard({ 
  job, 
  onPrint, 
  onAcknowledge, 
  onRetry, 
  onDelete 
}: { 
  job: PrintJob;
  onPrint: () => void;
  onAcknowledge: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const dest = destinationConfig[job.destination];
  const status = statusConfig[job.status];
  const DestIcon = dest.icon;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DestIcon className={cn('h-5 w-5', dest.color)} />
          <span className="font-medium text-zinc-100">{dest.label}</span>
          {job.table_name && (
            <span className="text-zinc-400 text-sm">• {job.table_name}</span>
          )}
        </div>
        <Badge variant={status.variant} className="text-xs">
          {status.label}
        </Badge>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {job.items_json.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm">
            <span className="text-zinc-400 font-mono w-6">{item.qty}x</span>
            <div className="flex-1">
              <span className="text-zinc-200">{item.name}</span>
              {item.notes && (
                <p className="text-zinc-500 text-xs italic">{item.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
        <span className="text-xs text-zinc-500">
          {format(new Date(job.created_at), 'HH:mm:ss', { locale: es })}
        </span>
        
        <div className="flex gap-1">
          {job.status === 'pending' && (
            <>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onPrint}
              className="h-7 px-2 text-black"
            >
                <Printer className="h-3.5 w-3.5 mr-1" />
                Imprimir
              </Button>
            </>
          )}
          
          {job.status === 'printed' && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onAcknowledge}
            className="h-7 px-2 text-black"
          >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Confirmar
            </Button>
          )}
          
          {job.status === 'failed' && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onRetry}
            className="h-7 px-2 text-black"
          >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reintentar
            </Button>
          )}
          
          {(job.status === 'acknowledged' || job.status === 'failed') && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onDelete}
              className="h-7 px-2 text-zinc-500 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrintQueuePanel({ locationId }: PrintQueuePanelProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const { 
    jobs, 
    loading, 
    isConnected, 
    pendingCount,
    markAsPrinted, 
    markAsAcknowledged, 
    markAsFailed,
    retryJob,
    deleteJob 
  } = usePrintQueue(locationId);

  const filteredJobs = activeTab === 'pending' 
    ? jobs.filter(j => j.status === 'pending' || j.status === 'printed')
    : jobs;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Printer className="h-6 w-6 text-zinc-400" />
          <h2 className="text-lg font-semibold">Cola de Impresión</h2>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500">
              <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-2 w-2 bg-zinc-500 rounded-full" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <div className="px-4 pt-3">
          <TabsList className="bg-zinc-900">
            <TabsTrigger value="pending" className="data-[state=active]:bg-zinc-800">
              Activos
              {pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-zinc-950 text-xs px-1.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-zinc-800">
              Historial
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 m-0">
          <ScrollArea className="h-[calc(100vh-180px)] p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Check className="h-12 w-12 mb-3" />
                <p className="text-sm">No hay trabajos de impresión</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <PrintJobCard
                    key={job.id}
                    job={job}
                    onPrint={() => markAsPrinted(job.id)}
                    onAcknowledge={() => markAsAcknowledged(job.id)}
                    onRetry={() => retryJob(job.id)}
                    onDelete={() => deleteJob(job.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
