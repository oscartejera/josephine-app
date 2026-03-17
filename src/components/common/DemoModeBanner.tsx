import { useDemoMode } from '@/contexts/DemoModeContext';
import { Badge } from '@/components/ui/badge';
import { FlaskConical } from 'lucide-react';

export function DemoModeBanner() {
  const { isDemoMode, demoLabel } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-center gap-2">
      <FlaskConical className="h-4 w-4 text-warning" />
      <span className="text-sm font-medium text-warning">
        {demoLabel}
      </span>
      <Badge variant="outline" className="text-xs border-warning/30 text-warning">
        DEMO
      </Badge>
    </div>
  );
}
