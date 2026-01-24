import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, MapPin, LogIn, LogOut, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ClockRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  location_id: string;
  source: string;
  notes: string | null;
}

interface ClockInPanelProps {
  locationId: string;
  locationName?: string;
}

export function ClockInPanel({ locationId, locationName }: ClockInPanelProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<ClockRecord | null>(null);
  const [weekRecords, setWeekRecords] = useState<ClockRecord[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch employee ID and clock records
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      // Get employee ID for current user
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('location_id', locationId)
        .single();

      if (employee) {
        setEmployeeId(employee.id);
        
        // Get week range
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
        
        // Fetch clock records for this week
        const { data: records } = await supabase
          .from('employee_clock_records')
          .select('*')
          .eq('employee_id', employee.id)
          .gte('clock_in', weekStart.toISOString())
          .lte('clock_in', weekEnd.toISOString())
          .order('clock_in', { ascending: false });

        if (records) {
          setWeekRecords(records);
          // Find active (not clocked out) record
          const active = records.find(r => !r.clock_out);
          setActiveRecord(active || null);
        }
      }
    };

    fetchData();
  }, [user, locationId]);

  // Try to get geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Geolocation not available or denied
          setGeoLocation(null);
        }
      );
    }
  }, []);

  const handleClockIn = async () => {
    if (!employeeId) {
      toast.error('No se encontró tu registro de empleado');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_clock_records')
        .insert({
          employee_id: employeeId,
          location_id: locationId,
          clock_in: new Date().toISOString(),
          clock_in_lat: geoLocation?.lat,
          clock_in_lng: geoLocation?.lng,
          source: geoLocation ? 'geo' : 'manual',
        })
        .select()
        .single();

      if (error) throw error;

      setActiveRecord(data);
      setWeekRecords(prev => [data, ...prev]);
      toast.success('Entrada registrada correctamente');
    } catch (error) {
      console.error('Clock in error:', error);
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

      setWeekRecords(prev => 
        prev.map(r => r.id === activeRecord.id 
          ? { ...r, clock_out: new Date().toISOString() } 
          : r
        )
      );
      setActiveRecord(null);
      toast.success('Salida registrada correctamente');
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error('Error al registrar salida');
    } finally {
      setLoading(false);
    }
  };

  const calculateWorkedTime = (clockIn: string, clockOut?: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const minutes = differenceInMinutes(end, start);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateWeeklyHours = () => {
    let totalMinutes = 0;
    weekRecords.forEach(record => {
      const start = new Date(record.clock_in);
      const end = record.clock_out ? new Date(record.clock_out) : new Date();
      totalMinutes += differenceInMinutes(end, start);
    });
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (!employeeId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            No estás asignado a este local como empleado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Clock In/Out Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Fichaje
            {locationName && (
              <Badge variant="outline" className="ml-auto font-normal">
                {locationName}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Time */}
          <div className="text-center">
            <p className="text-4xl font-bold font-mono">
              {format(currentTime, 'HH:mm:ss')}
            </p>
            <p className="text-muted-foreground">
              {format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>

          {/* Geolocation indicator */}
          {geoLocation && (
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Ubicación detectada</span>
            </div>
          )}

          {/* Clock In/Out Button */}
          {activeRecord ? (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Turno activo desde</p>
                <p className="font-semibold">
                  {format(new Date(activeRecord.clock_in), 'HH:mm')}
                </p>
                <p className="text-lg font-bold text-primary">
                  {calculateWorkedTime(activeRecord.clock_in)}
                </p>
              </div>
              <Button
                onClick={handleClockOut}
                disabled={loading}
                className="w-full h-14 text-lg"
                variant="destructive"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Fichar Salida
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClockIn}
              disabled={loading}
              className="w-full h-14 text-lg"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Fichar Entrada
            </Button>
          )}

          {/* Weekly Summary */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Esta semana:</span>
            <span className="font-semibold">{calculateWeeklyHours()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Weekly History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Historial Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {weekRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Sin fichajes esta semana
              </p>
            ) : (
              <div className="space-y-2">
                {weekRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(record.clock_in), 'EEEE d', { locale: es })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(record.clock_in), 'HH:mm')} - {' '}
                        {record.clock_out 
                          ? format(new Date(record.clock_out), 'HH:mm')
                          : 'En curso'}
                      </p>
                    </div>
                    <Badge variant={record.clock_out ? 'secondary' : 'default'}>
                      {calculateWorkedTime(record.clock_in, record.clock_out)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
