/**
 * Reservations Settings Page
 * Configuración completa del módulo de reservas
 */

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useReservations } from '@/contexts/ReservationsContext';
import { ReservationsProvider } from '@/contexts/ReservationsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Clock,
  CreditCard,
  Mail,
  AlertTriangle,
  MapPin,
  Utensils,
  Calendar,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReservationSettings } from '@/types/reservations';

function ReservationsSettingsContent() {
  const { selectedLocationId } = useApp();
  const { dataLayer } = useReservations();
  const [settings, setSettings] = useState<ReservationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const locationId = selectedLocationId === 'all' ? null : selectedLocationId;

  useEffect(() => {
    async function loadSettings() {
      if (!locationId) {
        setLoading(false);
        return;
      }

      try {
        const data = await dataLayer.settings.getOrCreate(locationId);
        setSettings(data);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [locationId, dataLayer]);

  const handleSave = async () => {
    if (!locationId || !settings) return;

    setSaving(true);
    try {
      await dataLayer.settings.update(locationId, settings);
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      toast.error('Error al guardar configuración');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ReservationSettings>(
    key: K,
    value: ReservationSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (!locationId) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Selecciona una ubicación para configurar reservas</p>
        </div>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuración de Reservas
          </h1>
          <p className="text-muted-foreground">
            Gestiona todas las opciones del sistema de reservas
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="deposits">Depósitos</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="cancellation">Cancelaciones</TabsTrigger>
          <TabsTrigger value="advanced">Avanzado</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horarios y Capacidad
              </CardTitle>
              <CardDescription>Configuración básica de horarios y aforo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duración por defecto (minutos)</Label>
                  <Input
                    type="number"
                    value={settings.default_reservation_duration}
                    onChange={(e) =>
                      updateSetting('default_reservation_duration', parseInt(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duración de slot (minutos)</Label>
                  <Input
                    type="number"
                    value={settings.slot_duration_minutes}
                    onChange={(e) =>
                      updateSetting('slot_duration_minutes', parseInt(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tamaño mínimo de grupo</Label>
                  <Input
                    type="number"
                    value={settings.min_party_size}
                    onChange={(e) => updateSetting('min_party_size', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tamaño máximo de grupo</Label>
                  <Input
                    type="number"
                    value={settings.max_party_size}
                    onChange={(e) => updateSetting('max_party_size', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Confirmar automáticamente</Label>
                  <p className="text-sm text-muted-foreground">
                    Las reservas se confirman sin revisión manual
                  </p>
                </div>
                <Switch
                  checked={settings.auto_confirm}
                  onCheckedChange={(checked) => updateSetting('auto_confirm', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deposit Settings */}
        <TabsContent value="deposits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Depósitos y Señales
              </CardTitle>
              <CardDescription>Configuración de depósitos por reserva</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requerir depósito</Label>
                  <p className="text-sm text-muted-foreground">
                    Solicitar depósito para confirmar reservas
                  </p>
                </div>
                <Switch
                  checked={settings.require_deposit}
                  onCheckedChange={(checked) => updateSetting('require_deposit', checked)}
                />
              </div>

              {settings.require_deposit && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cantidad por persona (€)</Label>
                      <Input
                        type="number"
                        value={settings.deposit_amount_per_person}
                        onChange={(e) =>
                          updateSetting('deposit_amount_per_person', parseFloat(e.target.value))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Requerido para grupos de (personas)</Label>
                      <Input
                        type="number"
                        value={settings.deposit_required_for_party_size || ''}
                        onChange={(e) =>
                          updateSetting(
                            'deposit_required_for_party_size',
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        placeholder="Ej: 6"
                      />
                      <p className="text-xs text-muted-foreground">
                        Dejar vacío para requerir siempre
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Notificaciones y Confirmaciones
              </CardTitle>
              <CardDescription>Configuración de mensajería automática</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enviar email de confirmación</Label>
                  <p className="text-sm text-muted-foreground">Al crear una reserva</p>
                </div>
                <Switch
                  checked={settings.send_confirmation_email}
                  onCheckedChange={(checked) => updateSetting('send_confirmation_email', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enviar recordatorio</Label>
                  <p className="text-sm text-muted-foreground">Antes de la reserva</p>
                </div>
                <Switch
                  checked={settings.send_reminder}
                  onCheckedChange={(checked) => updateSetting('send_reminder', checked)}
                />
              </div>

              {settings.send_reminder && (
                <div className="space-y-2 ml-6">
                  <Label>Horas antes para recordatorio</Label>
                  <Input
                    type="number"
                    value={settings.reminder_hours_before}
                    onChange={(e) =>
                      updateSetting('reminder_hours_before', parseInt(e.target.value))
                    }
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requerir reconfirmación</Label>
                  <p className="text-sm text-muted-foreground">Cliente debe confirmar asistencia</p>
                </div>
                <Switch
                  checked={settings.require_reconfirmation}
                  onCheckedChange={(checked) => updateSetting('require_reconfirmation', checked)}
                />
              </div>

              {settings.require_reconfirmation && (
                <div className="space-y-2 ml-6">
                  <Label>Horas antes para reconfirmación</Label>
                  <Input
                    type="number"
                    value={settings.reconfirmation_hours_before}
                    onChange={(e) =>
                      updateSetting('reconfirmation_hours_before', parseInt(e.target.value))
                    }
                  />
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Mensaje de confirmación</Label>
                <Textarea
                  value={settings.confirmation_message || ''}
                  onChange={(e) => updateSetting('confirmation_message', e.target.value)}
                  placeholder="Gracias por tu reserva..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cancellation Policy */}
        <TabsContent value="cancellation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Política de Cancelación y No-Shows
              </CardTitle>
              <CardDescription>
                Configuración de penalizaciones y tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Plazo de cancelación (horas antes)</Label>
                <Input
                  type="number"
                  value={settings.cancellation_deadline_hours}
                  onChange={(e) =>
                    updateSetting('cancellation_deadline_hours', parseInt(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Tiempo mínimo para cancelar sin penalización
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cobrar tarifa de cancelación</Label>
                  <p className="text-sm text-muted-foreground">
                    Si cancela después del plazo
                  </p>
                </div>
                <Switch
                  checked={settings.charge_cancellation_fee}
                  onCheckedChange={(checked) => updateSetting('charge_cancellation_fee', checked)}
                />
              </div>

              {settings.charge_cancellation_fee && (
                <div className="space-y-2 ml-6">
                  <Label>Porcentaje de tarifa (%)</Label>
                  <Input
                    type="number"
                    value={settings.cancellation_fee_percentage}
                    onChange={(e) =>
                      updateSetting('cancellation_fee_percentage', parseInt(e.target.value))
                    }
                    max="100"
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Trackear no-shows</Label>
                  <p className="text-sm text-muted-foreground">
                    Registrar no-shows en perfil de cliente
                  </p>
                </div>
                <Switch
                  checked={settings.track_no_shows}
                  onCheckedChange={(checked) => updateSetting('track_no_shows', checked)}
                />
              </div>

              {settings.track_no_shows && (
                <div className="space-y-2 ml-6">
                  <Label>Bloquear después de (no-shows)</Label>
                  <Input
                    type="number"
                    value={settings.block_after_no_shows || ''}
                    onChange={(e) =>
                      updateSetting(
                        'block_after_no_shows',
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    placeholder="Ej: 3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dejar vacío para no bloquear automáticamente
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Política de cancelación (texto)</Label>
                <Textarea
                  value={settings.cancellation_policy || ''}
                  onChange={(e) => updateSetting('cancellation_policy', e.target.value)}
                  placeholder="Cancelaciones gratuitas hasta 24h antes..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Este texto se mostrará en confirmaciones y widget online
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Funciones Avanzadas</CardTitle>
              <CardDescription>Características opcionales del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Lista de espera</Label>
                  <p className="text-sm text-muted-foreground">
                    Permitir clientes en espera sin reserva
                  </p>
                </div>
                <Switch
                  checked={settings.enable_waitlist}
                  onCheckedChange={(checked) => updateSetting('enable_waitlist', checked)}
                />
              </div>

              {settings.enable_waitlist && (
                <div className="flex items-center justify-between ml-6">
                  <div className="space-y-0.5">
                    <Label>Asignar automáticamente</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar cuando se libere mesa
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_assign_from_waitlist}
                    onCheckedChange={(checked) =>
                      updateSetting('auto_assign_from_waitlist', checked)
                    }
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Combinar mesas</Label>
                  <p className="text-sm text-muted-foreground">
                    Permitir doblar mesas para grupos grandes
                  </p>
                </div>
                <Switch
                  checked={settings.enable_table_combining}
                  onCheckedChange={(checked) => updateSetting('enable_table_combining', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Códigos promocionales</Label>
                  <p className="text-sm text-muted-foreground">
                    Habilitar uso de códigos promo
                  </p>
                </div>
                <Switch
                  checked={settings.enable_promo_codes}
                  onCheckedChange={(checked) => updateSetting('enable_promo_codes', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Google Reservations</Label>
                  <p className="text-sm text-muted-foreground">
                    Aceptar reservas desde Google Maps
                  </p>
                </div>
                <Switch
                  checked={settings.enable_google_reservations}
                  onCheckedChange={(checked) =>
                    updateSetting('enable_google_reservations', checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button (sticky bottom) */}
      <div className="sticky bottom-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}

export default function ReservationsSettings() {
  return (
    <ReservationsProvider>
      <ReservationsSettingsContent />
    </ReservationsProvider>
  );
}
