/**
 * TopBar - Simplified breadcrumb only
 */

import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation();

  // Generate breadcrumb from path
  const getBreadcrumb = () => {
    const path = location.pathname;
    
    // Map paths to readable breadcrumbs
    const breadcrumbMap: Record<string, string> = {
      '/dashboard': 'Control Tower',
      '/insights/sales': 'Insights / Sales',
      '/insights/labour': 'Insights / Labour',
      '/insights/instant-pl': 'Insights / Flash P&L',
      '/insights/reviews': 'Insights / Reviews',
      '/insights/inventory': 'Insights / Inventory',
      '/insights/waste': 'Insights / Waste',
      '/insights/menu-engineering': 'Insights / Menu Engineering',
      '/insights/cash-management': 'Insights / Cash Management',
      '/insights/budgets': 'Insights / Budgets',
      '/scheduling': 'Workforce / Schedule',
      '/availability': 'Workforce / Availability',
      '/payroll': 'Workforce / Payroll',
      '/procurement': 'Purchases',
      '/inventory-setup/items': 'Inventory Setup / Items',
      '/integrations': 'Integrations',
      '/integrations/square': 'Integrations / Square',
      '/settings': 'Settings',
    };

    return breadcrumbMap[path] || 'Josephine';
  };

  return (
    <header className="h-16 border-b bg-background flex items-center px-6 sticky top-0 z-40">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden mr-4"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumb - Clean and simple */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {getBreadcrumb()}
      </div>

      {/* Right side - empty for now, can add actions later */}
      <div className="flex-1" />
    </header>
  );
}
