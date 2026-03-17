import { useState, useEffect } from 'react';
import { ClockInPanel } from '@/components/staff/ClockInPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function TeamClock() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchLocation = async () => {
      const { data: employee } = await supabase
        .from('employees')
        .select('location_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .single();

      if (employee) {
        setLocationId(employee.location_id);

        const { data: loc } = await supabase
          .from('locations')
          .select('name')
          .eq('id', employee.location_id)
          .single();

        setLocationName(loc?.name || 'Mi Local');
      }
      setLoading(false);
    };

    fetchLocation();
  }, [user]);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!locationId) {
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">
              No estás asignado a ningún local como empleado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Fichaje</h1>
        <p className="text-sm text-muted-foreground">
          Registra tu entrada y salida
        </p>
      </div>
      <ClockInPanel locationId={locationId} locationName={locationName} />
    </div>
  );
}
