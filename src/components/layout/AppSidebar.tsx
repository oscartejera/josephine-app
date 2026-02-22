import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Package,
  Trash2,
  ShoppingCart,
  ChefHat,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Calculator,
  BarChart3,
  Star,
  CalendarDays,
  CalendarCheck,
  Clock,
  LineChart,
  Wallet,
  PiggyBank,
  Monitor,
  QrCode,
  Plug2,
  UserCircle,
  MapPin,
  Check,
  ClipboardList,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { usePermissions, SIDEBAR_PERMISSIONS } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const INSIGHTS_EXPANDED_KEY = 'sidebar.insights.expanded';

// Insights children
const insightsChildren = [
  { icon: TrendingUp, i18nKey: 'nav.sales', path: '/insights/sales', key: 'sales' as const },
  { icon: Users, i18nKey: 'nav.labour', path: '/insights/labour', key: 'labour' as const },
  { icon: BarChart3, i18nKey: 'nav.instantPL', path: '/insights/instant-pl', key: 'instant_pl' as const },
  { icon: Star, i18nKey: 'nav.reviews', path: '/insights/reviews', key: 'reviews' as const },
  { icon: Package, i18nKey: 'nav.inventory', path: '/insights/inventory', key: 'inventory' as const },
  { icon: Trash2, i18nKey: 'nav.waste', path: '/insights/waste', key: 'waste' as const },
  { icon: ChefHat, i18nKey: 'nav.menuEngineering', path: '/insights/menu-engineering', key: 'menu_engineering' as const },
  { icon: Wallet, i18nKey: 'nav.cashManagement', path: '/insights/cash-management', key: 'settings' as const },
  { icon: PiggyBank, i18nKey: 'nav.budgets', path: '/insights/budgets', key: 'settings' as const },
];

// Workforce children
const workforceChildren = [
  { icon: CalendarDays, i18nKey: 'nav.schedule', path: '/scheduling', key: 'scheduling' as const },
  { icon: Clock, i18nKey: 'nav.availability', path: '/availability', key: 'availability' as const },
  { icon: Calculator, i18nKey: 'nav.payroll', path: '/payroll', key: 'payroll' as const },
];

// Main nav items
const navItems = [
  { icon: LayoutDashboard, i18nKey: 'nav.controlTower', path: '/dashboard', key: 'dashboard' as const },
];
interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signOut, profile } = useAuth();
  const { canViewSidebarItem, primaryRole, isOwner } = usePermissions();
  const { accessibleLocations, selectedLocationId, setSelectedLocationId, canShowAllLocations } = useApp();

  const selectedLocationLabel = selectedLocationId === 'all'
    ? t('common.allLocations')
    : accessibleLocations.find(l => l.id === selectedLocationId)?.name || t('common.allLocations');

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

  const [workforceExpanded, setWorkforceExpanded] = useState(false);
  const isWorkforceRoute = location.pathname.startsWith('/scheduling') ||
    location.pathname.startsWith('/availability') ||
    location.pathname.startsWith('/payroll');

  useEffect(() => {
    if (isInsightsRoute) {
      setInsightsExpanded(true);
    }
  }, [isInsightsRoute]);

  useEffect(() => {
    if (isWorkforceRoute) {
      setWorkforceExpanded(true);
    }
  }, [isWorkforceRoute]);

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
          {/* Global Location Selector */}
          {!collapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 mb-2 border-border/60 bg-muted/30 hover:bg-muted/50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1 text-left text-sm truncate">{selectedLocationLabel}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {canShowAllLocations && (
                  <DropdownMenuItem onClick={() => setSelectedLocationId('all')}>
                    <span className="flex-1">All locations</span>
                    {selectedLocationId === 'all' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                )}
                {accessibleLocations.map(loc => (
                  <DropdownMenuItem key={loc.id} onClick={() => setSelectedLocationId(loc.id)}>
                    <span className="flex-1">{loc.name}</span>
                    {selectedLocationId === loc.id && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full h-10 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56">
                {canShowAllLocations && (
                  <DropdownMenuItem onClick={() => setSelectedLocationId('all')}>
                    <span className="flex-1">All locations</span>
                    {selectedLocationId === 'all' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                )}
                {accessibleLocations.map(loc => (
                  <DropdownMenuItem key={loc.id} onClick={() => setSelectedLocationId(loc.id)}>
                    <span className="flex-1">{loc.name}</span>
                    {selectedLocationId === loc.id && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
              {!collapsed && <span>{t('nav.controlTower')}</span>}
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
                      <span className="flex-1 text-left">{t('nav.insights')}</span>
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
                      <span>{t(item.i18nKey)}</span>
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Workforce Collapsible */}
          <Collapsible open={workforceExpanded && !collapsed} onOpenChange={() => setWorkforceExpanded(prev => !prev)}>
            <CollapsibleTrigger asChild>
              <Button
                variant={isWorkforceRoute ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-10",
                  isWorkforceRoute && "bg-accent/50 text-accent-foreground font-medium",
                  collapsed && "justify-center px-2"
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{t('nav.workforce')}</span>
                    <ChevronDown className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      workforceExpanded && "rotate-180"
                    )} />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {workforceChildren.map((item) => {
                const isActive = location.pathname === item.path;
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
                    <span>{t(item.i18nKey)}</span>
                  </Button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Purchases */}
          <Button
            variant={location.pathname === '/procurement' ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname === '/procurement' && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/procurement')}
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.purchases')}</span>}
          </Button>

          {/* Inventory Setup */}
          <Button
            variant={location.pathname.startsWith('/inventory-setup') ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname.startsWith('/inventory-setup') && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/inventory-setup/items')}
          >
            <Package className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.inventorySetup')}</span>}
          </Button>

          {/* Escandallos (BOM) */}
          <Button
            variant={location.pathname.startsWith('/inventory-setup/recipes') ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname.startsWith('/inventory-setup/recipes') && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/inventory-setup/recipes')}
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.escandallos')}</span>}
          </Button>

          {/* Operaciones */}
          <Button
            variant={location.pathname === '/operations/waste-entry' ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname === '/operations/waste-entry' && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/operations/waste-entry')}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.waste')}</span>}
          </Button>

          <Button
            variant={location.pathname === '/operations/stock-audit' ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname === '/operations/stock-audit' && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/operations/stock-audit')}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('inventory.stockCount')}</span>}
          </Button>

          {/* Integrations */}
          <Button
            variant={location.pathname.startsWith('/integrations') ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname.startsWith('/integrations') && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/integrations')}
          >
            <Plug2 className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.integrations')}</span>}
          </Button>

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
                {!collapsed && <span>{t(item.i18nKey)}</span>}
              </Button>
            );
          })}

          {/* Team Portal */}
          <Button
            variant={location.pathname.startsWith('/team') ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 h-10",
              location.pathname.startsWith('/team') && "bg-accent text-accent-foreground font-medium",
              collapsed && "justify-center px-2"
            )}
            onClick={() => navigate('/team')}
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('settings.team')}</span>}
          </Button>

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
              {!collapsed && <span>{t('nav.settings')}</span>}
            </Button>
          )}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-border p-4">
        {!collapsed && profile && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium truncate">{profile.full_name || t('common.name')}</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {t(`roles.${primaryRole || 'employee'}`)}
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
          {!collapsed && <span>{t('nav.logout')}</span>}
        </Button>
      </div>
    </aside>
  );
}
