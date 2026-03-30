import { useState } from 'react';
import { Bell, BellOff, BellRing, Clock, Send, AlertTriangle, CalendarX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import type { WasteNotifState } from '@/hooks/useWasteNotifications';

interface WasteNotificationSettingsProps {
  notifState: WasteNotifState;
}

export function WasteNotificationSettings({ notifState }: WasteNotificationSettingsProps) {
  const { permission, prefs, setPrefs, requestPermission, sendTestNotification, lastReminderSent } = notifState;
  const [requesting, setRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setRequesting(true);
    await requestPermission();
    setRequesting(false);
  };

  const permissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><BellRing className="h-3 w-3 mr-1" /> Activadas</Badge>;
      case 'denied':
        return <Badge variant="destructive"><BellOff className="h-3 w-3 mr-1" /> Bloqueadas</Badge>;
      case 'unsupported':
        return <Badge variant="secondary">No soportado</Badge>;
      default:
        return <Badge variant="outline"><Bell className="h-3 w-3 mr-1" /> Pendiente</Badge>;
    }
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45];

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notificaciones Push
          </span>
          {permissionBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permission request */}
        {permission === 'default' && (
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-sm text-muted-foreground mb-2">
              Activa las notificaciones para recibir recordatorios de merma.
            </p>
            <Button
              size="sm"
              onClick={handleRequestPermission}
              disabled={requesting}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              {requesting ? 'Solicitando...' : 'Activar notificaciones'}
            </Button>
          </div>
        )}

        {permission === 'denied' && (
          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="text-sm text-red-600">
              Las notificaciones están bloqueadas. Para activarlas, ve a la configuración de tu navegador y permite notificaciones para este sitio.
            </p>
          </div>
        )}

        {/* Settings — only show if granted */}
        {permission === 'granted' && (
          <>
            {/* Master toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-enabled" className="text-sm font-medium">
                Notificaciones activas
              </Label>
              <Switch
                id="notif-enabled"
                checked={prefs.enabled}
                onCheckedChange={(v) => setPrefs({ ...prefs, enabled: v })}
              />
            </div>

            {prefs.enabled && (
              <>
                {/* Daily reminder */}
                <div className="p-3 rounded-xl bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="daily-reminder" className="text-sm">
                        Recordatorio diario
                      </Label>
                    </div>
                    <Switch
                      id="daily-reminder"
                      checked={prefs.dailyReminder}
                      onCheckedChange={(v) => setPrefs({ ...prefs, dailyReminder: v })}
                    />
                  </div>

                  {prefs.dailyReminder && (
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-xs text-muted-foreground">Hora:</span>
                      <Select
                        value={String(prefs.dailyReminderHour)}
                        onValueChange={(v) => setPrefs({ ...prefs, dailyReminderHour: parseInt(v) })}
                      >
                        <SelectTrigger className="w-[70px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {hourOptions.map(h => (
                            <SelectItem key={h} value={String(h)}>
                              {String(h).padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs">:</span>
                      <Select
                        value={String(prefs.dailyReminderMinute)}
                        onValueChange={(v) => setPrefs({ ...prefs, dailyReminderMinute: parseInt(v) })}
                      >
                        <SelectTrigger className="w-[70px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {minuteOptions.map(m => (
                            <SelectItem key={m} value={String(m)}>
                              {String(m).padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {lastReminderSent && (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          Último: {lastReminderSent}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Missing data alert */}
                <div className="p-3 rounded-xl bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarX className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="missing-alert" className="text-sm">
                        Alerta sin datos
                      </Label>
                    </div>
                    <Switch
                      id="missing-alert"
                      checked={prefs.missingDataAlert}
                      onCheckedChange={(v) => setPrefs({ ...prefs, missingDataAlert: v })}
                    />
                  </div>

                  {prefs.missingDataAlert && (
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-xs text-muted-foreground">Alertar tras</span>
                      <Select
                        value={String(prefs.missingDataDays)}
                        onValueChange={(v) => setPrefs({ ...prefs, missingDataDays: parseInt(v) })}
                      >
                        <SelectTrigger className="w-[60px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 5, 7].map(d => (
                            <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">días sin registros</span>
                    </div>
                  )}
                </div>

                {/* Threshold alert */}
                <div className="p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="threshold-alert" className="text-sm">
                        Alertas de umbral
                      </Label>
                    </div>
                    <Switch
                      id="threshold-alert"
                      checked={prefs.thresholdAlert}
                      onCheckedChange={(v) => setPrefs({ ...prefs, thresholdAlert: v })}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground ml-6 mt-1">
                    Push cuando la merma supera el objetivo configurado
                  </p>
                </div>

                {/* Test button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={sendTestNotification}
                >
                  <Send className="h-3 w-3" />
                  Enviar notificación de prueba
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
