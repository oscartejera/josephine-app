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
import { Check, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { CLASSIFICATION_ACTIONS } from '@/lib/menu-engineering-engine';
import type { MenuEngineeringItem, Classification } from '@/hooks/useMenuEngineeringData';
import { useTranslation } from 'react-i18next';

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

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(0)}`;
}

const PRACTICAL_ACTIONS = [
  {
    classification: 'star' as Classification,
    emoji: '⭐',
    title: 'Stars — Keep & Protect',
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-500/5',
    advice: 'Don\'t change what works. Keep recipe quality, visibility, and consistency.',
    actions: [
      { label: 'Keep recipe unchanged', type: 'maintain_recipe', getImpact: () => 0 },
    ],
  },
  {
    classification: 'plow_horse' as Classification,
    emoji: '🐴',
    title: 'Plow Horses — Improve Margins',
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-500/5',
    advice: 'Customers already love these. Small cost savings or a slight price increase could make a big difference.',
    actions: [
      {
        label: 'Reduce food cost 5%',
        type: 'reduce_food_cost',
        getImpact: (items: MenuEngineeringItem[]) =>
          Math.round(items.reduce((a, i) => a + i.unit_food_cost * i.units_sold * 0.05, 0)),
      },
      {
        label: 'Raise price €1',
        type: 'raise_price',
        getImpact: (items: MenuEngineeringItem[]) =>
          Math.round(items.reduce((a, i) => a + i.units_sold, 0)),
      },
    ],
  },
  {
    classification: 'puzzle' as Classification,
    emoji: '💎',
    title: 'Puzzles — Promote More',
    borderColor: 'border-l-amber-500',
    bgColor: 'bg-amber-500/5',
    advice: 'These make great profit per plate but not enough customers order them. Help them find more buyers.',
    actions: [
      {
        label: 'Better menu placement',
        type: 'improve_placement',
        getImpact: (items: MenuEngineeringItem[]) =>
          Math.round(items.reduce((a, i) => a + i.unit_gross_profit * Math.round(i.units_sold * 0.15), 0)),
      },
    ],
  },
  {
    classification: 'dog' as Classification,
    emoji: '🔍',
    title: 'Dogs — Rethink or Remove',
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-500/5',
    advice: 'These are costing you time, money, and kitchen complexity. Consider removing unless they serve a purpose (e.g. kids menu, dietary option).',
    actions: [
      {
        label: 'Review & decide',
        type: 'evaluate_remove',
        getImpact: (items: MenuEngineeringItem[]) =>
          Math.round(items.filter(i => i.total_gross_profit < 0).reduce((a, i) => a + Math.abs(i.total_gross_profit), 0)),
      },
    ],
  },
];

export function MenuEngineeringActions({
  
  itemsByClassification,
  loading,
  onSaveAction,
}: MenuEngineeringActionsProps) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    classification: Classification;
    actionType: string;
    items: MenuEngineeringItem[];
    impact: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selectedAction) return;
    setSaving(true);
    try {
      await onSaveAction(null, selectedAction.actionType, selectedAction.classification, selectedAction.impact > 0 ? selectedAction.impact : null);
      toast.success('Action plan saved');
      setModalOpen(false);
    } catch {
      toast.error('Error saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3, 4].map((i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>;
  }

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground px-1">Action Plan</h3>
        {PRACTICAL_ACTIONS.map((config) => {
          const items = itemsByClassification[config.classification];
          const topNames = items.slice(0, 3).map(i => i.name);

          return (
            <Card key={config.classification} className={`border-l-4 ${config.borderColor} ${config.bgColor}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{config.emoji}</span>
                  <span className="text-sm font-semibold">{config.title}</span>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{config.advice}</p>

                {topNames.length > 0 && (
                  <p className="text-xs mb-2 text-foreground/80">
                    {topNames.join(', ')}{items.length > 3 ? ` +${items.length - 3} more` : ''}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {config.actions.map((action) => {
                    const impact = action.getImpact(items);
                    return (
                      <Button
                        key={action.type}
                        variant="secondary"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        disabled={items.length === 0}
                        onClick={() => {
                          setSelectedAction({ classification: config.classification, actionType: action.type, items, impact });
                          setModalOpen(true);
                        }}
                      >
                        {action.label}
                        {impact > 0 && <span className="text-emerald-600">+{formatCurrency(impact)}</span>}
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Action Plan</DialogTitle>
            <DialogDescription>
              This creates a reminder for your team. It won't change any data automatically — you apply changes in your POS or kitchen.
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="py-4 space-y-3">
              <p className="text-sm">
                Applies to <strong>{selectedAction.items.length}</strong> products.
              </p>
              {selectedAction.impact > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg">
                  <p className="text-sm">Estimated impact: <strong className="text-emerald-600">+{formatCurrency(selectedAction.impact)}</strong></p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                💡 Tip: Review individual products in the table to decide specific changes.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
