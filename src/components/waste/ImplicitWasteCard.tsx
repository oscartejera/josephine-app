/**
 * ImplicitWasteCard — Shows shrinkage analysis
 *
 * Displays the gap between theoretical and actual inventory usage.
 * Items with positive implicit waste = unaccounted loss (shrinkage).
 * Items with negative = potential over-portioning or miscounting.
 */

import { startOfMonth, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, TrendingDown, CheckCircle2, Eye, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useImplicitWaste, type ImplicitWasteItem } from '@/hooks/useImplicitWaste';
import { cn } from '@/lib/utils';

interface ImplicitWasteCardProps {
  locationId: string | null;
  dateFrom?: Date;
  dateTo?: Date;
  compact?: boolean;
}

function fmt(v: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function SeverityDot({ qty, variancePct }: { qty: number; variancePct: number | null }) {
  const pct = variancePct ?? 0;
  if (qty <= 0) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (pct > 10) return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (pct > 5) return <TrendingDown className="h-4 w-4 text-amber-500" />;
  return <Eye className="h-4 w-4 text-blue-500" />;
}

export function ImplicitWasteCard({
  locationId,
  dateFrom,
  dateTo,
  compact = false,
}: ImplicitWasteCardProps) {
  const from = dateFrom || startOfMonth(new Date());
  const to = dateTo || endOfMonth(new Date());

  const { data, isLoading } = useImplicitWaste(locationId, from, to);

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Merma Implícita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Merma Implícita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">Sin datos de recuento</p>
            <p className="text-xs mt-1">
              Realiza un recuento de stock para calcular la merma implícita
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary } = data;
  const topItems = compact ? data.items.slice(0, 5) : data.items;
  const shrinkageItems = topItems.filter((i) => i.implicit_waste_qty > 0);
  const period = `${format(from, 'dd MMM', { locale: es })} — ${format(to, 'dd MMM', { locale: es })}`;

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600" />
              Merma Implícita
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{period}</p>
          </div>
          <div className="flex items-center gap-2">
            {(summary.total_implicit_waste_cost ?? 0) > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {fmt(summary.total_implicit_waste_cost)} pérdida
              </span>
            )}
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {summary.items_with_variance}/{summary.total_items} items
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-4 pb-3 border-b border-gray-100">
          <div className="text-center">
            <p className="text-lg font-bold text-red-600">
              {fmt(summary.total_implicit_waste_cost ?? 0)}
            </p>
            <p className="text-[10px] text-gray-500 uppercase font-semibold">
              Merma no registrada
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-600">
              {fmt(summary.total_explicit_waste_cost ?? 0)}
            </p>
            <p className="text-[10px] text-gray-500 uppercase font-semibold">
              Merma registrada
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-700">
              {summary.avg_variance_pct != null ? `${summary.avg_variance_pct}%` : '—'}
            </p>
            <p className="text-[10px] text-gray-500 uppercase font-semibold">
              Varianza media
            </p>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-[10px] font-semibold text-gray-500 uppercase pb-2 border-b border-gray-50">
          <span className="col-span-2">Producto</span>
          <span className="text-right">Teórico</span>
          <span className="text-right">Real</span>
          <span className="text-right">Diferencia</span>
          <span className="text-right">Coste</span>
          <span className="text-center">Estado</span>
        </div>

        {/* Item rows */}
        <div className="space-y-1">
          {topItems.map((item) => (
            <ItemRow key={item.item_id} item={item} />
          ))}
        </div>

        {compact && data.items.length > 5 && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            +{data.items.length - 5} productos más
          </p>
        )}

        {/* Insight footer */}
        {shrinkageItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 bg-amber-50/50 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-800">
              💡 {shrinkageItems.length} producto{shrinkageItems.length > 1 ? 's' : ''} con merma no registrada.
              Las causas más comunes son: sobre-porcionado, errores de conteo, o merma que no se reportó.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemRow({ item }: { item: ImplicitWasteItem }) {
  const isLoss = item.implicit_waste_qty > 0;
  const theoreticalUsed = item.opening_qty + item.purchase_qty - item.closing_qty;

  return (
    <div
      className={cn(
        'grid grid-cols-7 gap-2 items-center py-2 px-2 rounded-lg text-sm',
        isLoss ? 'bg-red-50/30' : item.implicit_waste_qty < 0 ? 'bg-blue-50/30' : 'bg-gray-50/30'
      )}
    >
      <div className="col-span-2 flex items-center gap-2">
        <SeverityDot qty={item.implicit_waste_qty} variancePct={item.variance_pct} />
        <div>
          <div className="text-sm font-medium text-gray-900 truncate">{item.item_name}</div>
          <div className="text-[10px] text-gray-500">{item.category || item.unit}</div>
        </div>
      </div>
      <span className="text-right text-gray-600">
        {item.theoretical_qty.toFixed(1)} {item.unit}
      </span>
      <span className="text-right text-gray-600">
        {theoreticalUsed.toFixed(1)} {item.unit}
      </span>
      <span
        className={cn(
          'text-right font-semibold',
          isLoss ? 'text-red-600' : item.implicit_waste_qty < 0 ? 'text-blue-600' : 'text-gray-400'
        )}
      >
        {item.implicit_waste_qty > 0 ? '+' : ''}{item.implicit_waste_qty.toFixed(1)}
      </span>
      <span
        className={cn(
          'text-right font-medium',
          isLoss ? 'text-red-700' : 'text-gray-500'
        )}
      >
        {isLoss ? fmt(item.implicit_waste_cost) : '—'}
      </span>
      <div className="text-center">
        {item.variance_pct != null && (
          <span
            className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              Math.abs(item.variance_pct) > 10
                ? 'bg-red-100 text-red-700'
                : Math.abs(item.variance_pct) > 5
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            )}
          >
            {item.variance_pct > 0 ? '+' : ''}{item.variance_pct}%
          </span>
        )}
      </div>
    </div>
  );
}
