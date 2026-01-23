import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo } from 'react';
import { DEMO_MODE } from '@/contexts/DemoModeContext';

// Permission keys for the application
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_EXPORT: 'dashboard.export',
  
  // Insights
  INSIGHTS_VIEW: 'insights.view',
  
  // Sales
  SALES_VIEW: 'sales.view',
  SALES_EXPORT: 'sales.export',
  
  // Labour
  LABOUR_VIEW: 'labour.view',
  LABOUR_EXPORT: 'labour.export',
  
  // Instant P&L
  INSTANT_PL_VIEW: 'instant_pl.view',
  INSTANT_PL_EXPORT: 'instant_pl.export',
  
  // Reviews
  REVIEWS_VIEW: 'reviews.view',
  REVIEWS_REPLY_GENERATE: 'reviews.reply.generate',
  REVIEWS_REPLY_SUBMIT: 'reviews.reply.submit',
  REVIEWS_EXPORT: 'reviews.export',
  
  // Scheduling
  SCHEDULING_VIEW: 'scheduling.view',
  SCHEDULING_CREATE: 'scheduling.create',
  SCHEDULING_EDIT: 'scheduling.edit',
  SCHEDULING_PUBLISH: 'scheduling.publish',
  SCHEDULING_UNDO: 'scheduling.undo',
  
  // Availability
  AVAILABILITY_VIEW: 'availability.view',
  AVAILABILITY_EDIT: 'availability.edit',
  
  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_RECONCILIATION_EXPORT: 'inventory.reconciliation.export',
  
  // Waste
  WASTE_VIEW: 'waste.view',
  WASTE_EDIT: 'waste.edit',
  
  // Procurement
  PROCUREMENT_VIEW: 'procurement.view',
  PROCUREMENT_ORDER_CREATE: 'procurement.order.create',
  PROCUREMENT_ORDER_EDIT: 'procurement.order.edit',
  PROCUREMENT_ORDER_PLACE: 'procurement.order.place',
  PROCUREMENT_ORDER_PAY: 'procurement.order.pay',
  PROCUREMENT_ORDER_HISTORY_VIEW: 'procurement.order.history.view',
  
  // Menu Engineering
  MENU_ENGINEERING_VIEW: 'menu_engineering.view',
  MENU_ENGINEERING_EDIT: 'menu_engineering.edit',
  
  // Integrations
  INTEGRATIONS_VIEW: 'integrations.view',
  INTEGRATIONS_CONNECT: 'integrations.connect',
  INTEGRATIONS_DISCONNECT: 'integrations.disconnect',
  INTEGRATIONS_HEALTH_VIEW: 'integrations.health.view',
  
  // Payroll
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_EXPORT: 'payroll.export',
  PAYROLL_APPROVE_HOURS: 'payroll.approve_hours',
  
  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_USERS_MANAGE: 'settings.users.manage',
  SETTINGS_ROLES_MANAGE: 'settings.roles.manage',
  SETTINGS_BILLING_MANAGE: 'settings.billing.manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Sidebar visibility mapping
export const SIDEBAR_PERMISSIONS = {
  dashboard: [PERMISSIONS.DASHBOARD_VIEW],
  insights: [
    PERMISSIONS.INSIGHTS_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.LABOUR_VIEW,
    PERMISSIONS.INSTANT_PL_VIEW,
    PERMISSIONS.REVIEWS_VIEW,
  ],
  sales: [PERMISSIONS.SALES_VIEW],
  labour: [PERMISSIONS.LABOUR_VIEW],
  instant_pl: [PERMISSIONS.INSTANT_PL_VIEW],
  reviews: [PERMISSIONS.REVIEWS_VIEW],
  scheduling: [PERMISSIONS.SCHEDULING_VIEW],
  availability: [PERMISSIONS.AVAILABILITY_VIEW],
  inventory: [PERMISSIONS.INVENTORY_VIEW],
  waste: [PERMISSIONS.WASTE_VIEW],
  procurement: [PERMISSIONS.PROCUREMENT_VIEW],
  menu_engineering: [PERMISSIONS.MENU_ENGINEERING_VIEW],
  integrations: [PERMISSIONS.INTEGRATIONS_VIEW],
  payroll: [PERMISSIONS.PAYROLL_VIEW],
  settings: [PERMISSIONS.SETTINGS_VIEW],
} as const;

export function usePermissions() {
  const { 
    user,
    isOwner, 
    hasGlobalScope, 
    hasPermission, 
    hasAnyPermission,
    accessibleLocationIds,
    permissions,
    roles,
    loading 
  } = useAuth();

  // SIMPLIFIED: Any authenticated user can view all sidebar items
  const canViewSidebarItem = useCallback((item: keyof typeof SIDEBAR_PERMISSIONS): boolean => {
    return user !== null;
  }, [user]);

  // SIMPLIFIED: Any authenticated user can access any location in their group
  const canAccessLocation = useCallback((locationId: string): boolean => {
    return user !== null;
  }, [user]);

  // SIMPLIFIED: Return all locations for authenticated users
  const getAccessibleLocations = useCallback(<T extends { id: string }>(locations: T[]): T[] => {
    return locations;
  }, []);

  // SIMPLIFIED: Any authenticated user can see all locations
  const canShowAllLocations = useMemo(() => {
    return user !== null;
  }, [user]);

  // SIMPLIFIED: All authenticated users are treated as owners
  const primaryRole = useMemo(() => {
    return user !== null ? 'owner' : null;
  }, [user]);

  return {
    // State
    isOwner,
    hasGlobalScope,
    accessibleLocationIds,
    permissions,
    roles,
    loading,
    primaryRole,
    canShowAllLocations,
    
    // Methods
    hasPermission,
    hasAnyPermission,
    canViewSidebarItem,
    canAccessLocation,
    getAccessibleLocations,
  };
}
