import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Star, Eye, MousePointer, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuEngineeringItem, MenuEngineeringStats } from '@/hooks/useMenuEngineeringData';

interface MenuDesignGuideProps {
  items: MenuEngineeringItem[];
  stats: MenuEngineeringStats | null;
  loading: boolean;
}

/**
 * Menu Design Guide — Golden Triangle placement recommendations.
 *
 * Based on eye-tracking research:
 * - Zone 1 (center-right): First fixation point → place Stars
 * - Zone 2 (top-right): Second fixation → place Puzzles (high margin, need visibility)
 * - Zone 3 (top-left): Third fixation → place Plow Horses
 * - Bottom/back pages: Dogs (or remove entirely)
 *
 * Also includes visual tricks from menu psychology research.
 */
export function MenuDesignGuide({ items, stats, loading }: MenuDesignGuideProps) {
  if (loading || !stats || items.length < 4) return null;

  const stars = items.filter(i => i.classification === 'star').slice(0, 3);
  const puzzles = items.filter(i => i.classification === 'puzzle').slice(0, 3);
  const plowHorses = items.filter(i => i.classification === 'plow_horse').slice(0, 3);
  const dogs = items.filter(i => i.classification === 'dog').slice(0, 2);

  const zones: Array<{
    zone: string;
    position: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    items: MenuEngineeringItem[];
    tip: string;
  }> = [
    {
      zone: 'Zone 1 — Center',
      position: 'First thing customers see',
      icon: <Star className="h-4 w-4" />,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
      items: stars,
      tip: 'Place your Stars here. Use a box or border to make them stand out.',
    },
    {
      zone: 'Zone 2 — Top Right',
      position: 'Second fixation point',
      icon: <Eye className="h-4 w-4" />,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
      items: puzzles,
      tip: 'Puzzles with high GP go here. Add "Chef\'s Choice" or icon to boost orders.',
    },
    {
      zone: 'Zone 3 — Top Left',
      position: 'Third fixation',
      icon: <MousePointer className="h-4 w-4" />,
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
      items: plowHorses,
      tip: 'Popular items — customers will find them. Don\'t use prime real estate.',
    },
  ];

  const designTips = [
    { icon: '🚫', tip: 'Remove currency symbols (€) — reduces price sensitivity' },
    { icon: '📦', tip: 'Box or highlight 1-2 items per section — draws the eye' },
    { icon: '📝', tip: 'Add appetizing descriptions for Puzzles — boosts orders 27%' },
    { icon: '🎯', tip: 'Limit choices to 7±2 per category — prevents decision paralysis' },
    { icon: '📐', tip: 'Use a two-panel menu — gives you the best Golden Triangle layout' },
  ];

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-blue-500" />
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-emerald-600" />
          Menu Design Guide
          <Badge variant="secondary" className="text-[10px] font-normal">Golden Triangle</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Where to place each dish on your physical menu based on eye-tracking research
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Golden Triangle Zones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {zones.map((zone, idx) => (
            <div key={idx} className={cn('rounded-lg border p-3 space-y-2', zone.bg)}>
              <div className="flex items-center gap-2">
                <span className={zone.color}>{zone.icon}</span>
                <div>
                  <h4 className={cn('text-sm font-semibold', zone.color)}>{zone.zone}</h4>
                  <p className="text-[10px] text-muted-foreground">{zone.position}</p>
                </div>
              </div>
              <ul className="space-y-1">
                {zone.items.map((item, i) => (
                  <li key={i} className="text-xs font-medium">{item.name}</li>
                ))}
                {zone.items.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">No items in this quadrant</li>
                )}
              </ul>
              <p className="text-[10px] text-muted-foreground border-t pt-1.5 border-current/10">{zone.tip}</p>
            </div>
          ))}
        </div>

        {/* Dogs warning */}
        {dogs.length > 0 && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-600">🔍</span>
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">
                Consider removing — {dogs.map(d => d.name).join(', ')}
              </h4>
            </div>
            <p className="text-[10px] text-muted-foreground">
              These items have low popularity AND low profit. Unless they serve a strategic purpose (dietary option, kids menu), they add complexity without return.
            </p>
          </div>
        )}

        {/* Design Tips */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2 border-t">
          {designTips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <span className="text-sm leading-none mt-0.5">{tip.icon}</span>
              <span>{tip.tip}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
