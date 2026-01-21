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
  LineChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const INSIGHTS_EXPANDED_KEY = 'sidebar.insights.expanded';

const insightsChildren = [
  { icon: TrendingUp, label: 'Sales', path: '/insights/sales', permission: PERMISSIONS.SALES_VIEW },
  { icon: Users, label: 'Labour', path: '/insights/labour', permission: PERMISSIONS.LABOUR_VIEW },
  { icon: BarChart3, label: 'Instant P&L', path: '/insights/instant-pl', permission: PERMISSIONS.INSTANT_PL_VIEW },
  { icon: Star, label: 'Reviews', path: '/insights/reviews', permission: PERMISSIONS.REVIEWS_VIEW },
];

// Availability is ONLY for employees (not owner, admin, ops_manager, store_manager)
const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  { icon: CalendarDays, label: 'Scheduling', path: '/scheduling', permission: PERMISSIONS.SCHEDULING_VIEW },
  { icon: Clock, label: 'Availability', path: '/availability', permission: PERMISSIONS.AVAILABILITY_VIEW, employeeOnly: true },
  { icon: Package, label: 'Inventory', path: '/inventory', permission: PERMISSIONS.INVENTORY_VIEW },
  { icon: Trash2, label: 'Waste', path: '/waste', permission: PERMISSIONS.WASTE_VIEW },
  { icon: ShoppingCart, label: 'Procurement', path: '/procurement', permission: PERMISSIONS.PROCUREMENT_VIEW },
  { icon: ChefHat, label: 'Menu Engineering', path: '/menu-engineering', permission: PERMISSIONS.MENU_ENGINEERING_VIEW },
  { icon: Plug, label: 'Integrations', path: '/integrations', permission: PERMISSIONS.INTEGRATIONS_VIEW },
  { icon: Calculator, label: 'Payroll', path: '/payroll', permission: PERMISSIONS.PAYROLL_VIEW },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { isOwner, primaryRole, hasPermission, hasAnyPermission } = usePermissions();

  const isInsightsRoute = location.pathname.startsWith('/insights');

  const [insightsExpanded, setInsightsExpanded] = useState(() => {
    if (isInsightsRoute) return true;
    const stored = localStorage.getItem(INSIGHTS_EXPANDED_KEY);
    return stored === 'true';
  });

  // Filter nav items based on permissions
  // Availability is only for employees (not owner, admin, ops_manager, store_manager)
  const isManagerOrAbove = useMemo(() => {
    return isOwner || ['admin', 'ops_manager', 'store_manager'].includes(primaryRole || '');
  }, [isOwner, primaryRole]);

  const visibleNavItems = useMemo(() => {
    return navItems.filter(item => {
      // Availability is only for employees, not managers/owners
      if (item.employeeOnly && isManagerOrAbove) {
        return false;
      }
      // Check permission (owners always see everything)
      if (isOwner) return !item.employeeOnly; // Owners don't see employee-only items
      return hasPermission(item.permission);
    });
  }, [isOwner, isManagerOrAbove, hasPermission]);

  const visibleInsightsChildren = useMemo(() => {
    if (isOwner) return insightsChildren;
    return insightsChildren.filter(item => hasPermission(item.permission));
  }, [isOwner, hasPermission]);

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
          {/* Dashboard */}
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

          {/* Insights Collapsible */}
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

          {/* Other nav items (skip Dashboard, it's already rendered) */}
          {visibleNavItems.slice(1).map((item) => {
            const isActive = location.pathname === item.path || 
              location.pathname.startsWith(item.path + '/');
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
