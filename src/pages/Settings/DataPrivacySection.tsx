/**
 * DataPrivacySection — GDPR data rights in Settings page.
 *
 * - Export personal data (JSON download)
 * - Delete account (30-day grace period)
 * - Manage cookie preferences
 */

import { useState } from 'react';
import { Download, Trash2, Cookie, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CookiePreferencesDialog } from '@/components/gdpr/CookiePreferencesDialog';
import { getConsent, type ConsentPreferences } from '@/components/gdpr/CookieConsentBanner';
import { useTranslation } from 'react-i18next';

export function DataPrivacySection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCookiePrefs, setShowCookiePrefs] = useState(false);

  const handleExportData = async () => {
    if (!user?.id) return;
    setExporting(true);

    try {
      // Collect all user data from accessible tables
      const [profileRes, recipesRes, menuItemsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('recipes').select('*').limit(1000),
        supabase.from('menu_items').select('*').limit(1000),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        profile: profileRes.data,
        recipes: recipesRes.data || [],
        menu_items: menuItemsRes.data || [],
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `josephine-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: t('settings.dataExported'),
        description: 'Tu archivo de datos se ha descargado correctamente.',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: t('settings.exportError'),
        description: 'No se pudieron exportar los datos. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleting(true);

    try {
      const { error } = await supabase.from('deletion_requests').insert({
        user_id: user.id,
        status: 'pending',
        scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      toast({
        title: t('settings.requestRegistered'),
        description: 'Tu cuenta se eliminará en 30 días. Puedes cancelar desde este panel.',
      });
      setShowDelete(false);
    } catch (error) {
      console.error('Delete request error:', error);
      toast({
        title: t("common.error"),
        description: 'No se pudo procesar la solicitud. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const currentConsent = getConsent();

  const handleSavePreferences = (prefs: ConsentPreferences) => {
    localStorage.setItem('josephine_consent', JSON.stringify(prefs));
    setShowCookiePrefs(false);
    toast({ title: t('settings.preferencesUpdated') });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.privacidadYDatos')}</CardTitle>
          <CardDescription>
            Gestiona tus datos personales según tus derechos RGPD.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cookie Preferences */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Cookie className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">{t("settings.cookiePreferences")}</p>
                <p className="text-xs text-gray-500">
                  {currentConsent
                    ? `Analíticas: ${currentConsent.analytics ? 'Sí' : 'No'} · Marketing: ${currentConsent.marketing ? 'Sí' : 'No'}`
                    : t('settings.sinConfigurar')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowCookiePrefs(true)}>
              Gestionar
            </Button>
          </div>

          {/* Export Data */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">{t("settings.exportMyData")}</p>
                <p className="text-xs text-gray-500">
                  Descarga una copia de todos tus datos en formato JSON.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Exportar
            </Button>
          </div>

          {/* Delete Account */}
          <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-4">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">{t("settings.deleteMyAccount")}</p>
                <p className="text-xs text-red-600/80">
                  Todos tus datos se eliminarán tras 30 días de gracia.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDelete(true)}
            >
              Solicitar eliminación
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ¿Eliminar tu cuenta?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción programará la eliminación de tu cuenta y todos los datos asociados
              en un plazo de 30 días. Durante ese periodo puedes cancelar la solicitud.
              Después de los 30 días, los datos se eliminarán permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Sí, eliminar mi cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CookiePreferencesDialog
        open={showCookiePrefs}
        onOpenChange={setShowCookiePrefs}
        onSave={handleSavePreferences}
        initialPrefs={currentConsent ?? undefined}
      />
    </>
  );
}
