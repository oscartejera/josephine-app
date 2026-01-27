import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Package,
  Trash2,
  ShoppingCart,
  ChefHat,
  Plug,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Calculator,
  BarChart3,
  Star,
  CalendarDays,
  Clock,
  LineChart,
  Wallet,
  PiggyBank,
  Monitor,
  Receipt,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, SIDEBAR_PERMISSIONS } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

const INSIGHTS_EXPANDED_KEY = 'sidebar.insights.expanded';

// Insights children with permission keys
const insightsChildren = [
  { icon: TrendingUp, label: 'Sales', path: '/insights/sales', key: 'sales' as const },
  { icon: Users, label: 'Labour', path: '/insights/labour', key: 'labour' as const },
  { icon: BarChart3, label: 'Instant P&L', path: '/insights/instant-pl', key: 'instant_pl' as const },
  { icon: Star, label: 'Reviews', path: '/insights/reviews', key: 'reviews' as const },
  { icon: Package, label: 'Inventory', path: '/insights/inventory', key: 'inventory' as const },
  { icon: Trash2, label: 'Waste', path: '/insights/waste', key: 'waste' as const },
  { icon: ChefHat, label: 'Menu Engineering', path: '/insights/menu-engineering', key: 'menu_engineering' as const },
  { icon: Wallet, label: 'Cash Management', path: '/insights/cash-management', key: 'settings' as const },
  { icon: PiggyBank, label: 'Budgets', path: '/insights/budgets', key: 'settings' as const },
  { icon: ChefHat, label: 'KDS Dashboard', path: '/insights/kds', key: 'dashboard' as const },
];

// Nav items with permission keys
const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', key: 'dashboard' as const },
  { icon: Monitor, label: 'POS', path: '/pos', key: 'dashboard' as const, highlight: true },
  { icon: BookOpen, label: 'Reservas', path: '/reservations', key: 'dashboard' as const },
  { icon: CalendarDays, label: 'Scheduling', path: '/scheduling', key: 'scheduling' as const },
  { icon: Clock, label: 'Availability', path: '/availability', key: 'availability' as const },
  { icon: ShoppingCart, label: 'Procurement', path: '/procurement', key: 'procurement' as const },
  { icon: Plug, label: 'Integrations', path: '/integrations', key: 'integrations' as const },
  { icon: Calculator, label: 'Payroll', path: '/payroll', key: 'payroll' as const },
  { icon: Receipt, label: 'Fiscal', path: '/fiscal', key: 'fiscal' as const },
];

const roleLabels: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  ops_manager: 'Gerente Ops',
  store_manager: 'Gerente Local',
  finance: 'Finanzas',
  hr_payroll: 'RRHH',
  employee: 'Empleado',
};
interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { canViewSidebarItem, primaryRole, isOwner } = usePermissions();

  // Filter nav items by permission
  const visibleNavItems = useMemo(() => {
    return navItems.filter(item => canViewSidebarItem(item.key));
  }, [canViewSidebarItem]);

  // Filter insights children by permission
  const visibleInsightsChildren = useMemo(() => {
    return insightsChildren.filter(item => canViewSidebarItem(item.key));
  }, [canViewSidebarItem]);

  // Check if insights section should be visible
  const showInsights = canViewSidebarItem('insights') || visibleInsightsChildren.length > 0;
  const isInsightsRoute = location.pathname.startsWith('/insights') || 
    location.pathname.startsWith('/inventory') || 
    location.pathname.startsWith('/waste') || 
    location.pathname.startsWith('/menu-engineering');

  const [insightsExpanded, setInsightsExpanded] = useState(() => {
    if (isInsightsRoute) return true;
    const stored = localStorage.getItem(INSIGHTS_EXPANDED_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    if (isInsightsRoute) {
      setInsightsExpanded(true);
    }
  }, [isInsightsRoute]);

  useEffect(() => {
    localStorage.setItem(INSIGHTS_EXPANDED_KEY, String(insightsExpanded));
  }, [insightsExpanded]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleInsightsToggle = () => {
    setInsightsExpanded(prev => !prev);
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
          {/* Dashboard - only show if has permission */}
          {canViewSidebarItem('dashboard') && (
            <Button
              variant={location.pathname === '/dashboard' ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-10",
                location.pathname === '/dashboard' && "bg-accent text-accent-foreground font-medium",
                collapsed && "justify-center px-2"
              )}
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Dashboard</span>}
            </Button>
          )}

          {/* Insights Collapsible - only show if has permission */}
          {showInsights && (
            <Collapsible open={insightsExpanded && !collapsed} onOpenChange={handleInsightsToggle}>
              <CollapsibleTrigger asChild>
                <Button
                  variant={isInsightsRoute ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    isInsightsRoute && "bg-accent/50 text-accent-foreground font-medium",
                    collapsed && "justify-center px-2"
                  )}
                  aria-expanded={insightsExpanded}
                  aria-controls="insights-content"
                >
                  <LineChart className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">Insights</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        insightsExpanded && "rotate-180"
                      )} />
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent id="insights-content" className="space-y-1 mt-1">
                {visibleInsightsChildren.map((item) => {
                  const isActive = location.pathname === item.path || 
                    (item.path === '/insights/reviews' && location.pathname.startsWith('/insights/reviews'));
                  return (
                    <Button
                      key={item.path}
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 h-10 pl-9",
                        isActive && "bg-accent text-accent-foreground font-medium"
                      )}
                      onClick={() => navigate(item.path)}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Other nav items - filtered by permission */}
          {visibleNavItems.filter(item => item.path !== '/dashboard').map((item) => {
            const isActive = location.pathname === item.path || 
              location.pathname.startsWith(item.path + '/');
            const isHighlight = 'highlight' in item && item.highlight;
            return (
              <Button
                key={item.path}
                variant={isActive ? "secondary" : isHighlight ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-10",
                  isActive && "bg-accent text-accent-foreground font-medium",
                  isHighlight && !isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );
          })}

          {/* Settings - only show if has permission */}
          {canViewSidebarItem('settings') && (
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
          )}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-border p-4">
        {!collapsed && profile && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium truncate">{profile.full_name || 'Usuario'}</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {roleLabels[primaryRole || ''] || 'Usuario'}
              </Badge>
            </div>
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
