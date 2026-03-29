import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AutoActionsResult, WasteAutoAction } from '@/hooks/useWasteAutoActions';

interface WasteThresholdConfigProps {
  autoActions: AutoActionsResult;
  wasteTarget: number;
}

export function WasteThresholdConfig({ autoActions, wasteTarget }: WasteThresholdConfigProps) {
  const { actions, thresholds, setThresholds, dismissAction, hasCritical, hasWarning } = autoActions;

  const warningAt = (wasteTarget * thresholds.warningMultiplier).toFixed(1);
  const criticalAt = (wasteTarget * thresholds.criticalMultiplier).toFixed(1);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Auto-Alertas de Merma
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {hasCritical && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-700 border-red-500/30 animate-pulse">
                Crítico activo
              </Badge>
            )}
            {hasWarning && !hasCritical && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 border-amber-500/30">
                Aviso activo
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Active alerts */}
        {actions.length > 0 && (
          <div className="space-y-2">
            {actions.slice(0, 3).map(action => (
              <AlertRow key={action.id} action={action} onDismiss={dismissAction} />
            ))}
            <Separator />
          </div>
        )}

        {/* Threshold config */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-muted-foreground">Umbral de aviso</Label>
              <span className="text-xs font-medium text-amber-600">{thresholds.warningMultiplier}× → {warningAt}%</span>
            </div>
            <Slider
              value={[thresholds.warningMultiplier * 10]}
              min={10}
              max={25}
              step={1}
              onValueChange={([v]) => setThresholds({ ...thresholds, warningMultiplier: v / 10 })}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-muted-foreground">Umbral crítico</Label>
              <span className="text-xs font-medium text-red-600">{thresholds.criticalMultiplier}× → {criticalAt}%</span>
            </div>
            <Slider
              value={[thresholds.criticalMultiplier * 10]}
              min={15}
              max={40}
              step={1}
              onValueChange={([v]) => setThresholds({ ...thresholds, criticalMultiplier: v / 10 })}
              className="w-full"
            />
          </div>
        </div>

        <Separator />

        {/* Notification channels */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Canales de notificación</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs">In-app (toast)</Label>
            </div>
            <Switch
              checked={thresholds.notifyInApp}
              onCheckedChange={(v) => setThresholds({ ...thresholds, notifyInApp: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs">Email</Label>
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">Próximamente</Badge>
            </div>
            <Switch
              checked={thresholds.notifyEmail}
              onCheckedChange={(v) => setThresholds({ ...thresholds, notifyEmail: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs">Push</Label>
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">Próximamente</Badge>
            </div>
            <Switch
              checked={thresholds.notifyPush}
              onCheckedChange={(v) => setThresholds({ ...thresholds, notifyPush: v })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertRow({ action, onDismiss }: { action: WasteAutoAction; onDismiss: (id: string) => void }) {
  const isCritical = action.type === 'critical';

  return (
    <div className={`flex items-start justify-between p-2.5 rounded-lg text-xs ${
      isCritical ? 'bg-red-500/10' : 'bg-amber-500/10'
    }`}>
      <div className="flex-1">
        <p className={`font-medium ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
          {action.title}
        </p>
        <p className="text-muted-foreground mt-0.5">{action.message}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 ml-2"
        onClick={() => onDismiss(action.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
