import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  MapPin,
  Briefcase,
  Phone,
  Mail,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMember {
  id: string;
  full_name: string;
  role_name: string;
  location_id: string;
  location_name: string;
  active: boolean;
}

export default function TeamDirectory() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchTeam = async () => {
      setLoading(true);

      // First get current user's location
      const { data: myEmployee } = await supabase
        .from('employees')
        .select('location_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
        .single();

      if (!myEmployee) {
        setLoading(false);
        return;
      }

      // Get all employees at the same location
      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, role_name, location_id, active')
        .eq('location_id', myEmployee.location_id)
        .eq('active', true)
        .order('full_name', { ascending: true });

      // Get location name
      const { data: location } = await supabase
        .from('locations')
        .select('name')
        .eq('id', myEmployee.location_id)
        .single();

      if (employees) {
        setMembers(
          employees.map((e) => ({
            ...e,
            location_name: location?.name || 'Mi Local',
          }))
        );
      }

      setLoading(false);
    };

    fetchTeam();
  }, [user]);

  const getRoleLabel = (role: string | null) => {
    const labels: Record<string, string> = {
      owner: 'Propietario',
      admin: 'Administrador',
      ops_manager: 'Gerente de Operaciones',
      store_manager: 'Gerente de Local',
      finance: 'Finanzas',
      hr_payroll: 'RRHH',
      employee: 'Empleado',
      waiter: 'Camarero/a',
      cook: 'Cocinero/a',
      bartender: 'Barista',
      manager: 'Encargado/a',
      host: 'Hostess',
      dishwasher: 'Friegaplatos',
      delivery: 'Repartidor/a',
    };
    return role ? labels[role] || role : 'Empleado';
  };

  const getRoleColor = (role: string | null) => {
    if (!role) return 'bg-gray-100 text-gray-700';
    if (['owner', 'admin', 'ops_manager', 'store_manager', 'manager'].includes(role))
      return 'bg-purple-100 text-purple-700';
    if (['cook', 'dishwasher'].includes(role)) return 'bg-orange-100 text-orange-700';
    if (['waiter', 'host', 'bartender'].includes(role)) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-rose-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const filteredMembers = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const locationName = members[0]?.location_name || 'Equipo';

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Equipo</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {locationName} · {members.length} personas
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar compañero/a..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Team Members List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">
              {search ? 'No se encontraron resultados' : 'No hay miembros del equipo'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className={`${getAvatarColor(member.full_name)} text-white font-semibold`}
                    >
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{member.full_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(
                          member.role_name
                        )}`}
                      >
                        {getRoleLabel(member.role_name)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
