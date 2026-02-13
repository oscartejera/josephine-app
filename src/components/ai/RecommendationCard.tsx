/**
 * Recommendation Card
 * Card individual para mostrar recomendación AI con approve/reject
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  X, 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  Award,
  AlertTriangle,
  Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Recommendation {
  id: string;
  type: 'adjust_staff' | 'create_order' | 'push_menu_item' | 'alert_variance';
  payload_json: Record<string, unknown>;
  rationale: string;
  expected_impact: {
    revenue_delta?: number;
    cost_delta?: number;
    labor_savings?: number;
    revenue_protected?: number;
    margin_improvement?: number;
  };
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  created_at: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const typeConfig = {
  adjust_staff: {
    icon: Users,
    label: 'Ajuste de Personal',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200',
  },
  create_order: {
    icon: ShoppingCart,
    label: 'Pedido Sugerido',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-200',
  },
  push_menu_item: {
    icon: Award,
    label: 'Optimización Menú',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderColor: 'border-emerald-200',
  },
  alert_variance: {
    icon: AlertTriangle,
    label: 'Alerta',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    borderColor: 'border-amber-200',
  },
};

export function RecommendationCard({ 
  recommendation, 
  onApprove, 
  onReject 
}: RecommendationCardProps) {
  const config = typeConfig[recommendation.type];
  const Icon = config.icon;
  const isPending = recommendation.status === 'pending';

  // Calculate net benefit
  const impact = recommendation.expected_impact;
  const netBenefit = 
    (impact.revenue_delta || 0) + 
    (impact.labor_savings || 0) + 
    (impact.revenue_protected || 0) + 
    (impact.margin_improvement || 0) - 
    (impact.cost_delta || 0);

  return (
    <Card className={cn('border-l-4', config.borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', config.bgColor)}>
              <Icon className={cn('h-5 w-5', config.color)} />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {config.label}
                <Sparkles className="h-4 w-4 text-purple-500" />
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Confianza: {(recommendation.confidence * 100).toFixed(0)}%
              </CardDescription>
            </div>
          </div>

          {!isPending && (
            <Badge variant={recommendation.status === 'approved' ? 'default' : 'secondary'}>
              {recommendation.status === 'approved' ? 'Aprobado' : 
               recommendation.status === 'rejected' ? 'Rechazado' : 'Ejecutado'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rationale */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {recommendation.rationale}
        </p>

        {/* Expected Impact */}
        {netBenefit !== 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Impacto Estimado:
              </span>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-lg font-bold text-emerald-600">
                  +€{netBenefit.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="mt-2 space-y-1 text-xs text-emerald-800 dark:text-emerald-200">
              {impact.revenue_delta && impact.revenue_delta > 0 && (
                <div className="flex justify-between">
                  <span>Revenue:</span>
                  <span>+€{impact.revenue_delta}</span>
                </div>
              )}
              {impact.labor_savings && impact.labor_savings > 0 && (
                <div className="flex justify-between">
                  <span>Labor savings:</span>
                  <span>+€{impact.labor_savings}</span>
                </div>
              )}
              {impact.cost_delta && impact.cost_delta > 0 && (
                <div className="flex justify-between">
                  <span>Cost:</span>
                  <span className="text-red-600">-€{impact.cost_delta}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onApprove(recommendation.id)}
              className="flex-1"
              size="sm"
            >
              <Check className="h-4 w-4 mr-1" />
              Aprobar
            </Button>
            <Button
              onClick={() => onReject(recommendation.id)}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <X className="h-4 w-4 mr-1" />
              Rechazar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
