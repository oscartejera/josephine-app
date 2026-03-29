import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import { TrendingDown, BarChart3 } from 'lucide-react';
import type { VarianceResult, VarianceRow } from '@/hooks/useWasteVariance';

interface WasteVarianceAnalysisProps {
  result: VarianceResult;
  isLoading?: boolean;
}

const IMPACT_STYLES = {
  critical:   { bg: 'bg-red-500/15', text: 'text-red-700', border: 'border-red-500/30', label: 'Crítico' },
  warning:    { bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-500/30', label: 'Alerta' },
  acceptable: { bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-500/30', label: 'Aceptable' },
};

export function WasteVarianceAnalysis({ result, isLoading = false }: WasteVarianceAnalysisProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!result.isAvailable) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Análisis de varianza no disponible</p>
              <p className="text-xs text-muted-foreground">
                Se necesitan datos de al menos 2 categorías para calcular la varianza.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { rows, totalTheoretical, totalActual, totalVariance, totalVariancePercent, potentialSaving } = result;

  return (
    <TooltipProvider>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Análisis de Varianza de Coste
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                IA
              </Badge>
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Ahorro potencial: <span className="font-bold text-emerald-600">€{potentialSaving.toFixed(0)}/mes</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Teórico (escandallos) vs Real (teórico + merma) — identifica dónde la merma distorsiona más tu food cost
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Waterfall summary bar */}
          <div className="mb-4 p-3 rounded-lg bg-muted/50">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Coste teórico</p>
                <p className="text-sm font-bold text-foreground">€{totalTheoretical.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">+ Merma</p>
                <p className="text-sm font-bold text-red-600">+€{totalVariance.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">= Coste real</p>
                <p className="text-sm font-bold text-foreground">€{totalActual.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Varianza total</p>
                <p className="text-sm font-bold text-red-600">+{totalVariancePercent.toFixed(1)}%</p>
              </div>
            </div>
            {/* Visual bar */}
            <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-primary/60 rounded-l-full"
                style={{ width: `${totalTheoretical > 0 ? (totalTheoretical / totalActual) * 100 : 50}%` }}
              />
              <div
                className="h-full bg-red-400/80 rounded-r-full"
                style={{ width: `${totalActual > 0 ? (totalVariance / totalActual) * 100 : 50}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground">Teórico</span>
              <span className="text-[9px] text-red-500">Merma (+{totalVariancePercent.toFixed(1)}%)</span>
            </div>
          </div>

          {/* Category breakdown table */}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground h-9">Categoría</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Teórico</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Merma</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Real</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Varianza</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground h-9">Motivo top</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Impacto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <VarianceTableRow key={row.category} row={row} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function VarianceTableRow({ row }: { row: VarianceRow }) {
  const impactStyle = IMPACT_STYLES[row.impact];

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2.5">
        <span className="text-sm font-medium">{row.category}</span>
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm text-muted-foreground">
        €{row.theoreticalCost.toFixed(0)}
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm text-red-600 font-medium">
        +€{row.wasteCost.toFixed(0)}
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm font-medium">
        €{row.actualCost.toFixed(0)}
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${impactStyle.bg} ${impactStyle.text} ${impactStyle.border}`}>
              +{row.variancePercent.toFixed(1)}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {row.salesPercent.toFixed(2)}% de las ventas totales
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="py-2.5 text-xs text-muted-foreground">
        {row.topWasteReasonLabel}
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <span className={`text-[10px] font-medium ${impactStyle.text}`}>{impactStyle.label}</span>
      </TableCell>
    </TableRow>
  );
}
