import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChefHat, TrendingDown, ArrowRight } from 'lucide-react';
import type { PrepSuggestion, PrepOptimizationResult } from '@/hooks/useWastePrepOptimization';

interface WastePrepOptimizerProps {
  result: PrepOptimizationResult;
  isLoading?: boolean;
}

const CONFIDENCE_STYLES = {
  high:   { label: 'Alta',  color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  medium: { label: 'Media', color: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  low:    { label: 'Baja',  color: 'bg-gray-500/15 text-gray-600 border-gray-500/30' },
};

export function WastePrepOptimizer({ result, isLoading = false }: WastePrepOptimizerProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-[240px] w-full" /></CardContent>
      </Card>
    );
  }

  const { suggestions, totalPotentialSaving, itemsAnalyzed, isReliable } = result;

  if (suggestions.length === 0) {
    return (
      <Card className="border-border bg-emerald-500/5">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ChefHat className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Preparación óptima</p>
              <p className="text-xs text-muted-foreground">
                No se detectaron patrones significativos de sobreproducción. ¡Buen trabajo!
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-primary" />
              Optimización de Preparación
            </CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
              IA
            </Badge>
          </div>
          {totalPotentialSaving > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-600">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                Ahorro potencial: €{totalPotentialSaving.toFixed(0)}/mes
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Basado en {itemsAnalyzed} productos con merma por sobreproducción
          {!isReliable && ' (datos limitados, confianza reducida)'}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Producto</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Merma actual</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Motivo</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Reducción</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Ahorro est.</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Confianza</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.map((item, idx) => (
              <SuggestionRow key={item.itemId} item={item} rank={idx + 1} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SuggestionRow({ item, rank }: { item: PrepSuggestion; rank: number }) {
  const conf = CONFIDENCE_STYLES[item.confidence];

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4">{rank}</span>
          <span className="text-sm font-medium">{item.itemName}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-right">
        <span className="text-sm">€{item.currentWaste.toFixed(0)}</span>
        <span className="text-xs text-muted-foreground ml-1">({item.wasteCount}×)</span>
      </TableCell>
      <TableCell className="py-2.5">
        <span className="text-xs text-muted-foreground">{item.dominantReasonLabel}</span>
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <ArrowRight className="h-3 w-3 text-amber-500" />
          <span className="text-sm font-semibold text-amber-600">-{item.suggestedReductionPct}%</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-right">
        <span className="text-sm font-medium text-emerald-600">-€{item.expectedSaving.toFixed(0)}</span>
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${conf.color}`}>
          {conf.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
