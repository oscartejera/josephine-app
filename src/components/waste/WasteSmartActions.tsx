import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { WastePattern } from '@/hooks/useWasteShiftAnalysis';
import type { ForecastSummary } from '@/hooks/useWasteForecast';
import type { WasteMetrics, WasteItem, WasteByReason } from '@/hooks/useWasteData';
import { useMemo } from 'react';

interface SmartAction {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  expectedImpact: string;
  category: 'cost' | 'process' | 'menu' | 'training' | 'inventory';
}

interface WasteSmartActionsProps {
  metrics: WasteMetrics;
  wasteTarget: number;
  patterns: WastePattern[];
  forecastSummary: ForecastSummary | null;
  items: WasteItem[];
  byReason: WasteByReason[];
  isLoading?: boolean;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  cost:      { label: 'Coste',      color: 'bg-red-500/15 text-red-600 border-red-500/30' },
  process:   { label: 'Proceso',    color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  menu:      { label: 'Menú',       color: 'bg-violet-500/15 text-violet-600 border-violet-500/30' },
  training:  { label: 'Formación',  color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  inventory: { label: 'Inventario', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
};

const PRIORITY_STYLES: Record<string, { dot: string; border: string }> = {
  critical: { dot: 'bg-red-500', border: 'border-l-red-500' },
  high:     { dot: 'bg-amber-500', border: 'border-l-amber-500' },
  medium:   { dot: 'bg-blue-500', border: 'border-l-blue-500' },
};

function generateActions(
  metrics: WasteMetrics,
  wasteTarget: number,
  patterns: WastePattern[],
  forecastSummary: ForecastSummary | null,
  items: WasteItem[],
  byReason: WasteByReason[],
): SmartAction[] {
  const actions: SmartAction[] = [];
  const { wastePercentOfSales, totalAccountedWaste, totalSales } = metrics;

  // ── 1. Target-based actions ──
  if (wastePercentOfSales > wasteTarget * 1.5) {
    const savings = ((wastePercentOfSales - wasteTarget) / 100) * totalSales;
    actions.push({
      id: 'target-exceed',
      priority: 'critical',
      title: 'Merma muy por encima del objetivo',
      description: `Tu merma actual (${wastePercentOfSales.toFixed(1)}%) supera el objetivo (${wasteTarget}%) en ${(wastePercentOfSales - wasteTarget).toFixed(1)}pp. Prioriza las 3 acciones más impactantes de esta lista.`,
      expectedImpact: `Ahorro potencial: €${savings.toFixed(0)}/mes`,
      category: 'cost',
    });
  }

  // ── 2. Top item actions ──
  const topItems = items.slice(0, 3);
  if (topItems.length > 0 && topItems[0].value > totalAccountedWaste * 0.1) {
    actions.push({
      id: 'top-item-focus',
      priority: 'high',
      title: `Revisar ${topItems[0].itemName}`,
      description: `Es tu ítem con más merma (€${topItems[0].value.toFixed(0)}, ${topItems[0].percentOfSales.toFixed(2)}% de ventas). Motivo principal: ${topItems[0].topReason}. Revisa porción, proveedor y almacenamiento.`,
      expectedImpact: `Reducir un 30% = -€${(topItems[0].value * 0.3).toFixed(0)}/mes`,
      category: 'menu',
    });
  }

  // ── 3. Reason-based actions ──
  const topReason = byReason[0];
  if (topReason) {
    const totalWasteValue = byReason.reduce((s, r) => s + r.value, 0);
    const reasonPct = totalWasteValue > 0 ? (topReason.value / totalWasteValue) * 100 : 0;

    if (reasonPct > 30) {
      const reasonActions: Record<string, { title: string; desc: string; cat: SmartAction['category'] }> = {
        expiry:        { title: 'Mejorar rotación FIFO', desc: 'La caducidad es tu motivo principal. Revisa fechas diariamente a primera hora y reduce volumen de pedidos de los ítems afectados.', cat: 'inventory' },
        kitchen_error: { title: 'Formar al equipo de cocina', desc: 'Los errores de cocina dominan tu merma. Imprime las fichas técnicas y programa una sesión de formación con el turno afectado.', cat: 'training' },
        end_of_day:    { title: 'Ajustar producción diaria', desc: 'Demasiada sobreproducción al final del día. Conecta tu prep list con el forecast de demanda para producir solo lo necesario.', cat: 'process' },
        spillage:      { title: 'Revisar procesos de manipulación', desc: 'Los derrames son el motivo principal. Verifica envases, técnicas de transporte y condiciones de almacenamiento.', cat: 'process' },
        broken:        { title: 'Evaluar embalaje y proveedor', desc: 'La rotura domina tu merma. Revisa las condiciones de entrega del proveedor y el almacenamiento en recepción.', cat: 'inventory' },
        theft:         { title: 'Implementar controles de inventario', desc: 'El robo/consumo no autorizado es significativo. Refuerza los recuentos de stock y los controles de acceso.', cat: 'inventory' },
      };

      const action = reasonActions[topReason.reason as string];
      if (action) {
        actions.push({
          id: `reason-${topReason.reason}`,
          priority: 'high',
          title: action.title,
          description: action.desc,
          expectedImpact: `${topReason.reason} = €${topReason.value.toFixed(0)} (${reasonPct.toFixed(0)}% del total)`,
          category: action.cat,
        });
      }
    }
  }

  // ── 4. Pattern-based actions ──
  patterns.forEach(pattern => {
    if (pattern.type === 'shift_concentration' && pattern.severity === 'high') {
      actions.push({
        id: `action-${pattern.id}`,
        priority: 'high',
        title: 'Investigar turno problemático',
        description: `${pattern.description} Programa una reunión con el responsable de turno para revisar procesos y formación específica.`,
        expectedImpact: pattern.metric,
        category: 'training',
      });
    }
    if (pattern.type === 'recurring_spike' && pattern.severity === 'high') {
      actions.push({
        id: `action-${pattern.id}`,
        priority: 'high',
        title: `Revisar pedidos del ${pattern.title.replace('Pico recurrente: ', '')}`,
        description: `${pattern.description} Ajusta las cantidades de pedido y producción para ese día específico.`,
        expectedImpact: pattern.metric,
        category: 'process',
      });
    }
  });

  // ── 5. Forecast-based actions ──
  if (forecastSummary && forecastSummary.projectedVsTarget > 0) {
    actions.push({
      id: 'forecast-warning',
      priority: forecastSummary.projectedVsTarget > forecastSummary.weeklyTarget * 0.3 ? 'critical' : 'medium',
      title: 'Previsión supera el objetivo semanal',
      description: `La próxima semana se prevén €${forecastSummary.totalPredictedWaste.toFixed(0)} de merma, €${forecastSummary.projectedVsTarget.toFixed(0)} por encima del objetivo. Día de mayor riesgo: ${forecastSummary.highestRiskDay}. Toma medidas preventivas.`,
      expectedImpact: `Reducir prep del ${forecastSummary.highestRiskDay} un 15-20%`,
      category: 'process',
    });
  }

  if (forecastSummary?.trend === 'worsening') {
    actions.push({
      id: 'trend-worsening',
      priority: 'medium',
      title: 'Tendencia de merma al alza',
      description: `La merma ha aumentado ${forecastSummary.trendPercent.toFixed(0)}% respecto a semanas anteriores. Convoca una reunión de equipo para identificar las causas raíz.`,
      expectedImpact: `Frenar la tendencia antes de que se consolide`,
      category: 'process',
    });
  }

  // ── 6. General best practices (low-data fallback) ──
  if (actions.length < 3 && totalAccountedWaste > 0) {
    actions.push({
      id: 'fifo-check',
      priority: 'medium',
      title: 'Auditoría FIFO semanal',
      description: 'Programa una revisión FIFO de las cámaras cada lunes. El 30-50% del desperdicio por caducidad se elimina con una rotación correcta.',
      expectedImpact: 'Reducir caducidades un 30-50%',
      category: 'inventory',
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2 };
  return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5);
}

export function WasteSmartActions({
  metrics, wasteTarget, patterns, forecastSummary, items, byReason, isLoading = false,
}: WasteSmartActionsProps) {
  const actions = useMemo(
    () => generateActions(metrics, wasteTarget, patterns, forecastSummary, items, byReason),
    [metrics, wasteTarget, patterns, forecastSummary, items, byReason]
  );

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[180px] w-full" /></CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="border-border bg-emerald-500/5">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-foreground">Todo bajo control</p>
              <p className="text-xs text-muted-foreground">No se detectan acciones urgentes. ¡Sigue así!</p>
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
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium text-foreground">
            Acciones Recomendadas
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-600 border-violet-500/30">
            IA
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Acciones priorizadas automáticamente según tus datos, patrones y previsiones
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action, i) => {
          const priority = PRIORITY_STYLES[action.priority];
          const catStyle = CATEGORY_LABELS[action.category];

          return (
            <div
              key={action.id}
              className={`rounded-lg border border-border border-l-[3px] ${priority.border} p-3 hover:bg-muted/20 transition-colors`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  action.priority === 'critical' ? 'bg-red-500/15' : 'bg-muted'
                }`}>
                  <span className="text-[10px] font-bold text-foreground/70">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{action.title}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 border ${catStyle.color}`}>
                      {catStyle.label}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <ArrowRight className="h-3 w-3 text-emerald-500" />
                    <span className="text-[11px] font-medium text-emerald-600">{action.expectedImpact}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
