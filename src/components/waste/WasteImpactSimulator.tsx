import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Calculator, Sparkles, TrendingDown } from 'lucide-react';
import type { SimulationResult } from '@/hooks/useWasteSimulation';

interface WasteImpactSimulatorProps {
  result: SimulationResult;
  isLoading?: boolean;
}

export function WasteImpactSimulator({ result, isLoading = false }: WasteImpactSimulatorProps) {
  const [customTarget, setCustomTarget] = useState<number>(result.currentWastePercent > 0 ? Math.max(0.5, result.currentWastePercent / 2) : 1);

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
              <Calculator className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Simulador no disponible</p>
              <p className="text-xs text-muted-foreground">
                Se necesitan datos de merma y ventas para ejecutar simulaciones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const customScenario = result.customScenario(customTarget);
  const bestScenario = result.scenarios.length > 0 ? result.scenarios[result.scenarios.length - 1] : null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Simulador de Impacto "What-If"
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
              IA
            </Badge>
          </CardTitle>
          {bestScenario && (
            <div className="text-xs text-muted-foreground">
              Máximo ahorro: <span className="font-bold text-emerald-600">€{bestScenario.annualSaving.toFixed(0)}/año</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          "¿Qué pasaría si reducimos la merma del {result.currentWastePercent.toFixed(1)}% al X%?"
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Interactive custom slider */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-emerald-500/5 border border-primary/10">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-foreground">Tu objetivo personalizado</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground line-through">{result.currentWastePercent.toFixed(1)}%</span>
              <span className="text-lg font-bold text-primary">→ {customTarget.toFixed(1)}%</span>
            </div>
          </div>
          <Slider
            value={[customTarget * 10]}
            min={1}
            max={Math.max(Math.round(result.currentWastePercent * 10), 10)}
            step={1}
            onValueChange={([v]) => setCustomTarget(v / 10)}
            className="w-full mb-3"
          />
          {/* Impact summary for custom scenario */}
          <div className="grid grid-cols-4 gap-3 mt-3">
            <ImpactMetric
              label="Ahorro mensual"
              value={`€${(customScenario.wasteSaved).toFixed(0)}`}
              color="text-emerald-600"
              icon={<TrendingDown className="h-3 w-3" />}
            />
            <ImpactMetric
              label="Ahorro anual"
              value={`€${customScenario.annualSaving.toFixed(0)}`}
              color="text-emerald-600"
              icon={<Sparkles className="h-3 w-3" />}
            />
            <ImpactMetric
              label="Margen +pp"
              value={`+${customScenario.marginImprovement.toFixed(2)}pp`}
              color="text-primary"
            />
            <ImpactMetric
              label="ROI Josephine"
              value={`${customScenario.roiMultiple.toFixed(1)}×`}
              color={customScenario.roiMultiple >= 2 ? 'text-emerald-600' : 'text-amber-600'}
            />
          </div>
        </div>

        <Separator />

        {/* Pre-built scenarios table */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Escenarios predefinidos</p>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground h-8">Escenario</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">Objetivo</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">Ahorro/mes</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">Ahorro/año</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">Margen</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.scenarios.map(scenario => (
                <TableRow key={scenario.label} className="hover:bg-muted/30">
                  <TableCell className="py-2 text-xs font-medium">{scenario.label}</TableCell>
                  <TableCell className="py-2 text-xs text-right">{scenario.targetPercent.toFixed(1)}%</TableCell>
                  <TableCell className="py-2 text-xs text-right text-emerald-600 font-medium">
                    €{scenario.wasteSaved.toFixed(0)}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-right font-bold text-emerald-600">
                    €{scenario.annualSaving.toFixed(0)}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-right text-primary">
                    +{scenario.marginImprovement.toFixed(2)}pp
                  </TableCell>
                  <TableCell className="py-2 text-xs text-right">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                      scenario.roiMultiple >= 3 ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' :
                      scenario.roiMultiple >= 1 ? 'bg-amber-500/15 text-amber-700 border-amber-500/30' :
                      'bg-gray-500/10 text-muted-foreground'
                    }`}>
                      {scenario.roiMultiple.toFixed(1)}×
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ImpactMetric({ label, value, color, icon }: {
  label: string; value: string; color: string; icon?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}
        <span className="text-sm font-bold">{value}</span>
      </div>
    </div>
  );
}
