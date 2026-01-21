import React from 'react';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';

interface PermissionGateProps {
  /** Single permission required */
  permission?: PermissionKey;
  /** Multiple permissions - user needs at least one */
  anyOf?: PermissionKey[];
  /** Multiple permissions - user needs all */
  allOf?: PermissionKey[];
  /** Location ID for scoped permissions */
  locationId?: string | null;
  /** Content to show when user has permission */
  children: React.ReactNode;
  /** Content to show when user lacks permission (optional) */
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions.
 * Owners always have access.
 * 
 * Usage:
 * <PermissionGate permission="scheduling.publish">
 *   <PublishButton />
 * </PermissionGate>
 * 
 * <PermissionGate anyOf={["sales.view", "labour.view"]} fallback={<NoAccess />}>
 *   <Dashboard />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  locationId,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { isOwner, hasPermission, hasAnyPermission } = usePermissions();

  // Owner bypasses all checks
  if (isOwner) {
    return <>{children}</>;
  }

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission, locationId);
  } else if (anyOf && anyOf.length > 0) {
    hasAccess = hasAnyPermission(anyOf);
  } else if (allOf && allOf.length > 0) {
    hasAccess = allOf.every(p => hasPermission(p, locationId));
  } else {
    // No permission specified = show content
    hasAccess = true;
  }

  return <>{hasAccess ? children : fallback}</>;
}

/**
 * Hook-based alternative for permission checking in component logic
 */
export function usePermissionCheck(options: {
  permission?: PermissionKey;
  anyOf?: PermissionKey[];
  allOf?: PermissionKey[];
  locationId?: string | null;
}): boolean {
  const { isOwner, hasPermission, hasAnyPermission } = usePermissions();
  
  if (isOwner) return true;
  
  const { permission, anyOf, allOf, locationId } = options;

  if (permission) {
    return hasPermission(permission, locationId);
  } else if (anyOf && anyOf.length > 0) {
    return hasAnyPermission(anyOf);
  } else if (allOf && allOf.length > 0) {
    return allOf.every(p => hasPermission(p, locationId));
  }
  
  return true;
}
