import { useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  Clock,
  Wallet,
  Users,
  Megaphone,
  LogOut,
  Menu,
  ChefHat,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

const teamNavItems = [
  { icon: Home, label: 'Inicio', path: '/team' },
  { icon: Calendar, label: 'Mi Horario', path: '/team/schedule' },
  { icon: Clock, label: 'Fichaje', path: '/team/clock' },
  { icon: Wallet, label: 'Mi Nómina', path: '/team/pay' },
  { icon: Users, label: 'Equipo', path: '/team/directory' },
  { icon: Megaphone, label: 'Novedades', path: '/team/news' },
];

export function TeamLayout() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isManagerRole = primaryRole && ['owner', 'admin', 'ops_manager', 'store_manager'].includes(primaryRole);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="font-display font-bold text-lg">Josephine</span>
            <p className="text-xs text-muted-foreground">Portal de Equipo</p>
          </div>
        </div>
      </div>

      {/* User Card */}
      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {profile?.full_name || 'Usuario'}
            </p>
            <p className="text-xs text-muted-foreground">
              {getRoleLabel(primaryRole)}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {teamNavItems.map((item) => {
          const isActive =
            item.path === '/team'
              ? location.pathname === '/team'
              : location.pathname.startsWith(item.path);
          return (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 h-11 rounded-xl font-normal',
                isActive &&
                  'bg-primary/10 text-primary font-medium hover:bg-primary/15'
              )}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-1">
        {isManagerRole && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-11 rounded-xl text-muted-foreground hover:text-foreground font-normal"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Panel de gestión</span>
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 rounded-xl text-muted-foreground hover:text-foreground font-normal"
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
          <SheetContent side="left" className="p-0 w-72">
            <NavContent />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-primary" />
          <span className="font-display font-bold">Josephine</span>
        </div>

        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {getInitials(profile?.full_name)}
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-50 flex items-center justify-around px-2">
        {teamNavItems.slice(0, 5).map((item) => {
          const isActive =
            item.path === '/team'
              ? location.pathname === '/team'
              : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
              onClick={() => navigate(item.path)}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 h-screen w-72 bg-card border-r border-border">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
