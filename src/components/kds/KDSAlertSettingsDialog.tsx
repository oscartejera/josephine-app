import { useState } from 'react';
import { Settings, ChefHat, Wine, Volume2, VolumeX, Flame, Bell, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { KDSAlertSettings, KDSSoundSettings } from '@/hooks/useKDSAlerts';
import { DEFAULT_SOUND_SETTINGS } from '@/hooks/useKDSAlerts';
import { cn } from '@/lib/utils';

interface KDSAlertSettingsDialogProps {
  settings: KDSAlertSettings;
  onUpdateSettings: (settings: Partial<KDSAlertSettings>) => void;
  soundSettings?: KDSSoundSettings;
  onUpdateSoundSettings?: (settings: Partial<KDSSoundSettings>) => void;
  onTestSound?: (station: 'kitchen' | 'bar' | 'rush' | 'newOrder') => void;
}

export function KDSAlertSettingsDialog({ 
  settings, 
  onUpdateSettings,
  soundSettings = DEFAULT_SOUND_SETTINGS,
  onUpdateSoundSettings,
  onTestSound,
}: KDSAlertSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [localSoundSettings, setLocalSoundSettings] = useState(soundSettings);

  const handleSave = () => {
    onUpdateSettings(localSettings);
    if (onUpdateSoundSettings) {
      onUpdateSoundSettings(localSoundSettings);
    }
    setOpen(false);
  };

  const destinations = [
    { key: 'kitchen' as const, label: 'Cocina', icon: ChefHat, color: 'text-orange-400', soundKey: 'kitchenEnabled' as const },
    { key: 'bar' as const, label: 'Bar', icon: Wine, color: 'text-purple-400', soundKey: 'barEnabled' as const },
  ];

  const soundTypes = [
    { key: 'kitchen' as const, label: 'Cocina', icon: ChefHat, color: 'bg-orange-500/20 text-orange-400 border-orange-500', settingKey: 'kitchenEnabled' as const },
    { key: 'bar' as const, label: 'Bar', icon: Wine, color: 'bg-purple-500/20 text-purple-400 border-purple-500', settingKey: 'barEnabled' as const },
    { key: 'rush' as const, label: 'Rush', icon: Flame, color: 'bg-amber-500/20 text-amber-400 border-amber-500', settingKey: 'rushEnabled' as const },
    { key: 'newOrder' as const, label: 'Nueva', icon: Bell, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500', settingKey: 'newOrderEnabled' as const },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
        >
          <Settings className="h-4 w-4 mr-2" />
          Alertas
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Configuración KDS</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Ajusta los tiempos de alerta y los sonidos para cada estación.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="times" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
            <TabsTrigger value="times" className="data-[state=active]:bg-zinc-700">
              Tiempos
            </TabsTrigger>
            <TabsTrigger value="sounds" className="data-[state=active]:bg-zinc-700">
              Sonidos
            </TabsTrigger>
          </TabsList>

          {/* Times Tab */}
          <TabsContent value="times" className="space-y-4 mt-4">
            <p className="text-sm text-zinc-400">
              Tiempo máximo de preparación (minutos) antes de activar alerta:
            </p>
            {destinations.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="flex items-center gap-4">
                <div className={`flex items-center gap-2 w-32 ${color}`}>
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={localSettings[key]}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      [key]: parseInt(e.target.value) || 1
                    }))}
                    className="bg-zinc-800 border-zinc-700 text-white w-20 text-center"
                  />
                  <Label className="text-zinc-400 text-sm">min</Label>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Sounds Tab */}
          <TabsContent value="sounds" className="space-y-6 mt-4">
            {/* Master Enable */}
            <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
              <div className="flex items-center gap-3">
                {localSoundSettings.enabled ? (
                  <Volume2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <VolumeX className="h-5 w-5 text-zinc-500" />
                )}
                <div>
                  <p className="font-medium">Sonidos activados</p>
                  <p className="text-xs text-zinc-400">Habilita/deshabilita todos los sonidos</p>
                </div>
              </div>
              <Switch
                checked={localSoundSettings.enabled}
                onCheckedChange={(enabled) => 
                  setLocalSoundSettings(prev => ({ ...prev, enabled }))
                }
              />
            </div>

            {/* Volume Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Volumen</Label>
                <span className="text-sm text-zinc-400">{localSoundSettings.volume}%</span>
              </div>
              <Slider
                value={[localSoundSettings.volume]}
                onValueChange={([volume]) => 
                  setLocalSoundSettings(prev => ({ ...prev, volume }))
                }
                max={100}
                step={5}
                className="w-full"
                disabled={!localSoundSettings.enabled}
              />
            </div>

            {/* Individual Sound Toggles */}
            <div className="space-y-3">
              <Label className="text-sm text-zinc-400">Sonidos por tipo</Label>
              <div className="grid grid-cols-1 gap-2">
                {soundTypes.map(({ key, label, icon: Icon, color, settingKey }) => (
                  <div 
                    key={key}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      localSoundSettings[settingKey] ? color : "bg-zinc-800/50 text-zinc-500 border-zinc-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {onTestSound && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onTestSound(key)}
                          disabled={!localSoundSettings.enabled}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      <Switch
                        checked={localSoundSettings[settingKey]}
                        onCheckedChange={(checked) => 
                          setLocalSoundSettings(prev => ({ ...prev, [settingKey]: checked }))
                        }
                        disabled={!localSoundSettings.enabled}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
