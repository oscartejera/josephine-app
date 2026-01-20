import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Package,
  ShoppingCart,
  ChefHat,
  Plug,
  Settings,
  LogOut,
  ChevronLeft,
  Calculator,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: TrendingUp, label: 'Forecast', path: '/forecast' },
  { icon: Users, label: 'Labor', path: '/labor' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: ShoppingCart, label: 'Procurement', path: '/procurement' },
  { icon: ChefHat, label: 'Menu Engineering', path: '/menu-engineering' },
  { icon: Plug, label: 'Integrations', path: '/integrations' },
  { icon: Calculator, label: 'Payroll', path: '/payroll' },
];

const biItems = [
  { label: 'Sales', path: '/bi/sales' },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [biOpen, setBiOpen] = useState(location.pathname.startsWith('/bi'));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">Josephine</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn("h-8 w-8", collapsed && "mx-auto")}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-10",
                  isActive && "bg-accent text-accent-foreground font-medium",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );
          })}

          {/* Business Intelligence Group */}
          {!collapsed ? (
            <Collapsible open={biOpen} onOpenChange={setBiOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant={location.pathname.startsWith('/bi') ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    location.pathname.startsWith('/bi') && "bg-accent text-accent-foreground font-medium"
                  )}
                >
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Business Intelligence</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", biOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-7 space-y-1 mt-1">
                {biItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Button
                      key={item.path}
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start h-9 text-sm",
                        isActive && "bg-accent text-accent-foreground font-medium"
                      )}
                      onClick={() => navigate(item.path)}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Button
              variant={location.pathname.startsWith('/bi') ? "secondary" : "ghost"}
              className="w-full justify-center px-2 h-10"
              onClick={() => navigate('/bi/sales')}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
            </Button>
          )}

          <Button
            variant={location.pathname === '/settings' ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname === '/settings' && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Button>
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-border p-4">
        {!collapsed && profile && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium truncate">{profile.full_name || 'Usuario'}</p>
            <p className="text-xs text-muted-foreground truncate">Administrador</p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-foreground",
            collapsed && "justify-center px-2"
          )}
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Cerrar sesión</span>}
        </Button>
      </div>
    </aside>
  );
}
