import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, Pencil, Trash2, Shield, MapPin, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

interface UserWithRoles {
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
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface RoleAssignment {
  role_id: string;
  location_id: string | null;
}

// Roles that require location assignment (cannot have global scope)
const LOCATION_REQUIRED_ROLES = ['employee', 'store_manager'];

// Role display names and colors
const ROLE_DISPLAY: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  owner: { label: 'Owner', variant: 'default' },
  admin: { label: 'Admin', variant: 'default' },
  ops_manager: { label: 'Ops Manager', variant: 'secondary' },
  store_manager: { label: 'Store Manager', variant: 'secondary' },
  finance: { label: 'Finance', variant: 'outline' },
  hr_payroll: { label: 'HR & Payroll', variant: 'outline' },
  employee: { label: 'Employee', variant: 'outline' },
};

export function UsersRolesManager() {
  const { locations, group } = useApp();
  const { user: currentUser } = useAuth();
  const { isOwner, hasPermission } = usePermissions();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New role assignment state
  const [newAssignment, setNewAssignment] = useState<RoleAssignment>({
    role_id: '',
    location_id: null
  });

  const canManageUsers = isOwner || hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE);
  const canViewRoles = isOwner || hasPermission(PERMISSIONS.SETTINGS_ROLES_MANAGE);

  const fetchData = useCallback(async () => {
    if (!group?.id) return;
    setLoading(true);

    try {
      // Fetch roles
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name, description, is_system')
        .order('name');

      if (rolesData) {
        setRoles(rolesData);
      }

      // Fetch users in the group with their roles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, group_id')
        .eq('group_id', group.id);

      if (!profilesData) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Fetch user roles for each profile
      const usersWithRoles: UserWithRoles[] = [];

      for (const profile of profilesData) {
        // Get user email from auth (we'll use the profile id)
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

        usersWithRoles.push({
          id: profile.id,
          email: '', // We'll display name instead
          full_name: profile.full_name,
          roles: (userRoles || []).map((ur: any) => ({
            id: ur.id,
            role_id: ur.role_id,
            role_name: ur.roles?.name || 'Unknown',
            location_id: ur.location_id,
            location_name: ur.locations?.name || null
          }))
        });
      }

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los usuarios'
      });
    } finally {
      setLoading(false);
    }
  }, [group?.id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditUser = (user: UserWithRoles) => {
    setEditingUser(user);
    setNewAssignment({ role_id: '', location_id: null });
    setShowEditDialog(true);
  };

  const handleAddRole = async () => {
    if (!editingUser || !newAssignment.role_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Selecciona un rol'
      });
      return;
    }

    const selectedRole = roles.find(r => r.id === newAssignment.role_id);
    const requiresLocation = LOCATION_REQUIRED_ROLES.includes(selectedRole?.name || '');

    if (requiresLocation && !newAssignment.location_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `El rol "${selectedRole?.name}" requiere una ubicación específica`
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: editingUser.id,
          role_id: newAssignment.role_id,
          location_id: newAssignment.location_id
        });

      if (error) {
        if (error.message.includes('cannot have global scope')) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Este rol requiere una ubicación específica'
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Rol asignado',
          description: 'El rol ha sido asignado correctamente'
        });
        await fetchData();
        // Update editing user with new data
        const updatedUser = users.find(u => u.id === editingUser.id);
        if (updatedUser) {
          setEditingUser(updatedUser);
        }
        setNewAssignment({ role_id: '', location_id: null });
      }
    } catch (error: any) {
      console.error('Error adding role:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo asignar el rol'
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRole = (roleId: string) => {
    setDeleteRoleId(roleId);
    setShowDeleteDialog(true);
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', deleteRoleId);

      if (error) throw error;

      toast({
        title: 'Rol eliminado',
        description: 'El rol ha sido eliminado correctamente'
      });

      await fetchData();
      // Refresh editing user
      if (editingUser) {
        const updatedUser = users.find(u => u.id === editingUser.id);
        setEditingUser(updatedUser || null);
      }
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar el rol'
      });
    } finally {
      setSaving(false);
      setDeleteRoleId(null);
      setShowDeleteDialog(false);
    }
  };

  const selectedRole = roles.find(r => r.id === newAssignment.role_id);
  const requiresLocation = LOCATION_REQUIRED_ROLES.includes(selectedRole?.name || '');

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No tienes permisos para gestionar usuarios</p>
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
                Usuarios y Roles
              </CardTitle>
              <CardDescription>
                Gestiona los usuarios y sus permisos en {group?.name || 'tu grupo'}
              </CardDescription>
            </div>
            <Button disabled>
              <Plus className="h-4 w-4 mr-2" />
              Invitar Usuario
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {(user.full_name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.full_name || 'Usuario'}</p>
                          {user.id === currentUser?.id && (
                            <p className="text-xs text-muted-foreground">(Tú)</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Sin roles</span>
                        ) : (
                          user.roles.map(role => {
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
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map(role => (
                          <div key={role.id} className="flex items-center gap-1 text-xs text-muted-foreground">
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
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {canViewRoles && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">Roles Disponibles</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {roles.map(role => {
                  const display = ROLE_DISPLAY[role.name] || { label: role.name, variant: 'outline' as const };
                  const requiresLoc = LOCATION_REQUIRED_ROLES.includes(role.name);
                  return (
                    <div key={role.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={display.variant} className="text-xs">
                          {display.label}
                        </Badge>
                        {requiresLoc && (
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {role.description || 'Sin descripción'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Roles de Usuario</DialogTitle>
            <DialogDescription>
              {editingUser?.full_name || 'Usuario'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Roles */}
            <div>
              <Label className="mb-2 block">Roles Actuales</Label>
              {editingUser?.roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin roles asignados</p>
              ) : (
                <div className="space-y-2">
                  {editingUser?.roles.map(role => {
                    const display = ROLE_DISPLAY[role.role_name] || { label: role.role_name, variant: 'outline' as const };
                    const isCurrentUser = editingUser.id === currentUser?.id;
                    const isOnlyOwner = role.role_name === 'owner' && users.filter(u => 
                      u.roles.some(r => r.role_name === 'owner')
                    ).length === 1;

                    return (
                      <div
                        key={role.id}
                        className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={display.variant}>{display.label}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {role.location_id ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {role.location_name}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                Todas las ubicaciones
                              </span>
                            )}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDeleteRole(role.id)}
                          disabled={isCurrentUser && isOnlyOwner}
                          title={isCurrentUser && isOnlyOwner ? 'No puedes eliminar tu propio rol de owner' : 'Eliminar rol'}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add New Role */}
            <div className="pt-4 border-t">
              <Label className="mb-2 block">Añadir Nuevo Rol</Label>
              <div className="flex flex-col gap-3">
                <Select
                  value={newAssignment.role_id}
                  onValueChange={(value) => setNewAssignment({ ...newAssignment, role_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => {
                      const display = ROLE_DISPLAY[role.name] || { label: role.name };
                      // Check if user already has this role (without location consideration for global roles)
                      const alreadyHas = editingUser?.roles.some(r => r.role_name === role.name && !r.location_id);
                      return (
                        <SelectItem
                          key={role.id}
                          value={role.id}
                          disabled={alreadyHas && !LOCATION_REQUIRED_ROLES.includes(role.name)}
                        >
                          {display.label}
                          {LOCATION_REQUIRED_ROLES.includes(role.name) && ' (requiere ubicación)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Location selector - show if role requires it OR if user wants to scope */}
                <Select
                  value={newAssignment.location_id || 'global'}
                  onValueChange={(value) => setNewAssignment({
                    ...newAssignment,
                    location_id: value === 'global' ? null : value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar scope" />
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

                <Button
                  onClick={handleAddRole}
                  disabled={!newAssignment.role_id || saving}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Rol
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el rol del usuario. Podrás volver a asignarlo después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
