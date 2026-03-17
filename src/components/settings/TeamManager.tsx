import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserPlus, Mail, MapPin, Globe, Shield, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  roles: {
    id: string;
    role_id: string;
    role_name: string;
    location_id: string | null;
    location_name: string | null;
  }[];
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

// Roles that require location assignment
const LOCATION_REQUIRED_ROLES = ['employee', 'store_manager'];

// Role display configuration
const ROLE_DISPLAY: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  owner: { label: 'Owner', variant: 'default' },
  admin: { label: 'Admin', variant: 'default' },
  ops_manager: { label: 'Ops Manager', variant: 'secondary' },
  store_manager: { label: 'Store Manager', variant: 'secondary' },
  finance: { label: 'Finance', variant: 'outline' },
  hr_payroll: { label: 'HR & Payroll', variant: 'outline' },
  employee: { label: 'Employee', variant: 'outline' },
};

export function TeamManager() {
  const { locations, group } = useApp();
  const { user: currentUser, session } = useAuth();
  const { isOwner, hasPermission } = usePermissions();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // New member form state
  const [newMember, setNewMember] = useState({
    email: '',
    full_name: '',
    role_id: '',
    location_id: '' as string | null
  });

  const canManageUsers = isOwner || hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE);

  const fetchData = useCallback(async () => {
    if (!group?.id) return;
    setLoading(true);

    try {
      // Fetch roles
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name, description')
        .order('name');

      if (rolesData) {
        setRoles(rolesData);
      }

      // Fetch team members (profiles in the group)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, group_id, created_at')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false });

      if (!profilesData) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Fetch roles for each member
      const membersWithRoles: TeamMember[] = [];

      for (const profile of profilesData) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select(`
            id,
            role_id,
            location_id,
            roles(name),
            locations(name)
          `)
          .eq('user_id', profile.id);

        membersWithRoles.push({
          id: profile.id,
          email: '', // Email not available from profiles
          full_name: profile.full_name,
          roles: (userRoles || []).map((ur: any) => ({
            id: ur.id,
            role_id: ur.role_id,
            role_name: ur.roles?.name || 'Unknown',
            location_id: ur.location_id,
            location_name: ur.locations?.name || null
          })),
          created_at: profile.created_at
        });
      }

      setMembers(membersWithRoles);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar el equipo'
      });
    } finally {
      setLoading(false);
    }
  }, [group?.id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenInvite = () => {
    setNewMember({ email: '', full_name: '', role_id: '', location_id: null });
    setInviteSuccess(false);
    setShowInviteDialog(true);
  };

  const handleInvite = async () => {
    if (!newMember.email || !newMember.full_name || !newMember.role_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMember.email)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor ingresa un email válido'
      });
      return;
    }

    // Check if location is required
    const selectedRole = roles.find(r => r.id === newMember.role_id);
    if (selectedRole && LOCATION_REQUIRED_ROLES.includes(selectedRole.name) && !newMember.location_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `El rol "${selectedRole.name}" requiere una ubicación específica`
      });
      return;
    }

    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke('invite_team_member', {
        body: {
          email: newMember.email,
          full_name: newMember.full_name,
          role_id: newMember.role_id,
          location_id: newMember.location_id || null,
          group_id: group?.id
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setInviteSuccess(true);
      toast({
        title: '¡Usuario invitado!',
        description: `Se ha enviado un email a ${newMember.email} con las credenciales de acceso.`
      });

      // Refresh the list
      await fetchData();

      // Close dialog after showing success
      setTimeout(() => {
        setShowInviteDialog(false);
        setInviteSuccess(false);
      }, 2000);

    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast({
        variant: 'destructive',
        title: 'Error al invitar',
        description: error.message || 'No se pudo enviar la invitación'
      });
    } finally {
      setInviting(false);
    }
  };

  const selectedRole = roles.find(r => r.id === newMember.role_id);
  const requiresLocation = selectedRole ? LOCATION_REQUIRED_ROLES.includes(selectedRole.name) : false;

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No tienes permisos para gestionar el equipo</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Equipo
              </CardTitle>
              <CardDescription>
                Gestiona los miembros del equipo de {group?.name || 'tu grupo'}
              </CardDescription>
            </div>
            <Button onClick={handleOpenInvite}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invitar Miembro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Sin miembros del equipo</h3>
              <p className="text-muted-foreground mb-4">
                Invita a tu primer miembro del equipo para comenzar.
              </p>
              <Button onClick={handleOpenInvite}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invitar Miembro
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Miembro</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(member => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {(member.full_name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.full_name || 'Usuario'}</p>
                          {member.id === currentUser?.id && (
                            <p className="text-xs text-muted-foreground">(Tú)</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.roles.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Sin rol</span>
                        ) : (
                          member.roles.map(role => {
                            const display = ROLE_DISPLAY[role.role_name] || { label: role.role_name, variant: 'outline' as const };
                            return (
                              <Badge key={role.id} variant={display.variant}>
                                {display.label}
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.roles.map(role => (
                        <div key={role.id} className="flex items-center gap-1 text-sm text-muted-foreground">
                          {role.location_id ? (
                            <>
                              <MapPin className="h-3 w-3" />
                              {role.location_name}
                            </>
                          ) : (
                            <>
                              <Globe className="h-3 w-3" />
                              Global
                            </>
                          )}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        Activo
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invitar Nuevo Miembro
            </DialogTitle>
            <DialogDescription>
              El nuevo miembro recibirá un email con sus credenciales de acceso.
            </DialogDescription>
          </DialogHeader>

          {inviteSuccess ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">¡Invitación Enviada!</h3>
              <p className="text-muted-foreground">
                Se ha enviado un email a <strong>{newMember.email}</strong> con las credenciales de acceso.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nombre Completo *</Label>
                  <Input
                    id="full_name"
                    placeholder="Juan García"
                    value={newMember.full_name}
                    onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                    disabled={inviting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="juan@ejemplo.com"
                      className="pl-10"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      disabled={inviting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select
                    value={newMember.role_id}
                    onValueChange={(value) => setNewMember({ ...newMember, role_id: value, location_id: null })}
                    disabled={inviting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => r.name !== 'owner').map(role => {
                        const display = ROLE_DISPLAY[role.name] || { label: role.name };
                        return (
                          <SelectItem key={role.id} value={role.id}>
                            <span className="flex items-center gap-2">
                              {display.label}
                              {LOCATION_REQUIRED_ROLES.includes(role.name) && (
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedRole && (
                    <p className="text-xs text-muted-foreground">
                      {selectedRole.description}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">
                    Ubicación {requiresLocation ? '*' : '(opcional)'}
                  </Label>
                  <Select
                    value={newMember.location_id || 'global'}
                    onValueChange={(value) => setNewMember({ 
                      ...newMember, 
                      location_id: value === 'global' ? null : value 
                    })}
                    disabled={inviting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      {!requiresLocation && (
                        <SelectItem value="global">
                          <span className="flex items-center gap-2">
                            <Globe className="h-3 w-3" />
                            Todas las ubicaciones
                          </span>
                        </SelectItem>
                      )}
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>
                          <span className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            {loc.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)} disabled={inviting}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={inviting}>
                  {inviting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar Invitación
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
