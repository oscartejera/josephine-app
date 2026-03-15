/**
 * CookiePreferencesDialog — Granular cookie preference management.
 *
 * Shows toggles for Analytics and Marketing cookies.
 * Essential cookies are always on (cannot be disabled).
 */

import { useState } from 'react';
import { Shield, BarChart3, Megaphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { ConsentPreferences } from './CookieConsentBanner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (prefs: ConsentPreferences) => void;
  initialPrefs?: Partial<ConsentPreferences>;
}

export function CookiePreferencesDialog({ open, onOpenChange, onSave, initialPrefs }: Props) {
  const [analytics, setAnalytics] = useState(initialPrefs?.analytics ?? false);
  const [marketing, setMarketing] = useState(initialPrefs?.marketing ?? false);

  const handleSave = () => {
    onSave({
      essential: true,
      analytics,
      marketing,
      timestamp: Date.now(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preferencias de cookies</DialogTitle>
          <DialogDescription>
            Elige qué tipos de cookies deseas aceptar. Las cookies esenciales no se pueden desactivar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Essential — always on */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <Label className="text-sm font-medium">Esenciales</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Necesarias para el funcionamiento de la aplicación.
                  Incluyen autenticación, seguridad y preferencias básicas.
                </p>
              </div>
            </div>
            <Switch checked disabled className="data-[state=checked]:bg-emerald-600" />
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <Label htmlFor="analytics-toggle" className="text-sm font-medium cursor-pointer">
                  Analíticas
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Nos ayudan a entender cómo usas la aplicación para mejorarla.
                  No se comparten con terceros.
                </p>
              </div>
            </div>
            <Switch
              id="analytics-toggle"
              checked={analytics}
              onCheckedChange={setAnalytics}
            />
          </div>

          {/* Marketing */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <Megaphone className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <Label htmlFor="marketing-toggle" className="text-sm font-medium cursor-pointer">
                  Marketing
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Permiten mostrar contenido y comunicaciones personalizadas.
                  Puedes revocar el consentimiento en cualquier momento.
                </p>
              </div>
            </div>
            <Switch
              id="marketing-toggle"
              checked={marketing}
              onCheckedChange={setMarketing}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            Guardar preferencias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
