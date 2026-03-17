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
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (prefs: ConsentPreferences) => {t('gdpr.CookiePreferencesDialog.voidInitialprefsPartial')}<ConsentPreferences>;
}

export function CookiePreferencesDialog({ open, onOpenChange, onSave, initialPrefs }: Props) {
  const { t } = useTranslation();
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
          <DialogTitle>{t('gdpr.CookiePreferencesDialog.preferenciasDeCookies')}</DialogTitle>
          <DialogDescription>
            {t('gdpr.CookiePreferencesDialog.eligeQueTiposDeCookies')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Essential — always on */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <Label className="text-sm font-medium">{t('gdpr.CookiePreferencesDialog.esenciales')}</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('gdpr.CookiePreferencesDialog.necesariasParaElFuncionamientoDe')}
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
                  {t('gdpr.CookiePreferencesDialog.analiticas')}
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('gdpr.CookiePreferencesDialog.nosAyudanAEntenderComo')}
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
                  {t('gdpr.CookiePreferencesDialog.marketing')}
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('gdpr.CookiePreferencesDialog.permitenMostrarContenidoYComunicaciones')}
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
            {t('gdpr.CookiePreferencesDialog.cancelar')}
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            {t('gdpr.CookiePreferencesDialog.guardarPreferencias')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
