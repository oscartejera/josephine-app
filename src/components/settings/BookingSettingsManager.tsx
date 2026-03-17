import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Globe, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BookingSettings {
  id: string;
  name: string;
  public_name: string | null;
  address: string | null;
  phone: string | null;
  booking_enabled: boolean;
  booking_min_party: number;
  booking_max_party: number;
  booking_advance_days: number;
  booking_time_slots: string[];
  booking_closed_days: number[];
  booking_notes: string | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: t('settings.miercoles') },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: t('settings.sabado') },
];

const DEFAULT_TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
];

export function BookingSettingsManager() {
  const { t } = useTranslation();
  const { locations } = useApp();
  const { toast } = useToast();
  const [selectedLocationId, setSelectedLocationId] = useState<string>{t('settings.BookingSettingsManager.constSettingsSetsettingsUsestate')}<BookingSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    public_name: '',
    address: '',
    phone: '',
    booking_enabled: false,
    booking_min_party: 1,
    booking_max_party: 12,
    booking_advance_days: 30,
    booking_time_slots: DEFAULT_TIME_SLOTS,
    booking_closed_days: [] as number[],
    booking_notes: '',
  });

  // Load settings when location changes
  useEffect(() => {
    if (!selectedLocationId) {
      setSettings(null);
      return;
    }

    const fetchSettings = async () => {
      setLoading(true);
      try {
        // Use raw query since new columns may not be in generated types yet
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .eq('id', selectedLocationId)
          .single();

        if (error) throw error;

        const rawData = data as Record<string, unknown>;
        
        const settingsData: BookingSettings = {
          id: rawData.id as string,
          name: rawData.name as string,
          public_name: rawData.public_name as string | null,
          address: rawData.address as string | null,
          phone: rawData.phone as string | null,
          booking_enabled: (rawData.booking_enabled as boolean) || false,
          booking_min_party: (rawData.booking_min_party as number) || 1,
          booking_max_party: (rawData.booking_max_party as number) || 12,
          booking_advance_days: (rawData.booking_advance_days as number) || 30,
          booking_time_slots: (rawData.booking_time_slots as string[]) || DEFAULT_TIME_SLOTS,
          booking_closed_days: (rawData.booking_closed_days as number[]) || [],
          booking_notes: rawData.booking_notes as string | null,
        };

        setSettings(settingsData);
        setFormData({
          public_name: settingsData.public_name || '',
          address: settingsData.address || '',
          phone: settingsData.phone || '',
          booking_enabled: settingsData.booking_enabled,
          booking_min_party: settingsData.booking_min_party,
          booking_max_party: settingsData.booking_max_party,
          booking_advance_days: settingsData.booking_advance_days,
          booking_time_slots: settingsData.booking_time_slots,
          booking_closed_days: settingsData.booking_closed_days,
          booking_notes: settingsData.booking_notes || '',
        });
      } catch (err) {
        console.error('Error fetching booking settings:', err);
        toast({
          title: t("common.error"),
          description: 'No se pudieron cargar los ajustes de reservas',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [selectedLocationId, toast]);

  const handleSave = async () => {
    if (!selectedLocationId) return;

    setSaving(true);
    try {
      // Use raw update since new columns may not be in generated types yet
      const updateData = {
        public_name: formData.public_name || null,
        address: formData.address || null,
        phone: formData.phone || null,
        booking_enabled: formData.booking_enabled,
        booking_min_party: formData.booking_min_party,
        booking_max_party: formData.booking_max_party,
        booking_advance_days: formData.booking_advance_days,
        booking_time_slots: formData.booking_time_slots,
        booking_closed_days: formData.booking_closed_days,
        booking_notes: formData.booking_notes || null,
      };
      
      const { error } = await supabase
        .from('locations')
        .update(updateData as never)
        .eq('id', selectedLocationId);

      if (error) throw error;

      toast({
        title: t('common.saved'),
        description: 'Los ajustes de reservas se han guardado correctamente',
      });
    } catch (err) {
      console.error('Error saving booking settings:', err);
      toast({
        title: t("common.error"),
        description: t('settings.noSePudieronGuardarLos'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleTimeSlot = (slot: string) => {
    setFormData((prev) => ({
      ...prev,
      booking_time_slots: prev.booking_time_slots.includes(slot)
        ? prev.booking_time_slots.filter((s) => s !== slot)
        : [...prev.booking_time_slots, slot].sort(),
    }));
  };

  const toggleClosedDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      booking_closed_days: prev.booking_closed_days.includes(day)
        ? prev.booking_closed_days.filter((d) => d !== day)
        : [...prev.booking_closed_days, day],
    }));
  };

  const widgetUrl = selectedLocationId
    ? `${window.location.origin}/book/${selectedLocationId}`
    : '';

  const embedCode = selectedLocationId
    ? `<!-- Widget de Reservas - ${settings?.name || t('settings.restaurante')} -->
<iframe 
  src="${widgetUrl}"
  width="100%" 
  height="700"
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
  title={t('settings.BookingSettingsManager.reservarMesa')}
></iframe>`
    : '';

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: t('common.copiedToClipboard') });
    } catch {
      toast({ title: t('common.copyError'), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Location Selector */}
      <div className="space-y-2">
        <Label>{t('settings.seleccionaUbicacion')}</Label>
        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder={t('settings.eligeUnaUbicacion')} />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedLocationId && (
        <Alert>
          <AlertDescription>{t("settings.selectLocationForBooking")}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {selectedLocationId && settings && !loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Settings Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('settings.BookingSettingsManager.configuracionDeReservasOnline')}
              </CardTitle>
              <CardDescription>
                {t('settings.BookingSettingsManager.configuraComoLosClientesPueden')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("settings.enableOnlineBooking")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.BookingSettingsManager.losClientesPodranReservarDesde')}
                  </p>
                </div>
                <Switch
                  checked={formData.booking_enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, booking_enabled: checked }))
                  }
                />
              </div>

              {/* Public Info */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">{t('settings.informacionPublica')}</h4>
                <div className="space-y-2">
                  <Label htmlFor="public_name">{t('settings.nombrePublico')}</Label>
                  <Input
                    id="public_name"
                    value={formData.public_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, public_name: e.target.value }))
                    }
                    placeholder={settings.name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t('settings.direccion')}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder={t('settings.BookingSettingsManager.callePrincipal123')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('settings.telefono')}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+34 900 000 000"
                  />
                </div>
              </div>

              {/* Party Size */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">{t("settings.peopleLimits")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('settings.minimo')}</Label>
                    <Select
                      value={String(formData.booking_min_party)}
                      onValueChange={(v) =>
                        setFormData((prev) => ({ ...prev, booking_min_party: Number(v) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.maximo')}</Label>
                    <Select
                      value={String(formData.booking_max_party)}
                      onValueChange={(v) =>
                        setFormData((prev) => ({ ...prev, booking_max_party: Number(v) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[4, 6, 8, 10, 12, 15, 20, 25, 30].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Advance Days */}
              <div className="space-y-2 border-t pt-4">
                <Label>{t("settings.maxAdvanceDays")}</Label>
                <Select
                  value={String(formData.booking_advance_days)}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, booking_advance_days: Number(v) }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[7, 14, 30, 60, 90].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} días
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Time Slots */}
              <div className="space-y-3 border-t pt-4">
                <Label>{t('settings.BookingSettingsManager.horariosDisponibles')}</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_TIME_SLOTS.map((slot) => (
                    <Badge
                      key={slot}
                      variant={formData.booking_time_slots.includes(slot) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTimeSlot(slot)}
                    >
                      {slot}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Closed Days */}
              <div className="space-y-3 border-t pt-4">
                <Label>{t('settings.diasCerrados')}</Label>
                <div className="flex flex-wrap gap-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.booking_closed_days.includes(day.value)}
                        onCheckedChange={() => toggleClosedDay(day.value)}
                      />
                      <Label htmlFor={`day-${day.value}`} className="text-sm font-normal cursor-pointer">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="booking_notes">{t("settings.customerNotes")}</Label>
                <Textarea
                  id="booking_notes"
                  value={formData.booking_notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, booking_notes: e.target.value }))
                  }
                  placeholder={t('settings.informacionImportanteQueLosClientes')}
                  rows={3}
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('settings.BookingSettingsManager.guardando')}
                  </>
                ) : (
                  t('settings.guardarCambios')
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.BookingSettingsManager.widgetEmbebible')}</CardTitle>
              <CardDescription>
                {t('settings.BookingSettingsManager.copiaEsteCodigoHtmlY')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.booking_enabled ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('settings.BookingSettingsManager.urlDirecta')}</Label>
                    <div className="flex gap-2">
                      <Input value={widgetUrl} readOnly className="font-mono text-sm" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(widgetUrl)}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a href={widgetUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.codigoIframe')}</Label>
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                        {embedCode}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(embedCode)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {t('settings.BookingSettingsManager.copiar')}
                      </Button>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      {t('settings.BookingSettingsManager.elWidgetSeAdaptaAutomaticamente')}
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert>
                  <AlertDescription>
                    {t('settings.BookingSettingsManager.habilitaLasReservasOnlinePara')}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
