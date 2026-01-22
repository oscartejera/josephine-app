import { useState } from 'react';
import { Settings, ChefHat, Wine, Utensils } from 'lucide-react';
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
import type { KDSAlertSettings } from '@/hooks/useKDSAlerts';

interface KDSAlertSettingsDialogProps {
  settings: KDSAlertSettings;
  onUpdateSettings: (settings: Partial<KDSAlertSettings>) => void;
}

export function KDSAlertSettingsDialog({ settings, onUpdateSettings }: KDSAlertSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onUpdateSettings(localSettings);
    setOpen(false);
  };

  const destinations = [
    { key: 'kitchen' as const, label: 'Cocina', icon: ChefHat, color: 'text-orange-400' },
    { key: 'bar' as const, label: 'Bar', icon: Wine, color: 'text-purple-400' },
    { key: 'prep' as const, label: 'Preparación', icon: Utensils, color: 'text-blue-400' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
        >
          <Settings className="h-4 w-4 mr-2" />
          Alertas
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Configurar Alertas de Tiempo</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Define el tiempo máximo de preparación (en minutos) antes de activar una alerta para cada estación.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
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
                <Label className="text-zinc-400 text-sm">minutos</Label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800"
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
