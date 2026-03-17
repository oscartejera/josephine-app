import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RecommendationSettings } from '@/hooks/useProcurementData';

interface AIRecommendPanelProps {
  settings: RecommendationSettings;
  onSettingsChange: (settings: RecommendationSettings) => void;
  onRecommend: () => void;
  isCalculating: boolean;
}

export function AIRecommendPanel({
  settings,
  onSettingsChange,
  onRecommend,
  isCalculating,
}: AIRecommendPanelProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* AI Recommend Button */}
        <Button 
          size="lg" 
          onClick={onRecommend}
          disabled={isCalculating}
          className="gap-2"
        >
          {isCalculating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating coverage...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              AI Recommend ({settings.horizon} days)
            </>
          )}
        </Button>

        {/* Horizon Selector */}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Horizon:</Label>
          <Select 
            value={settings.horizon.toString()} 
            onValueChange={(v) => onSettingsChange({ ...settings, horizon: parseInt(v) as 7 | 14 | 30 })}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Safety Stock Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="safety-stock"
            checked={settings.includeSafetyStock}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, includeSafetyStock: checked })}
          />
          <Label htmlFor="safety-stock" className="text-sm cursor-pointer">
            Include safety stock
          </Label>
        </div>

        {/* Round to Packs Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="round-packs"
            checked={settings.roundToPacks}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, roundToPacks: checked })}
          />
          <Label htmlFor="round-packs" className="text-sm cursor-pointer">
            Round to packs
          </Label>
        </div>
      </div>
    </div>
  );
}
