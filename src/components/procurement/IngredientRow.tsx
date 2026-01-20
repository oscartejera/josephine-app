import { Minus, Plus, Pause, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { IngredientSku, RecommendationBreakdown } from '@/hooks/useProcurementData';

interface IngredientRowProps {
  sku: IngredientSku;
  packs: number;
  recommendedPacks: number;
  breakdown: RecommendationBreakdown;
  dayLabels: string[];
  onUpdatePacks: (skuId: string, packs: number) => void;
}

export function IngredientRow({
  sku,
  packs,
  recommendedPacks,
  breakdown,
  dayLabels,
  onUpdatePacks,
}: IngredientRowProps) {
  const isPaused = sku.paused;

  return (
    <div className={`p-4 border-b border-border last:border-b-0 ${isPaused ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        {/* Left: Name & pack size */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">{sku.name}</h4>
            {isPaused && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="gap-1">
                    <Pause className="h-3 w-3" />
                    Paused
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{sku.pauseReason || 'This item is temporarily paused'}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Badge variant="outline" className="mt-1.5 font-normal">
            {sku.packSize}
          </Badge>
          
          {/* Daily usage row */}
          <div className="mt-3 flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-2 shrink-0">Daily usage:</span>
            <div className="flex gap-1 overflow-x-auto">
              {dayLabels.map((day, i) => (
                <div
                  key={day}
                  className="flex flex-col items-center px-2 py-1 bg-muted/50 rounded text-center min-w-[42px]"
                >
                  <span className="text-[10px] text-muted-foreground">{day}</span>
                  <span className="text-xs font-medium text-foreground">{sku.forecastDailyUsage[i]}</span>
                </div>
              ))}
            </div>
            
            {/* Why? Popover */}
            {!isPaused && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground ml-2">
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Why?
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="right" align="start">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Recommendation Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Forecast Usage:</span>
                        <span className="font-medium">{breakdown.forecastUsage.toFixed(1)} {sku.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Waste Factor ({(breakdown.wasteFactor * 100).toFixed(0)}%):</span>
                        <span className="font-medium text-destructive">+{(breakdown.forecastUsage * breakdown.wasteFactor).toFixed(1)} {sku.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Yield Factor ({(breakdown.yieldFactor * 100).toFixed(0)}%):</span>
                        <span className="font-medium">{breakdown.adjustedForecast.toFixed(1)} {sku.unit}</span>
                      </div>
                      {breakdown.safetyStock > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Safety Stock ({(breakdown.safetyStockPct * 100).toFixed(0)}%):</span>
                          <span className="font-medium text-warning">+{breakdown.safetyStock.toFixed(1)} {sku.unit}</span>
                        </div>
                      )}
                      <div className="border-t border-border pt-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">On Hand:</span>
                          <span className="font-medium text-success">-{breakdown.onHand.toFixed(1)} {sku.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">On Order:</span>
                          <span className="font-medium text-success">-{breakdown.onOrder.toFixed(1)} {sku.unit}</span>
                        </div>
                      </div>
                      <div className="border-t border-border pt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Net Needed:</span>
                          <span>{breakdown.netNeeded.toFixed(1)} {sku.unit}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-primary">
                          <span>Recommended:</span>
                          <span>{breakdown.recommendedPacks} packs ({(breakdown.recommendedPacks * sku.packSizeUnits).toFixed(1)} {sku.unit})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        
        {/* Right: Stepper + price */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {!isPaused && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdatePacks(sku.id, Math.max(0, packs - 1))}
                  disabled={packs === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-semibold text-foreground">{packs}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdatePacks(sku.id, packs + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              £{(packs * sku.unitPrice).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              £{sku.unitPrice.toFixed(2)}/pack
            </p>
          </div>
          
          {recommendedPacks > 0 && packs === 0 && !isPaused && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary h-auto py-1"
              onClick={() => onUpdatePacks(sku.id, recommendedPacks)}
            >
              Add {recommendedPacks} recommended
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
