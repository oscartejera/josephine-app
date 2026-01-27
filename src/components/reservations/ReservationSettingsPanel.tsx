import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CreditCard, Bell, Calendar, Users, Globe } from 'lucide-react';

interface ReservationSettings {
  max_covers_per_slot: number;
  slot_duration_minutes: number;
  default_reservation_duration: number;
  require_deposit: boolean;
  deposit_amount_per_person: number;
  deposit_policy_text: string | null;
  enable_table_doubling: boolean;
  turn_buffer_minutes: number;
  max_turns_per_table: number;
  auto_confirm: boolean;
  send_confirmation_email: boolean;
  send_confirmation_sms: boolean;
  confirmation_message: string | null;
  send_reminder: boolean;
  reminder_hours_before: number;
  reminder_message: string | null;
  cancellation_deadline_hours: number;
  cancellation_policy_text: string | null;
  google_reserve_enabled: boolean;
  google_place_id: string | null;
}

interface ReservationSettingsPanelProps {
  locationId: string | null;
}

const defaultSettings: ReservationSettings = {
  max_covers_per_slot: 50,
  slot_duration_minutes: 15,
  default_reservation_duration: 90,
  require_deposit: false,
  deposit_amount_per_person: 10,
  deposit_policy_text: null,
  enable_table_doubling: true,
  turn_buffer_minutes: 15,
  max_turns_per_table: 3,
  auto_confirm: true,
  send_confirmation_email: true,
  send_confirmation_sms: false,
  confirmation_message: null,
  send_reminder: true,
  reminder_hours_before: 24,
  reminder_message: null,
  cancellation_deadline_hours: 24,
  cancellation_policy_text: null,
  google_reserve_enabled: false,
  google_place_id: null,
};

// Direct fetch helper
async function fetchSettings(locationId: string): Promise<ReservationSettings | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(
    `${supabaseUrl}/rest/v1/reservation_settings?location_id=eq.${locationId}&limit=1`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }
  );
  
  if (!response.ok) return null;
  const data = await response.json();
  return data[0] || null;
}

async function upsertSettings(locationId: string, settings: ReservationSettings): Promise<boolean> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(`${supabaseUrl}/rest/v1/reservation_settings`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ location_id: locationId, ...settings }),
  });
  
  return response.ok;
}

export function ReservationSettingsPanel({ locationId }: ReservationSettingsPanelProps) {
  const [settings, setSettings] = useState<ReservationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (locationId && locationId !== 'all') {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [locationId]);

  const loadSettings = async () => {
    if (!locationId || locationId === 'all') return;

    try {
      const data = await fetchSettings(locationId);
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.log('Using default settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!locationId || locationId === 'all') return;

    setSaving(true);
    try {
      const success = await upsertSettings(locationId, settings);
      if (!success) throw new Error('Failed to save');
      toast.success('Configuración guardada');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!locationId || locationId === 'all') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Selecciona un local específico para configurar las reservas
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Capacity Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Capacidad y Turnos
          </CardTitle>
          <CardDescription>Configura el aforo y la gestión de turnos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Comensales máx. por franja</Label>
              <Input
                type="number"
                value={settings.max_covers_per_slot}
                onChange={(e) => setSettings({ ...settings, max_covers_per_slot: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Duración franja (min)</Label>
              <Input
                type="number"
                value={settings.slot_duration_minutes}
                onChange={(e) => setSettings({ ...settings, slot_duration_minutes: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Duración reserva por defecto (min)</Label>
              <Input
                type="number"
                value={settings.default_reservation_duration}
                onChange={(e) => setSettings({ ...settings, default_reservation_duration: Number(e.target.value) })}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Doblar mesas automáticamente</Label>
              <p className="text-sm text-muted-foreground">Permitir múltiples turnos por mesa</p>
            </div>
            <Switch
              checked={settings.enable_table_doubling}
              onCheckedChange={(checked) => setSettings({ ...settings, enable_table_doubling: checked })}
            />
          </div>

          {settings.enable_table_doubling && (
            <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
              <div>
                <Label>Buffer entre turnos (min)</Label>
                <Input
                  type="number"
                  value={settings.turn_buffer_minutes}
                  onChange={(e) => setSettings({ ...settings, turn_buffer_minutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Turnos máx. por mesa</Label>
                <Input
                  type="number"
                  value={settings.max_turns_per_table}
                  onChange={(e) => setSettings({ ...settings, max_turns_per_table: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Señal / Depósito
          </CardTitle>
          <CardDescription>Cobra una señal para reducir No Shows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Requerir señal</Label>
              <p className="text-sm text-muted-foreground">Cobrar depósito por comensal</p>
            </div>
            <Switch
              checked={settings.require_deposit}
              onCheckedChange={(checked) => setSettings({ ...settings, require_deposit: checked })}
            />
          </div>

          {settings.require_deposit && (
            <div className="space-y-4 pl-4 border-l-2">
              <div>
                <Label>Importe por comensal (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.deposit_amount_per_person}
                  onChange={(e) => setSettings({ ...settings, deposit_amount_per_person: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Política de depósito</Label>
                <Textarea
                  value={settings.deposit_policy_text || ''}
                  onChange={(e) => setSettings({ ...settings, deposit_policy_text: e.target.value })}
                  placeholder="La señal se descontará de la cuenta final..."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Communication Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Confirmaciones y Recordatorios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-confirmar reservas</Label>
              <p className="text-sm text-muted-foreground">Sin confirmación manual</p>
            </div>
            <Switch
              checked={settings.auto_confirm}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_confirm: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enviar email de confirmación</Label>
            </div>
            <Switch
              checked={settings.send_confirmation_email}
              onCheckedChange={(checked) => setSettings({ ...settings, send_confirmation_email: checked })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Enviar recordatorio</Label>
            </div>
            <Switch
              checked={settings.send_reminder}
              onCheckedChange={(checked) => setSettings({ ...settings, send_reminder: checked })}
            />
          </div>

          {settings.send_reminder && (
            <div className="pl-4 border-l-2">
              <Label>Horas antes del recordatorio</Label>
              <Input
                type="number"
                value={settings.reminder_hours_before}
                onChange={(e) => setSettings({ ...settings, reminder_hours_before: Number(e.target.value) })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancellation Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Política de Cancelación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Horas límite para cancelar sin penalización</Label>
            <Input
              type="number"
              value={settings.cancellation_deadline_hours}
              onChange={(e) => setSettings({ ...settings, cancellation_deadline_hours: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Texto de política de cancelación</Label>
            <Textarea
              value={settings.cancellation_policy_text || ''}
              onChange={(e) => setSettings({ ...settings, cancellation_policy_text: e.target.value })}
              placeholder="Cancelaciones con menos de 24h de antelación..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Google Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Google Reserve
          </CardTitle>
          <CardDescription>Recibe reservas directamente desde Google</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Activar Google Reserve</Label>
              <p className="text-sm text-muted-foreground">Sincronizar con tu ficha de Google</p>
            </div>
            <Switch
              checked={settings.google_reserve_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, google_reserve_enabled: checked })}
            />
          </div>

          {settings.google_reserve_enabled && (
            <div className="pl-4 border-l-2">
              <Label>Google Place ID</Label>
              <Input
                value={settings.google_place_id || ''}
                onChange={(e) => setSettings({ ...settings, google_place_id: e.target.value })}
                placeholder="ChIJ..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}
