import { useState, useEffect } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PlannedShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  planned_cost: number;
  role: string;
  status: string;
}

export default function TeamSchedule() {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [shifts, setShifts] = useState<PlannedShift[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  useEffect(() => {
    if (!user) return;
    const getEmployee = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .single();
      if (data) setEmployeeId(data.id);
    };
    getEmployee();
  }, [user]);

  useEffect(() => {
    if (!employeeId) return;
    const fetchShifts = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('planned_shifts')
        .select('id, shift_date, start_time, end_time, planned_hours, planned_cost, role, status')
        .eq('employee_id', employeeId)
        .gte('shift_date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('shift_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('shift_date', { ascending: true });
      setShifts(data || []);
      setLoading(false);
    };
    fetchShifts();
  }, [employeeId, currentWeekStart]);

  const getShiftsForDay = (day: Date) =>
    shifts.filter((s) => s.shift_date === format(day, 'yyyy-MM-dd'));

  const totalWeekHours = shifts
    .filter((s) => s.status === 'published')
    .reduce((sum, s) => sum + (s.planned_hours || 0), 0);

  const selectedDayShifts = getShiftsForDay(selectedDay);

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mi Horario</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentWeekStart, "d MMM", { locale: es })} -{' '}
            {format(weekEnd, "d MMM yyyy", { locale: es })}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Clock className="h-3 w-3 mr-1" />
          {totalWeekHours}h esta semana
        </Badge>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex gap-1 flex-1 mx-2">
          {weekDays.map((day) => {
            const dayShifts = getShiftsForDay(day);
            const hasShift = dayShifts.length > 0;
            const isSelected = isSameDay(day, selectedDay);
            const today = isToday(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : today
                    ? 'bg-primary/10'
                    : 'hover:bg-muted'
                )}
              >
                <span className="text-[10px] font-medium uppercase">
                  {format(day, 'EEE', { locale: es })}
                </span>
                <span className={cn('text-sm font-bold', isSelected && 'text-primary-foreground')}>
                  {format(day, 'd')}
                </span>
                {hasShift && (
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      isSelected ? 'bg-primary-foreground' : 'bg-primary'
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected Day Detail */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase">
          {format(selectedDay, "EEEE, d 'de' MMMM", { locale: es })}
        </h2>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            </CardContent>
          </Card>
        ) : selectedDayShifts.length > 0 ? (
          <div className="space-y-3">
            {selectedDayShifts.map((shift) => (
              <Card
                key={shift.id}
                className={cn(
                  'border-l-4',
                  shift.status === 'published'
                    ? 'border-l-primary'
                    : 'border-l-amber-400'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-lg font-bold">
                          {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                        </span>
                      </div>
                      {shift.role && (
                        <Badge variant="outline" className="text-xs">
                          {shift.role}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {shift.planned_hours}h
                      </p>
                      <Badge
                        variant={shift.status === 'published' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {shift.status === 'published' ? 'Confirmado' : 'Borrador'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">Día libre</p>
              <p className="text-xs text-muted-foreground/60">
                No tienes turnos programados
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Week Overview */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Resumen semanal</h3>
          <div className="space-y-2">
            {weekDays.map((day) => {
              const dayShifts = getShiftsForDay(day);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex items-center justify-between py-2 px-3 rounded-lg',
                    today && 'bg-primary/5',
                    dayShifts.length === 0 && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {today && <div className="w-2 h-2 rounded-full bg-primary" />}
                    <span className="text-sm font-medium">
                      {format(day, 'EEE d', { locale: es })}
                    </span>
                  </div>
                  {dayShifts.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {dayShifts[0].start_time?.slice(0, 5)} -{' '}
                        {dayShifts[0].end_time?.slice(0, 5)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {dayShifts[0].planned_hours}h
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Libre</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
