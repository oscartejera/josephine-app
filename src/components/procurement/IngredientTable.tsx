import { useState } from 'react';
import { Minus, Plus, Pause, HelpCircle, ChevronDown, ChevronUp, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { IngredientSku, RecommendationBreakdown } from '@/hooks/useProcurementData';
import { useTranslation } from 'react-i18next';

interface IngredientTableProps {
  skus: IngredientSku[];
  categories: string[];
  cart: Map<string, number>;
  dayLabels: string[];
  getRecommendedPacks: (sku: IngredientSku) => number;
  getRecommendationBreakdown: (sku: IngredientSku) => RecommendationBreakdown;
  onUpdatePacks: (skuId: string, packs: number) => void;
}

interface CategorySectionProps {
  category: string;
  skus: IngredientSku[];
  cart: Map<string, number>;
  dayLabels: string[];
  getRecommendedPacks: (sku: IngredientSku) => number;
  getRecommendationBreakdown: (sku: IngredientSku) => RecommendationBreakdown;
  onUpdatePacks: (skuId: string, packs: number) => void;
}

function IngredientRowDesktop({
  sku,
  packs,
  recommendedPacks,
  breakdown,
  dayLabels,
  onUpdatePacks,
}: {
  sku: IngredientSku;
  packs: number;
  recommendedPacks: number;
  breakdown: RecommendationBreakdown;
  dayLabels: string[];
  onUpdatePacks: (skuId: string, packs: number) => void;
}) {
  const isPaused = sku.paused;

  return (
    <div className={`border-b border-border last:border-b-0 ${isPaused ? 'opacity-50' : ''}`}>
      {/* Main row */}
      <div className="grid grid-cols-[1fr_180px_200px_120px] gap-4 items-center px-6 py-4">
        {/* Item info */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">{sku.name}</h4>
            {isPaused && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Pause className="h-3 w-3" />
                    {t('procurement.IngredientTable.paused')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[200px]">{sku.pauseReason || 'This item is temporarily paused'}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Badge variant="outline" className="mt-1.5 font-normal text-xs">
            {sku.packSize}
          </Badge>
        </div>

        {/* Stepper - Large and centered like Sysco */}
        <div className="flex items-center justify-center">
          {!isPaused ? (
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-md hover:bg-background"
                onClick={() => onUpdatePacks(sku.id, Math.max(0, packs - 1))}
                disabled={packs === 0}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <div className="w-14 h-10 flex items-center justify-center bg-background rounded-md border border-border">
                <span className="text-lg font-semibold text-foreground">{packs}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-md hover:bg-background"
                onClick={() => onUpdatePacks(sku.id, packs + 1)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-base font-semibold text-foreground">
            €{(packs * sku.unitPrice).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            €{sku.unitPrice.toFixed(2)}/pack
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {recommendedPacks > {t('procurement.IngredientTable.0Packs0Ispaused')}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => onUpdatePacks(sku.id, recommendedPacks)}
            >
              +{recommendedPacks}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Bookmark className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Daily usage row */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">{t('procurement.IngredientTable.dailyUsage')}</span>
          <div className="flex gap-1 overflow-x-auto">
            {dayLabels.map((day, i) => (
              <div
                key={day}
                className="flex flex-col items-center px-2.5 py-1.5 bg-muted/30 rounded text-center min-w-[48px]"
              >
                <span className="text-[10px] text-muted-foreground font-medium">{day}</span>
                <span className="text-sm font-semibold text-foreground">{sku.forecastDailyUsage[i]}</span>
              </div>
            ))}
          </div>
          
          {/* Why? Popover */}
          {!isPaused && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary/80 ml-auto">
                  <HelpCircle className="h-3.5 w-3.5 mr-1" />
                  {t('procurement.IngredientTable.why')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" side="left" align="start">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">{t('procurement.IngredientTable.aiRecommendationBreakdown')}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t('procurement.IngredientTable.basedOnForecastRecipeUsage')}
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('procurement.IngredientTable.forecastUsage')}</span>
                      <span className="font-medium">{breakdown.forecastUsage.toFixed(1)} {sku.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waste ({(breakdown.wasteFactor * 100).toFixed(0)}%):</span>
                      <span className="font-medium text-destructive">+{(breakdown.forecastUsage * breakdown.wasteFactor).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('procurement.IngredientTable.adjustedForecast')}</span>
                      <span className="font-medium">{breakdown.adjustedForecast.toFixed(1)} {sku.unit}</span>
                    </div>
                    {breakdown.safetyStock > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Safety Stock ({(breakdown.safetyStockPct * 100).toFixed(0)}%):</span>
                        <span className="font-medium text-warning">+{breakdown.safetyStock.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('procurement.IngredientTable.onHand')}</span>
                        <span className="font-medium text-success">-{breakdown.onHand.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('procurement.IngredientTable.onOrder')}</span>
                        <span className="font-medium text-success">-{breakdown.onOrder.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>{t('procurement.IngredientTable.netNeeded')}</span>
                        <span>{breakdown.netNeeded.toFixed(1)} {sku.unit}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-primary mt-1">
                        <span>{t('procurement.IngredientTable.recommended')}</span>
                        <span>{breakdown.recommendedPacks} packs</span>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  skus,
  cart,
  dayLabels,
  getRecommendedPacks,
  getRecommendationBreakdown,
  onUpdatePacks,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const itemsInCart = skus.filter(s => (cart.get(s.id) || 0) > {t('procurement.IngredientTable.0lengthReturn')}
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full px-6 py-4 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors border-b border-border">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-foreground text-lg">{category}</h3>
              <Badge variant="secondary" className="text-xs">
                {skus.length} items
              </Badge>
              {itemsInCart > 0 && (
                <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20">
                  {itemsInCart} in cart
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border">
            {skus.map(sku => (
              <IngredientRowDesktop
                key={sku.id}
                sku={sku}
                packs={cart.get(sku.id) || 0}
                recommendedPacks={getRecommendedPacks(sku)}
                breakdown={getRecommendationBreakdown(sku)}
                dayLabels={dayLabels}
                onUpdatePacks={onUpdatePacks}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function IngredientTable({
  
  skus,
  categories,
  cart,
  dayLabels,
  getRecommendedPacks,
  getRecommendationBreakdown,
  onUpdatePacks,
}: IngredientTableProps) {
  const { t } = useTranslation();
  if (skus.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-muted-foreground">{t('procurement.IngredientTable.noIngredientsFoundMatchingYour')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map(category => {
        const categorySkus = skus.filter(s => s.category === category);
        if (categorySkus.length === 0) return null;

        return (
          <CategorySection
            key={category}
            category={category}
            skus={categorySkus}
            cart={cart}
            dayLabels={dayLabels}
            getRecommendedPacks={getRecommendedPacks}
            getRecommendationBreakdown={getRecommendationBreakdown}
            onUpdatePacks={onUpdatePacks}
          />
        );
      })}
    </div>
  );
}
