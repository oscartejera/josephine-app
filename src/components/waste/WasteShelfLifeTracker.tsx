import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Clock, AlertTriangle, Skull, AlertCircle, CheckCircle } from 'lucide-react';
import type { ShelfLifeResult, LotAlert } from '@/hooks/useWasteShelfLife';

interface WasteShelfLifeTrackerProps {
  result: ShelfLifeResult;
}

const STATUS_CONFIG = {
  expired:  { icon: Skull,          bg: 'bg-red-500/10',    text: 'text-red-700',    badge: 'bg-red-500/15 text-red-700 border-red-500/30' },
  critical: { icon: AlertTriangle,  bg: 'bg-orange-500/10', text: 'text-orange-700', badge: 'bg-orange-500/15 text-orange-700 border-orange-500/30' },
  warning:  { icon: AlertCircle,    bg: 'bg-amber-500/10',  text: 'text-amber-700',  badge: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  ok:       { icon: CheckCircle,    bg: 'bg-emerald-500/10',text: 'text-emerald-700',badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
};

export function WasteShelfLifeTracker({ result }: WasteShelfLifeTrackerProps) {
  const { alerts, summary, isLoading } = result;

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin datos de lotes</p>
              <p className="text-xs text-muted-foreground">
                Registra lotes abiertos en inventario para activar el seguimiento de caducidad.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const urgentAlerts = alerts.filter(a => a.status !== 'ok');
  const showAlerts = urgentAlerts.length > 0 ? urgentAlerts : alerts.slice(0, 5);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Seguimiento de Vida Útil
          </CardTitle>
          <div className="flex items-center gap-3">
            {summary.expiredCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-700 border-red-500/30">
                {summary.expiredCount} caducados
              </Badge>
            )}
            {summary.criticalCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/15 text-orange-700 border-orange-500/30">
                {summary.criticalCount} críticos (&lt;24h)
              </Badge>
            )}
            {summary.warningCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 border-amber-500/30">
                {summary.warningCount} próximos (24-48h)
              </Badge>
            )}
          </div>
        </div>
        {summary.estimatedExpiryLoss > 0 && (
          <p className="text-xs text-red-600 mt-0.5">
            ⚠️ Pérdida estimada por caducidad: €{summary.estimatedExpiryLoss.toFixed(0)}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Estado</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Producto</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Lote</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Cantidad</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Caducidad</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showAlerts.map(alert => (
              <LotAlertRow key={alert.lotId} alert={alert} />
            ))}
          </TableBody>
        </Table>
        {alerts.length > showAlerts.length && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            +{alerts.length - showAlerts.length} lotes más en seguimiento
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LotAlertRow({ alert }: { alert: LotAlert }) {
  const config = STATUS_CONFIG[alert.status];
  const Icon = config.icon;

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2.5">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${config.text}`} />
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.badge}`}>
            {alert.statusLabel}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        <div>
          <span className="text-sm font-medium">{alert.itemName}</span>
          <span className="text-xs text-muted-foreground ml-1.5">{alert.category}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-xs text-muted-foreground font-mono">
        {alert.lotNumber}
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm">
        {alert.quantity.toFixed(1)} {alert.unit}
      </TableCell>
      <TableCell className="py-2.5 text-xs text-muted-foreground">
        {alert.expiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </TableCell>
      <TableCell className="py-2.5 text-xs">
        <span className={alert.status === 'ok' ? 'text-muted-foreground' : config.text}>
          {alert.action}
        </span>
      </TableCell>
    </TableRow>
  );
}
