import { useState, useEffect, useCallback } from 'react';
import { Settings2, Store, Clock, Target, Users, BarChart3, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface ScheduleSettings {
  // Venue
  tables_count: number;
  service_type: string;
  // Hours
  opening_time: string;
  closing_time: string;
  closed_days: number[];
  // Labor Goals
  target_col_percent: number;
  default_hourly_cost: number;
  splh_goal: number;
  average_check_size: number;
  // Staffing Rules
  min_rest_hours: number;
  max_hours_per_day: number;
  staffing_ratios: Record<string, number>;
  // Demand Curve
  hourly_demand_curve: Record<string, number>;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const SERVICE_TYPES = [
  { value: 'casual_dining', label: 'Casual Dining' },
  { value: 'fast_casual', label: 'Fast Casual' },
  { value: 'fine_dining', label: 'Fine Dining' },
  { value: 'qsr', label: 'Quick Service (QSR)' },
];

const DEFAULT_SETTINGS: ScheduleSettings = {
  tables_count: 30,
  service_type: 'casual_dining',
  opening_time: '09:00',
  closing_time: '01:00',
  closed_days: [],
  target_col_percent: 32,
  default_hourly_cost: 14.5,
  splh_goal: 50,
  average_check_size: 25,
  min_rest_hours: 10,
  max_hours_per_day: 10,
  staffing_ratios: { Chef: 12, Server: 16, Bartender: 25, Host: 40, Manager: 999 },
  hourly_demand_curve: {
    '9': 0.01, '10': 0.02, '11': 0.04, '12': 0.07,
    '13': 0.14, '14': 0.15, '15': 0.08, '16': 0.03,
    '17': 0.03, '18': 0.04, '19': 0.05, '20': 0.10,
    '21': 0.12, '22': 0.09, '23': 0.03,
  },
};

interface ScheduleSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  locationName: string;
}

export function ScheduleSettingsSheet({ isOpen, onClose, locationId, locationName }: ScheduleSettingsSheetProps) {
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch settings on open
  useEffect(() => {
    if (!isOpen || !locationId) return;
    setLoading(true);

    supabase
      .from('location_settings')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettings({
            tables_count: data.tables_count ?? DEFAULT_SETTINGS.tables_count,
            service_type: data.service_type ?? DEFAULT_SETTINGS.service_type,
            opening_time: formatTime(data.opening_time) ?? DEFAULT_SETTINGS.opening_time,
            closing_time: formatTime(data.closing_time) ?? DEFAULT_SETTINGS.closing_time,
            closed_days: data.closed_days ?? DEFAULT_SETTINGS.closed_days,
            target_col_percent: data.target_col_percent ?? DEFAULT_SETTINGS.target_col_percent,
            default_hourly_cost: data.default_hourly_cost ?? DEFAULT_SETTINGS.default_hourly_cost,
            splh_goal: data.splh_goal ?? DEFAULT_SETTINGS.splh_goal,
            average_check_size: data.average_check_size ?? DEFAULT_SETTINGS.average_check_size,
            min_rest_hours: data.min_rest_hours ?? DEFAULT_SETTINGS.min_rest_hours,
            max_hours_per_day: data.max_hours_per_day ?? DEFAULT_SETTINGS.max_hours_per_day,
            staffing_ratios: data.staffing_ratios ?? DEFAULT_SETTINGS.staffing_ratios,
            hourly_demand_curve: data.hourly_demand_curve ?? DEFAULT_SETTINGS.hourly_demand_curve,
          });
        }
        setLoading(false);
      });
  }, [isOpen, locationId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase
      .from('location_settings')
      .update({
        tables_count: settings.tables_count,
        service_type: settings.service_type,
        opening_time: settings.opening_time + ':00',
        closing_time: settings.closing_time + ':00',
        closed_days: settings.closed_days,
        target_col_percent: settings.target_col_percent,
        default_hourly_cost: settings.default_hourly_cost,
        splh_goal: settings.splh_goal,
        average_check_size: settings.average_check_size,
        min_rest_hours: settings.min_rest_hours,
        max_hours_per_day: settings.max_hours_per_day,
        staffing_ratios: settings.staffing_ratios,
        hourly_demand_curve: settings.hourly_demand_curve,
      } as any)
      .eq('location_id', locationId);

    setSaving(false);
    if (error) {
      toast.error('Error guardando: ' + error.message);
    } else {
      toast.success('Schedule settings guardados');
      onClose();
    }
  }, [settings, locationId, onClose]);

  const updateField = <K extends keyof ScheduleSettings>(key: K, value: ScheduleSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateStaffingRatio = (role: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      staffing_ratios: { ...prev.staffing_ratios, [role]: value },
    }));
  };

  const updateDemandHour = (hour: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      hourly_demand_curve: { ...prev.hourly_demand_curve, [hour]: value },
    }));
  };

  const toggleClosedDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      closed_days: prev.closed_days.includes(day)
        ? prev.closed_days.filter(d => d !== day)
        : [...prev.closed_days, day],
    }));
  };

  // Computed values
  const estimatedCovers = settings.tables_count * 2.5; // avg 2.5 per table
  const weeklyBudgetEst = Math.round(3500 * 7 * (settings.target_col_percent / 100));
  const maxWeeklyHours = Math.round(weeklyBudgetEst / settings.default_hourly_cost);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Schedule Settings
          </SheetTitle>
          <SheetDescription>
            {locationName} — Configura los datos de tu local para que el AI Scheduler genere turnos realistas.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-180px)] pr-4 mt-4">
            <div className="space-y-6 pb-8">

              {/* SECTION 1: Venue Profile */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Venue Profile</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Mesas</Label>
                    <Input
                      type="number"
                      value={settings.tables_count}
                      onChange={e => updateField('tables_count', parseInt(e.target.value) || 0)}
                    />
                    <span className="text-xs text-muted-foreground">~{estimatedCovers} covers max</span>
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de servicio</Label>
                    <Select value={settings.service_type} onValueChange={v => updateField('service_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <Separator />

              {/* SECTION 2: Operating Hours */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Operating Hours</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label className="text-xs">Apertura</Label>
                    <Input
                      type="time"
                      value={settings.opening_time}
                      onChange={e => updateField('opening_time', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cierre</Label>
                    <Input
                      type="time"
                      value={settings.closing_time}
                      onChange={e => updateField('closing_time', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Dias cerrados</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <label
                        key={day.value}
                        className="flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <Checkbox
                          checked={settings.closed_days.includes(day.value)}
                          onCheckedChange={() => toggleClosedDay(day.value)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <Separator />

              {/* SECTION 3: Labor Goals */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Labor Goals</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Target COL %</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={settings.target_col_percent}
                      onChange={e => updateField('target_col_percent', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">SPLH Goal (€/h)</Label>
                    <Input
                      type="number"
                      value={settings.splh_goal}
                      onChange={e => updateField('splh_goal', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ticket medio (ACS) €</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={settings.average_check_size}
                      onChange={e => updateField('average_check_size', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Coste horario medio €/h</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={settings.default_hourly_cost}
                      onChange={e => updateField('default_hourly_cost', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="mt-2 p-2 bg-muted/40 rounded-md text-xs text-muted-foreground">
                  Budget semanal est. ~€{weeklyBudgetEst.toLocaleString()} | Max ~{maxWeeklyHours}h/semana
                </div>
              </section>

              <Separator />

              {/* SECTION 4: Staffing Rules */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Staffing Rules</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label className="text-xs">Descanso min. entre turnos (h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={settings.min_rest_hours}
                      onChange={e => updateField('min_rest_hours', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max horas/dia por persona</Label>
                    <Input
                      type="number"
                      value={settings.max_hours_per_day}
                      onChange={e => updateField('max_hours_per_day', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <Label className="text-xs mb-2 block">OPLH por rol (covers que maneja 1 persona/hora)</Label>
                <div className="space-y-2">
                  {Object.entries(settings.staffing_ratios)
                    .filter(([role]) => role !== 'Manager')
                    .map(([role, value]) => (
                      <div key={role} className="flex items-center gap-2">
                        <span className="text-xs font-medium w-24">{role}</span>
                        <Input
                          type="number"
                          className="w-20 h-8 text-xs"
                          value={value}
                          onChange={e => updateStaffingRatio(role, parseInt(e.target.value) || 1)}
                        />
                        <span className="text-xs text-muted-foreground">covers/h</span>
                      </div>
                    ))}
                </div>
              </section>

              <Separator />

              {/* SECTION 5: Hourly Demand Curve */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Hourly Demand Curve</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  % de ventas diarias por hora. El total debe sumar ~100%.
                </p>
                <div className="space-y-1">
                  {Object.entries(settings.hourly_demand_curve)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([hour, pct]) => {
                      const barWidth = Math.round(pct * 100 * 5); // scale for visual
                      return (
                        <div key={hour} className="flex items-center gap-2">
                          <span className="text-xs font-mono w-12 text-right">{hour.padStart(2, '0')}:00</span>
                          <div className="flex-1 h-5 bg-muted/30 rounded-sm overflow-hidden relative">
                            <div
                              className="h-full bg-primary/30 rounded-sm"
                              style={{ width: `${Math.min(100, barWidth)}%` }}
                            />
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            className="w-16 h-6 text-xs text-right"
                            value={pct}
                            onChange={e => updateDemandHour(hour, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      );
                    })}
                </div>
                <div className="mt-1 text-xs text-muted-foreground text-right">
                  Total: {(Object.values(settings.hourly_demand_curve).reduce((s, v) => s + v, 0) * 100).toFixed(0)}%
                </div>
              </section>

            </div>
          </ScrollArea>
        )}

        {/* Save button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatTime(t: string | null): string {
  if (!t) return '09:00';
  return t.substring(0, 5);
}
