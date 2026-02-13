import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Package, ShoppingCart, MapPin, AlertCircle, Loader2, Database, Link } from 'lucide-react';
import { useLowStockAlerts, useCreatePOFromLowStock, type LowStockAlert } from '@/hooks/useLowStockAlerts';
import { useInventoryReadiness } from '@/hooks/useInventoryReadiness';
import { useInstallDemoInventory } from '@/hooks/useInstallDemoInventory';
import { useTranslation } from 'react-i18next';

interface LowStockWidgetProps {
  locationId: string | null;
}

function UrgencyBadge({ urgency }: { urgency: LowStockAlert['urgency'] }) {
  switch (urgency) {
    case 'critical':
      return <Badge variant="destructive">Crítico</Badge>;
    case 'high':
      return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Alto</Badge>;
    case 'medium':
      return <Badge variant="secondary">Medio</Badge>;
    default:
      return <Badge variant="outline">Bajo</Badge>;
  }
}

function urgencyBorder(urgency: LowStockAlert['urgency']): string {
  switch (urgency) {
    case 'critical':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'high':
      return 'bg-warning/10 text-warning border-warning/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function MissingValue({ reason }: { reason: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-muted-foreground/50 cursor-help">
            —
            <AlertCircle className="h-3 w-3 text-amber-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DemoBadge() {
  return (
    <Badge variant="secondary" className="gap-1">
      <Database className="h-3 w-3" />
      Demo
    </Badge>
  );
}

export function LowStockWidget({ locationId }: LowStockWidgetProps) {
  const { t } = useTranslation();
  const isAllLocations = !locationId || locationId === 'all';
  const readiness = useInventoryReadiness(locationId);
  const { data: alerts, isLoading } = useLowStockAlerts(locationId);
  const createPO = useCreatePOFromLowStock();
  const installDemo = useInstallDemoInventory();

  const orderableItems = alerts?.filter(i => i.supplier_id && i.recommended_qty > 0) ?? [];
  const canOrder = orderableItems.length > 0;

  const handleOrderAll = () => {
    if (!locationId || isAllLocations || !alerts) return;
    createPO.mutate({ locationId, items: orderableItems });
  };

  const handleInstallDemo = () => {
    if (!locationId || isAllLocations) return;
    installDemo.mutate(locationId);
  };

  // All locations → prompt to select one
  if (isAllLocations) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {t('dashboard.lowStock')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">{t('lowStock.selectLocation')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('lowStock.selectLocationHint')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading (either readiness or alerts)
  if (readiness.isLoading || isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {t('dashboard.lowStock')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // DEMO state: no real inventory data for this location
  if (!readiness.isLive) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {t('dashboard.lowStock')}
            </CardTitle>
            <DemoBadge />
          </div>
        </CardHeader>
        <CardContent>
          {/* Demo callout */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 p-4 mb-4">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">{t('lowStock.demoTitle')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('lowStock.demoDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Install demo pack button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleInstallDemo}
            disabled={installDemo.isPending}
          >
            {installDemo.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            {t('lowStock.loadDemoPack')}
          </Button>

          {/* CTA to connect */}
          <div className="mt-3 text-center">
            <a
              href="/settings"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Link className="h-3 w-3" />
              {t('lowStock.connectCTA')}
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // LIVE state: real inventory data exists
  const items = alerts || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {t('dashboard.lowStock')}
          </CardTitle>
          {items.length > 0 && (
            <Badge variant="secondary">{items.length} items</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t('lowStock.allGood')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('lowStock.allGoodHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.item_id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${urgencyBorder(item.urgency)}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{item.name}</p>
                    <UrgencyBadge urgency={item.urgency} />
                  </div>
                  <div className="flex items-center gap-3 text-sm opacity-80 mt-0.5">
                    <span>
                      Stock: {item.on_hand.toFixed(1)} {item.unit}
                    </span>
                    <span className="text-xs">|</span>
                    <span>
                      Reorden: {item.reorder_point.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">
                    Pedir:{' '}
                    {item.recommended_qty === 0
                      && item.forecast_qty === null
                      && item.safety_stock <= 0
                      && item.reorder_point <= 0 ? (
                      <MissingValue reason="Sin datos de uso ni safety stock para calcular" />
                    ) : (
                      <span>{item.recommended_qty.toFixed(1)} {item.unit}</span>
                    )}
                  </p>
                  <p className="text-xs opacity-70">
                    {item.avg_daily_usage !== null
                      ? `Uso: ${item.avg_daily_usage.toFixed(1)}/día`
                      : <MissingValue reason="Sin movimientos de uso en los últimos 30 días" />
                    }
                  </p>
                </div>
              </div>
            ))}

            {/* Order 7 days button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="default"
                      className="w-full mt-2 gap-2"
                      disabled={!canOrder || createPO.isPending}
                      onClick={handleOrderAll}
                    >
                      {createPO.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      Pedir 7 días ({orderableItems.length} items)
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canOrder && items.length > 0 && (
                  <TooltipContent side="top" className="text-xs max-w-xs">
                    No hay items con proveedor asignado y cantidad recomendada &gt; 0
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
