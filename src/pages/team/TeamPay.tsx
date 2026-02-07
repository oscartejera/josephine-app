import { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
  addMonths,
  differenceInMinutes,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Wallet,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ClockRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  source: string;
}

interface PlannedShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  planned_cost: number;
}

interface EmployeeInfo {
  id: string;
  hourly_cost: number;
}

export default function TeamPay() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [clockRecords, setClockRecords] = useState<ClockRecord[]>([]);
  const [plannedShifts, setPlannedShifts] = useState<PlannedShift[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  useEffect(() => {
    if (!user) return;
    const getEmployee = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, hourly_cost')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .single();
      if (data) setEmployee(data);
    };
    getEmployee();
  }, [user]);

  useEffect(() => {
    if (!employee) return;
    const fetchData = async () => {
      setLoading(true);

      const [clockRes, shiftsRes] = await Promise.all([
        supabase
          .from('employee_clock_records')
          .select('id, clock_in, clock_out, source')
          .eq('employee_id', employee.id)
          .gte('clock_in', monthStart.toISOString())
          .lte('clock_in', monthEnd.toISOString())
          .order('clock_in', { ascending: false }),
        supabase
          .from('planned_shifts')
          .select('id, shift_date, start_time, end_time, planned_hours, planned_cost')
          .eq('employee_id', employee.id)
          .gte('shift_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('shift_date', format(monthEnd, 'yyyy-MM-dd'))
          .eq('status', 'published')
          .order('shift_date', { ascending: false }),
      ]);

      setClockRecords(clockRes.data || []);
      setPlannedShifts(shiftsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [employee, currentMonth]);

  // Calculate actual hours from clock records
  const totalActualMinutes = clockRecords.reduce((total, r) => {
    if (!r.clock_out) return total;
    return total + differenceInMinutes(new Date(r.clock_out), new Date(r.clock_in));
  }, 0);
  const totalActualHours = totalActualMinutes / 60;

  // Calculate planned hours
  const totalPlannedHours = plannedShifts.reduce((sum, s) => sum + (s.planned_hours || 0), 0);

  // Estimated earnings
  const hourlyRate = employee?.hourly_cost || 0;
  const estimatedEarnings = totalActualHours * hourlyRate;
  const plannedEarnings = totalPlannedHours * hourlyRate;

  // Group clock records by day
  const groupedByDay = clockRecords.reduce<Record<string, ClockRecord[]>>((acc, r) => {
    const day = format(new Date(r.clock_in), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(r);
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mi Nómina</h1>
          <p className="text-sm text-muted-foreground">Control de horas y estimaciones</p>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-card rounded-xl border p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Horas trabajadas</span>
            </div>
            <p className="text-2xl font-bold">{totalActualHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">
              de {totalPlannedHours}h planificadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Estimación bruta</span>
            </div>
            <p className="text-2xl font-bold">{estimatedEarnings.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">
              {hourlyRate > 0 ? `${hourlyRate.toFixed(2)}€/h` : 'Tarifa no definida'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso del mes</span>
            <span className="text-sm text-muted-foreground">
              {totalPlannedHours > 0
                ? `${Math.round((totalActualHours / totalPlannedHours) * 100)}%`
                : '-'}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary rounded-full h-3 transition-all"
              style={{
                width: `${
                  totalPlannedHours > 0
                    ? Math.min((totalActualHours / totalPlannedHours) * 100, 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {totalActualHours.toFixed(1)}h realizadas
            </span>
            <span className="text-xs text-muted-foreground">
              {totalPlannedHours}h objetivo
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Detailed View */}
      <Tabs defaultValue="records">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="records">Fichajes</TabsTrigger>
          <TabsTrigger value="shifts">Turnos planificados</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <ScrollArea className="h-[400px]">
                {Object.keys(groupedByDay).length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground">Sin fichajes este mes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedByDay).map(([day, records]) => {
                      const dayTotal = records.reduce((sum, r) => {
                        if (!r.clock_out) return sum;
                        return (
                          sum +
                          differenceInMinutes(
                            new Date(r.clock_out),
                            new Date(r.clock_in)
                          )
                        );
                      }, 0);

                      return (
                        <div key={day}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold">
                              {format(new Date(day), "EEE d 'de' MMM", { locale: es })}
                            </span>
                            <Badge variant="secondary">
                              {Math.floor(dayTotal / 60)}h {dayTotal % 60}m
                            </Badge>
                          </div>
                          {records.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between py-2 pl-4 border-l-2 border-muted"
                            >
                              <div className="text-sm">
                                <span className="font-medium">
                                  {format(new Date(r.clock_in), 'HH:mm')}
                                </span>
                                <span className="text-muted-foreground mx-1">→</span>
                                <span className="font-medium">
                                  {r.clock_out
                                    ? format(new Date(r.clock_out), 'HH:mm')
                                    : 'En curso'}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {r.source === 'geo' ? 'GPS' : 'Manual'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <ScrollArea className="h-[400px]">
                {plannedShifts.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground">Sin turnos planificados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plannedShifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(shift.shift_date), "EEE d 'de' MMM", {
                              locale: es,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{shift.planned_hours}h</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
