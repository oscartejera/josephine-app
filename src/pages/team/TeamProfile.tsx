import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle,
  Mail,
  IdCard,
  DollarSign,
  Users,
  Megaphone,
  LogOut,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  hourly_cost: number | null;
  location_name: string;
}

export default function TeamProfile() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data: emp } = await supabase
        .from('employees')
        .select('id, full_name, email, role, hourly_cost, location_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .single();

      if (emp) {
        const { data: loc } = await supabase
          .from('locations')
          .select('name')
          .eq('id', emp.location_id)
          .single();

        setEmployee({
          id: emp.id,
          full_name: emp.full_name,
          email: emp.email || user.email || '',
          role: emp.role || 'Empleado',
          hourly_cost: emp.hourly_cost,
          location_name: loc?.name || 'Mi Local',
        });
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = employee?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-md mx-auto space-y-5">
      {/* Avatar + Name */}
      <div className="flex flex-col items-center text-center space-y-3 pt-2">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">{initials}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold">{employee?.full_name || 'Empleado'}</h1>
          <Badge variant="secondary" className="mt-1">
            {employee?.role}
          </Badge>
        </div>
        {employee && (
          <Badge variant="outline" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {employee.location_name}
          </Badge>
        )}
      </div>

      {/* Info Cards */}
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{employee?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">ID Empleado</p>
              <p className="text-sm font-medium font-mono">
                {employee?.id?.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          {employee?.hourly_cost != null && (
            <div className="flex items-center gap-3 px-4 py-3">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Coste/hora</p>
                <p className="text-sm font-medium">{employee.hourly_cost.toFixed(2)} €/h</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
            onClick={() => navigate('/team/directory')}
          >
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Equipo</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
            onClick={() => navigate('/team/news')}
          >
            <div className="flex items-center gap-3">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Novedades</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="w-full h-11 text-destructive hover:text-destructive hover:bg-destructive/5"
        onClick={handleSignOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Cerrar Sesión
      </Button>
    </div>
  );
}
