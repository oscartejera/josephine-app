import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, TrendingDown, Trash2, Sparkles, ArrowRight } from 'lucide-react';
import type { WasteItem } from '@/hooks/useWasteData';
import type { MenuEngineeringItem } from '@/hooks/useMenuEngineeringData';

interface WasteMECrossRefProps {
  wasteItems: WasteItem[];
  meItems: MenuEngineeringItem[];
  isLoading?: boolean;
  currency?: string;
}

interface CrossRefInsight {
  itemName: string;
  classification: string;
  wasteValue: number;
  wastePercent: number;
  marginPct: number;
  unitsSold: number;
  action: 'remove' | 'investigate' | 'optimize' | 'monitor';
  actionLabel: string;
  reason: string;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: typeof AlertTriangle }> = {
  remove: { bg: 'bg-red-500/10', text: 'text-red-600', icon: Trash2 },
  investigate: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: AlertTriangle },
  optimize: { bg: 'bg-blue-500/10', text: 'text-blue-600', icon: Sparkles },
  monitor: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: TrendingDown },
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  star: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  puzzle: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  plow_horse: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  dog: 'bg-red-500/15 text-red-700 border-red-500/30',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  star: 'Star',
  puzzle: 'Puzzle',
  plow_horse: 'Plow Horse',
  dog: 'Dog',
};

/**
 * Fuzzy match between waste item names and ME product names.
 * Handles cases like "Ternera (kg)" matching "Ternera a la plancha"
 */
function fuzzyMatch(wasteName: string, meName: string): number {
  const w = wasteName.toLowerCase().replace(/\(.*?\)/g, '').trim();
  const m = meName.toLowerCase().replace(/\(.*?\)/g, '').trim();
  
  // Exact match
  if (w === m) return 1.0;
  
  // One contains the other
  if (m.includes(w) || w.includes(m)) return 0.8;
  
  // First word match (e.g. "Ternera" matches "Ternera a la plancha")
  const wWords = w.split(/\s+/);
  const mWords = m.split(/\s+/);
  if (wWords[0] && mWords[0] && wWords[0] === mWords[0] && wWords[0].length > 3) return 0.6;
  
  // Token overlap
  const wSet = new Set(wWords.filter(w => w.length > 2));
  const mSet = new Set(mWords.filter(w => w.length > 2));
  const intersection = [...wSet].filter(w => mSet.has(w));
  if (intersection.length > 0 && wSet.size > 0) {
    return (intersection.length / Math.max(wSet.size, mSet.size)) * 0.5;
  }
  
  return 0;
}

export function WasteMECrossRef({
  wasteItems,
  meItems,
  isLoading = false,
  currency = '€',
}: WasteMECrossRefProps) {
  const insights = useMemo(() => {
    if (!wasteItems.length || !meItems.length) return [];

    const results: CrossRefInsight[] = [];

    // For each waste item, find best matching ME item
    for (const waste of wasteItems) {
      let bestMatch: MenuEngineeringItem | null = null;
      let bestScore = 0;

      for (const me of meItems) {
        const score = fuzzyMatch(waste.itemName, me.name);
        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          bestMatch = me;
        }
      }

      if (bestMatch) {
        const classification = bestMatch.classification;
        let action: CrossRefInsight['action'] = 'monitor';
        let actionLabel = 'Monitor';
        let reason = '';

        if (classification === 'dog' && waste.percentOfSales > 0.05) {
          action = 'remove';
          actionLabel = 'Eliminar del menú';
          reason = `Dog con merma alta (${waste.percentOfSales.toFixed(2)}% ventas). Baja popularidad + baja rentabilidad + pérdida por merma.`;
        } else if (classification === 'puzzle' && waste.percentOfSales > 0.05) {
          action = 'investigate';
          actionLabel = 'Investigar';
          reason = `Alta rentabilidad pero merma significativa. Revisar porcionado y almacenamiento.`;
        } else if (classification === 'plow_horse' && waste.percentOfSales > 0.03) {
          action = 'optimize';
          actionLabel = 'Optimizar';
          reason = `Producto popular con margen bajo y merma. Ajustar receta o proveedor.`;
        } else if (classification === 'star' && waste.percentOfSales > 0.05) {
          action = 'investigate';
          actionLabel = 'Revisar urgente';
          reason = `Star con merma anormal. Revisar cadena de frío y prep.`;
        } else if (waste.percentOfSales > 0.03) {
          action = 'monitor';
          actionLabel = 'Vigilar';
          reason = `Merma por encima del umbral. Seguir tendencia.`;
        } else {
          continue; // Skip items with low waste and no classification issues
        }

        results.push({
          itemName: waste.itemName,
          classification,
          wasteValue: waste.value,
          wastePercent: waste.percentOfSales,
          marginPct: bestMatch.margin_pct,
          unitsSold: bestMatch.units_sold,
          action,
          actionLabel,
          reason,
        });
      }
    }

    // Sort: remove first, then investigate, then optimize, then monitor
    const priority: Record<string, number> = { remove: 0, investigate: 1, optimize: 2, monitor: 3 };
    return results.sort((a, b) => priority[a.action] - priority[b.action]);
  }, [wasteItems, meItems]);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card className="border-border bg-emerald-500/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin alertas de cruce ME ↔ Merma</p>
              <p className="text-xs text-muted-foreground">
                No hay productos con combinación problemática de clasificación ME y nivel de merma.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium text-foreground">
            Cruce Menu Engineering ↔ Merma
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {insights.length} items
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Productos donde la clasificación ME y la merma sugieren acción inmediata
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Producto</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Clasificación ME</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Merma</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">% Ventas</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insights.slice(0, 8).map((item) => {
              const style = ACTION_STYLES[item.action];
              const ActionIcon = style.icon;
              const classColor = CLASSIFICATION_COLORS[item.classification] || 'bg-gray-100 text-gray-700';
              const classLabel = CLASSIFICATION_LABELS[item.classification] || item.classification;

              return (
                <TableRow key={item.itemName} className="hover:bg-muted/30 group">
                  <TableCell className="py-2.5">
                    <div>
                      <span className="text-sm font-medium">{item.itemName}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[250px] leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.reason}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant="outline" className={`text-[11px] font-normal ${classColor} border px-2 py-0.5`}>
                      {classLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm tabular-nums">
                    {currency}{item.wasteValue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm tabular-nums">
                    {item.wastePercent.toFixed(2)}%
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${style.bg}`}>
                      <ActionIcon className={`h-3 w-3 ${style.text}`} />
                      <span className={`text-[11px] font-medium ${style.text}`}>{item.actionLabel}</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
