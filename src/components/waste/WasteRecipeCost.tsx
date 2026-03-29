import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import { UtensilsCrossed, AlertTriangle } from 'lucide-react';
import type { RecipeCostResult, RecipeWasteImpact } from '@/hooks/useWasteRecipeCost';

interface WasteRecipeCostProps {
  result: RecipeCostResult;
  isLoading?: boolean;
}

const RISK_STYLES = {
  high:   { bg: 'bg-red-500/15', text: 'text-red-700', border: 'border-red-500/30', label: 'Alto' },
  medium: { bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-500/30', label: 'Medio' },
  low:    { bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-500/30', label: 'Bajo' },
};

export function WasteRecipeCost({ result, isLoading = false }: WasteRecipeCostProps) {
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
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Coste de recetas ajustado no disponible</p>
              <p className="text-xs text-muted-foreground">
                Se necesitan datos de merma y recetas del módulo de Menu Engineering.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { recipes, totalMarginErosion, totalWasteInRecipes, worstRecipe } = result;
  const highRiskCount = recipes.filter(r => r.riskLevel === 'high').length;

  return (
    <TooltipProvider>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Coste Real de Recetas (ajustado por merma)
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                IA
              </Badge>
            </CardTitle>
            {highRiskCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {highRiskCount} receta{highRiskCount > 1 ? 's' : ''} en riesgo
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tu food cost teórico no incluye la merma. Aquí ves el coste REAL de cada plato.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Summary */}
          <div className="mb-4 p-3 rounded-lg bg-muted/50 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Merma en recetas</p>
              <p className="text-sm font-bold text-red-600">€{totalWasteInRecipes.toFixed(0)}/mes</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Erosión media</p>
              <p className="text-sm font-bold text-amber-600">{totalMarginErosion.toFixed(2)}pp</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Peor receta</p>
              <p className="text-sm font-bold text-foreground truncate">{worstRecipe || '-'}</p>
            </div>
          </div>

          {/* Recipes table */}
          <div className="max-h-[350px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent sticky top-0 bg-background">
                  <TableHead className="text-xs font-medium text-muted-foreground h-8">Plato</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">PVP</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">FC teórico</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">+ Merma</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">FC real</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">FC%</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-center h-8">Erosión</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-center h-8">Riesgo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map(recipe => (
                  <RecipeRow key={recipe.recipeName} recipe={recipe} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function RecipeRow({ recipe }: { recipe: RecipeWasteImpact }) {
  const riskStyle = RISK_STYLES[recipe.riskLevel];

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2 text-xs font-medium max-w-[180px] truncate">
        {recipe.recipeName}
      </TableCell>
      <TableCell className="py-2 text-xs text-right text-muted-foreground">
        €{recipe.sellingPrice.toFixed(2)}
      </TableCell>
      <TableCell className="py-2 text-xs text-right text-muted-foreground">
        €{recipe.theoreticalCost.toFixed(2)}
      </TableCell>
      <TableCell className="py-2 text-xs text-right text-red-600">
        +€{recipe.wasteImpact.toFixed(2)}
      </TableCell>
      <TableCell className="py-2 text-xs text-right font-medium">
        €{recipe.adjustedCost.toFixed(2)}
      </TableCell>
      <TableCell className="py-2 text-xs text-right">
        <Tooltip>
          <TooltipTrigger>
            <span className={recipe.adjustedFoodCostPercent > 35 ? 'text-red-600 font-medium' : ''}>
              {recipe.adjustedFoodCostPercent.toFixed(1)}%
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Teórico: {recipe.sellingPrice > 0 ? ((recipe.theoreticalCost / recipe.sellingPrice) * 100).toFixed(1) : 0}%
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="py-2 text-xs text-center">
        <span className={recipe.marginErosion > 2 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          -{recipe.marginErosion.toFixed(2)}pp
        </span>
      </TableCell>
      <TableCell className="py-2 text-center">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}>
          {riskStyle.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
