import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfWeek,
  endOfWeek,
  differenceInMinutes,
  isToday,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock,
  Calendar,
  LogIn,
  LogOut,
  MapPin,
  ChevronRight,
  TrendingUp,
  Timer,
  Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ClockRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  location_id: string;
  source: string;
}

interface PlannedShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  role: string;
  status: string;
}

interface EmployeeInfo {
  id: string;
  full_name: string;
  location_id: string;
  location_name: string;
}

export default function TeamHome() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [activeRecord, setActiveRecord] = useState<ClockRecord | null>(null);
  const [weekRecords, setWeekRecords] = useState<ClockRecord[]>([]);
  const [todayShift, setTodayShift] = useState<PlannedShift | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<PlannedShift[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGeoLocation(null)
      );
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Get employee info with location name
      const { data: emp } = await supabase
        .from('employees')
        .select('id, full_name, location_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .single();

      if (!emp) return;

      // Get location name
      const { data: loc } = await supabase
        .from('locations')
        .select('name')
        .eq('id', emp.location_id)
        .single();

      setEmployee({
        ...emp,
        location_name: loc?.name || 'Mi Local',
      });

      // Fetch clock records for this week
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

      const { data: records } = await supabase
        .from('employee_clock_records')
        .select('id, clock_in, clock_out, location_id, source')
        .eq('employee_id', emp.id)
        .gte('clock_in', weekStart.toISOString())
        .lte('clock_in', weekEnd.toISOString())
        .order('clock_in', { ascending: false });

      if (records) {
        setWeekRecords(records);
        const active = records.find((r) => !r.clock_out);
        setActiveRecord(active || null);
      }

      // Fetch today's and upcoming shifts
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: shifts } = await supabase
        .from('planned_shifts')
        .select('id, shift_date, start_time, end_time, planned_hours, role, status')
        .eq('employee_id', emp.id)
        .eq('status', 'published')
        .gte('shift_date', today)
        .order('shift_date', { ascending: true })
        .limit(7);

      if (shifts) {
        const todayS = shifts.find((s) => s.shift_date === today);
        setTodayShift(todayS || null);
        setUpcomingShifts(shifts.filter((s) => s.shift_date !== today).slice(0, 3));
      }
    };

    fetchData();
  }, [user]);

  const handleClockIn = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_clock_records')
        .insert({
          employee_id: employee.id,
          location_id: employee.location_id,
          clock_in: new Date().toISOString(),
          clock_in_lat: geoLocation?.lat,
          clock_in_lng: geoLocation?.lng,
          source: geoLocation ? 'geo' : 'manual',
        })
        .select()
        .single();
      if (error) throw error;
      setActiveRecord(data);
      setWeekRecords((prev) => [data, ...prev]);
      toast.success('Entrada registrada');
    } catch {
      toast.error('Error al registrar entrada');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeRecord) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('employee_clock_records')
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: geoLocation?.lat,
          clock_out_lng: geoLocation?.lng,
        })
        .eq('id', activeRecord.id);
      if (error) throw error;
      setWeekRecords((prev) =>
        prev.map((r) =>
          r.id === activeRecord.id ? { ...r, clock_out: new Date().toISOString() } : r
        )
      );
      setActiveRecord(null);
      toast.success('Salida registrada');
    } catch {
      toast.error('Error al registrar salida');
    } finally {
      setLoading(false);
    }
  };

  const weeklyMinutes = weekRecords.reduce((total, r) => {
    const start = new Date(r.clock_in);
    const end = r.clock_out ? new Date(r.clock_out) : new Date();
    return total + differenceInMinutes(end, start);
  }, 0);
  const weeklyHours = Math.floor(weeklyMinutes / 60);
  const weeklyMins = weeklyMinutes % 60;

  const activeMinutes = activeRecord
    ? differenceInMinutes(new Date(), new Date(activeRecord.clock_in))
    : 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold">
          {greeting()}, {profile?.full_name?.split(' ')[0] || 'Equipo'}
        </h1>
        <p className="text-muted-foreground">
          {format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Quick Clock In/Out */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-semibold">Fichaje Rápido</span>
            </div>
            <span className="text-2xl font-bold font-mono">
              {format(currentTime, 'HH:mm')}
            </span>
          </div>

          {geoLocation && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              <MapPin className="h-3 w-3" />
              <span>Ubicación detectada</span>
            </div>
          )}

          {activeRecord ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Turno activo</p>
                  <p className="font-semibold">
                    Desde {format(new Date(activeRecord.clock_in), 'HH:mm')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Tiempo</p>
                  <p className="font-bold text-primary">
                    {Math.floor(activeMinutes / 60)}h {activeMinutes % 60}m
                  </p>
                </div>
              </div>
              <Button
                onClick={handleClockOut}
                disabled={loading}
                variant="destructive"
                className="w-full h-12"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Fichar Salida
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClockIn}
              disabled={loading || !employee}
              className="w-full h-12"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Fichar Entrada
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Today's Shift */}
      <Card
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => navigate('/team/schedule')}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Turno de hoy</p>
                {todayShift ? (
                  <p className="font-semibold">
                    {todayShift.start_time?.slice(0, 5)} - {todayShift.end_time?.slice(0, 5)}
                    <span className="text-muted-foreground font-normal ml-2">
                      ({todayShift.planned_hours}h)
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">Sin turno programado</p>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Weekly Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Esta semana</span>
            </div>
            <p className="text-2xl font-bold">
              {weeklyHours}h {weeklyMins}m
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fichajes</span>
            </div>
            <p className="text-2xl font-bold">{weekRecords.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Shifts */}
      {upcomingShifts.length > 0 && (
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Próximos turnos</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => navigate('/team/schedule')}
              >
                Ver todos
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {upcomingShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(parseISO(shift.shift_date), "EEEE d 'de' MMM", {
                        locale: es,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  <Badge variant="secondary">{shift.planned_hours}h</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate('/team/pay')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Mi Nómina</p>
              <p className="text-xs text-muted-foreground">Horas y pagos</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate('/team/news')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Novedades</p>
              <p className="text-xs text-muted-foreground">Noticias del equipo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Badge */}
      {employee && (
        <div className="text-center pt-2">
          <Badge variant="outline" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {employee.location_name}
          </Badge>
        </div>
      )}
    </div>
  );
}
