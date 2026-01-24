import { useState } from 'react';
import { useNavigate, useParams, Outlet } from 'react-router-dom';
import { ChefHat, Map, Clock, ChefHat as KDSIcon, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

const staffNavItems = [
  { icon: Map, label: 'Mesas', path: 'floor' },
  { icon: Clock, label: 'Fichaje', path: 'clock' },
  { icon: KDSIcon, label: 'Cocina', path: 'kds' },
];

export function StaffLayout() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { primaryRole } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getRoleLabel = (role: string | null) => {
    const labels: Record<string, string> = {
      owner: 'Propietario',
      admin: 'Administrador',
      ops_manager: 'Gerente de Operaciones',
      store_manager: 'Gerente de Local',
      finance: 'Finanzas',
      hr_payroll: 'RRHH / Nóminas',
      employee: 'Empleado',
    };
    return role ? labels[role] || role : 'Empleado';
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-display font-bold text-lg">Josephine</span>
            <p className="text-xs text-muted-foreground">Staff</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {staffNavItems.map((item) => {
          const fullPath = `/staff/${locationId}/${item.path}`;
          const isActive = window.location.pathname.includes(item.path);
          return (
            <Button
              key={item.path}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-12",
                isActive && "bg-accent text-accent-foreground font-medium"
              )}
              onClick={() => {
                navigate(fullPath);
                setMobileOpen(false);
              }}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-4">
        <div className="mb-3">
          <p className="text-sm font-medium truncate">
            {profile?.full_name || 'Usuario'}
          </p>
          <p className="text-xs text-muted-foreground">
            {getRoleLabel(primaryRole)}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-primary" />
          <span className="font-display font-bold">Josephine</span>
        </div>

        <div className="w-10" /> {/* Spacer for balance */}
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 h-screen w-64 bg-card border-r border-border">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
