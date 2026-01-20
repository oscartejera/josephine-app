import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Settings, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export interface CategorySettings {
  wasteFactor: number;
  safetyStockPct: number;
  yieldFactor: number;
}

export interface ProcurementCategorySettings {
  [category: string]: CategorySettings;
}

// Default settings per category
export const DEFAULT_CATEGORY_SETTINGS: ProcurementCategorySettings = {
  'Produce': { wasteFactor: 0.06, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Proteins': { wasteFactor: 0.05, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Dairy': { wasteFactor: 0.03, safetyStockPct: 0.15, yieldFactor: 1.0 },
  'Dry Goods': { wasteFactor: 0.01, safetyStockPct: 0.10, yieldFactor: 1.0 },
  'Beverages': { wasteFactor: 0.01, safetyStockPct: 0.10, yieldFactor: 1.0 },
  'Bakery': { wasteFactor: 0.04, safetyStockPct: 0.20, yieldFactor: 1.0 },
  'Condiments': { wasteFactor: 0.02, safetyStockPct: 0.10, yieldFactor: 1.0 },
};

interface ProcurementSettingsDialogProps {
  categorySettings: ProcurementCategorySettings;
  onSettingsChange: (settings: ProcurementCategorySettings) => void;
}

export function ProcurementSettingsDialog({
  categorySettings,
  onSettingsChange,
}: ProcurementSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<ProcurementCategorySettings>(categorySettings);

  useEffect(() => {
    setLocalSettings(categorySettings);
  }, [categorySettings, open]);

  const categories = Object.keys(DEFAULT_CATEGORY_SETTINGS);

  const handleCategoryChange = (category: string, field: keyof CategorySettings, value: number) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_CATEGORY_SETTINGS);
  };

  const handleResetCategory = (category: string) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: DEFAULT_CATEGORY_SETTINGS[category],
    }));
  };

  // Check if any settings are modified
  const hasModifications = categories.some(category => {
    const settings = localSettings[category] || DEFAULT_CATEGORY_SETTINGS[category];
    const defaults = DEFAULT_CATEGORY_SETTINGS[category];
    return (
      settings.wasteFactor !== defaults.wasteFactor ||
      settings.safetyStockPct !== defaults.safetyStockPct ||
      settings.yieldFactor !== defaults.yieldFactor
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Procurement Settings</DialogTitle>
          <DialogDescription>
            Configure waste factors, safety stock, and yield factors for each category.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 text-muted-foreground"
                disabled={!hasModifications}
              >
                <RotateCcw className="h-4 w-4" />
                Reset All to Defaults
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all category settings (waste factors, safety stock, and yield factors) to their default values. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {categories.map((category) => {
              const settings = localSettings[category] || DEFAULT_CATEGORY_SETTINGS[category];
              const defaults = DEFAULT_CATEGORY_SETTINGS[category];
              const isModified =
                settings.wasteFactor !== defaults.wasteFactor ||
                settings.safetyStockPct !== defaults.safetyStockPct ||
                settings.yieldFactor !== defaults.yieldFactor;

              return (
                <div key={category} className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{category}</h4>
                      {isModified && (
                        <Badge variant="secondary" className="text-xs">Modified</Badge>
                      )}
                    </div>
                    {isModified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetCategory(category)}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        Reset
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Waste Factor */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Waste Factor
                      </Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[settings.wasteFactor * 100]}
                          onValueChange={([val]) => handleCategoryChange(category, 'wasteFactor', val / 100)}
                          min={0}
                          max={20}
                          step={0.5}
                          className="flex-1"
                        />
                        <span className="w-12 text-right text-sm font-medium text-destructive">
                          {(settings.wasteFactor * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Safety Stock */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Safety Stock
                      </Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[settings.safetyStockPct * 100]}
                          onValueChange={([val]) => handleCategoryChange(category, 'safetyStockPct', val / 100)}
                          min={0}
                          max={50}
                          step={1}
                          className="flex-1"
                        />
                        <span className="w-12 text-right text-sm font-medium text-warning">
                          {(settings.safetyStockPct * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Yield Factor */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Yield Factor
                      </Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[settings.yieldFactor * 100]}
                          onValueChange={([val]) => handleCategoryChange(category, 'yieldFactor', val / 100)}
                          min={50}
                          max={100}
                          step={1}
                          className="flex-1"
                        />
                        <span className="w-12 text-right text-sm font-medium text-foreground">
                          {(settings.yieldFactor * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
