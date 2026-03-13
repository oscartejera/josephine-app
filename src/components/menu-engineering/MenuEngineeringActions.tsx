import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Star, TrendingUp, Gem, Search, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CLASSIFICATION_ACTIONS } from '@/lib/menu-engineering-engine';
import type { MenuEngineeringItem, Classification } from '@/hooks/useMenuEngineeringData';

interface MenuEngineeringActionsProps {
  itemsByClassification: Record<Classification, MenuEngineeringItem[]>;
  loading: boolean;
  onSaveAction: (
    productId: string | null,
    actionType: string,
    classification: string,
    estimatedImpact: number | null
  ) => Promise<void>;
}

interface ActionConfig {
  classification: Classification;
  title: string;
  emoji: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description: string;
  actions: {
    label: string;
    type: string;
    impactFn: (items: MenuEngineeringItem[]) => number;
    impactLabel: string;
  }[];
}

const ACTION_CONFIGS: ActionConfig[] = [
  {
    classification: 'star',
    title: CLASSIFICATION_ACTIONS.star.title,
    emoji: CLASSIFICATION_ACTIONS.star.emoji,
    icon: Star,
    color: 'text-success',
    bgColor: 'bg-success/10',
    description: CLASSIFICATION_ACTIONS.star.description,
    actions: [
      {
        label: 'Mantener y proteger',
        type: 'maintain_protect',
        impactFn: () => 0,
        impactLabel: 'Sin impacto directo',
      },
    ],
  },
  {
    classification: 'plow_horse',
    title: CLASSIFICATION_ACTIONS.plow_horse.title,
    emoji: CLASSIFICATION_ACTIONS.plow_horse.emoji,
    icon: TrendingUp,
    color: 'text-info',
    bgColor: 'bg-info/10',
    description: CLASSIFICATION_ACTIONS.plow_horse.description,
    actions: [
      {
        label: 'Simular mejora de margen',
        type: 'simulate_margin_improvement',
        impactFn: (items) => items.reduce((acc, i) => acc + i.units_sold * i.unit_gross_profit * 0.10, 0),
        impactLabel: 'Impacto +10% margen',
      },
      {
        label: 'Revisar recetas',
        type: 'review_recipes',
        impactFn: (items) => items.reduce((acc, i) => acc + i.unit_food_cost * i.units_sold * 0.05, 0),
        impactLabel: 'Ahorro -5% coste',
      },
    ],
  },
  {
    classification: 'puzzle',
    title: CLASSIFICATION_ACTIONS.puzzle.title,
    emoji: CLASSIFICATION_ACTIONS.puzzle.emoji,
    icon: Gem,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    description: CLASSIFICATION_ACTIONS.puzzle.description,
    actions: [
      {
        label: 'Mejorar visibilidad',
        type: 'improve_visibility',
        impactFn: (items) => items.reduce((acc, i) => acc + i.unit_gross_profit * Math.round(i.units_sold * 0.15), 0),
        impactLabel: 'Potencial +15% uds',
      },
    ],
  },
  {
    classification: 'dog',
    title: CLASSIFICATION_ACTIONS.dog.title,
    emoji: CLASSIFICATION_ACTIONS.dog.emoji,
    icon: Search,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    description: CLASSIFICATION_ACTIONS.dog.description,
    actions: [
      {
        label: 'Evaluar retirar o rediseñar',
        type: 'evaluate_remove_redesign',
        impactFn: (items) => items.filter((i) => i.total_gross_profit < 0).reduce((acc, i) => acc + Math.abs(i.total_gross_profit), 0),
        impactLabel: 'Pérdidas actuales',
      },
    ],
  },
];

function formatCurrency(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(0)}`;
}

export function MenuEngineeringActions({
  itemsByClassification,
  loading,
  onSaveAction,
}: MenuEngineeringActionsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    config: ActionConfig;
    action: ActionConfig['actions'][0];
    items: MenuEngineeringItem[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleActionClick = (
    config: ActionConfig,
    action: ActionConfig['actions'][0],
    items: MenuEngineeringItem[]
  ) => {
    setSelectedAction({ config, action, items });
    setModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedAction) return;

    setSaving(true);
    try {
      const impact = selectedAction.action.impactFn(selectedAction.items);
      await onSaveAction(
        null,
        selectedAction.action.type,
        selectedAction.config.classification,
        impact > 0 ? impact : null
      );
      toast.success('Plan guardado', {
        description: 'Recuerda aplicar los cambios en tu POS.',
      });
      setModalOpen(false);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48 mb-3" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {ACTION_CONFIGS.map((config) => {
          const items = itemsByClassification[config.classification];
          const topItems = items.slice(0, 5);

          return (
            <Card key={config.classification} className={`${config.bgColor} border-0`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>{config.emoji}</span>
                  <span>{config.title}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                {topItems.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Top productos:</p>
                    <p className="text-sm truncate">
                      {topItems.map((i) => i.name).join(', ')}
                      {items.length > 5 && ` +${items.length - 5} más`}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {config.actions.map((action) => {
                    const impact = action.impactFn(items);
                    return (
                      <Button
                        key={action.type}
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={items.length === 0}
                        onClick={() => handleActionClick(config, action, items)}
                      >
                        {action.label}
                        {impact > 0 && (
                          <span className="ml-1 text-success">+{formatCurrency(impact)}</span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction && (
                <>
                  <span>{selectedAction.config.emoji}</span>
                  {selectedAction.action.label}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Esto es un <strong>plan de acción</strong>. No realizará cambios automáticos en tu
              sistema de ventas.
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-2">
                Se aplicará a <strong>{selectedAction.items.length}</strong> productos del cuadrante{' '}
                <strong>{selectedAction.config.title}</strong>.
              </p>
              {selectedAction.action.impactFn(selectedAction.items) > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm">
                    {selectedAction.action.impactLabel}:{' '}
                    <strong className="text-success">
                      {formatCurrency(selectedAction.action.impactFn(selectedAction.items))}
                    </strong>
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Para aplicar cambios reales, edita precios o recetas en tu POS.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Guardar plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
