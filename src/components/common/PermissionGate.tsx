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
  /** Content to show when user lacks permission (optional) - IGNORED in current implementation */
  fallback?: React.ReactNode;
  /** 
   * If true, this gate is for an ACTION (button/form) not VIEW
   * Actions can be disabled but content is never hidden
   */
  isAction?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions.
 * 
 * IMPORTANT: In this unified UI approach, we NEVER hide content.
 * - For VIEW permissions: Always show content (DEMO_MODE or production)
 * - For ACTION permissions: Content is shown but may be disabled
 * 
 * If you need to disable an action button, wrap it with isAction={true}
 * and check the returned `disabled` state via usePermissionCheck hook instead.
 * 
 * Usage:
 * <PermissionGate permission="scheduling.publish">
 *   <PublishButton />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
}: PermissionGateProps) {
  // Always render children - no content hiding
  return <>{children}</>;
}

/**
 * Hook-based permission checking for action-level control
 * Returns true if user has permission, false otherwise
 * 
 * Use this to DISABLE actions (not hide them):
 * const canPublish = usePermissionCheck({ permission: 'scheduling.publish' });
 * <Button disabled={!canPublish}>Publish</Button>
 */
export function usePermissionCheck(options: {
  permission?: PermissionKey;
  anyOf?: PermissionKey[];
  allOf?: PermissionKey[];
  locationId?: string | null;
}): boolean {
  const { hasPermission, hasAnyPermission } = usePermissions();
  
  // In DEMO_MODE, all permissions are granted for viewing
  // But for actions, we still check real permissions
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

/**
 * Hook for action-level permission checking
 * Unlike usePermissionCheck, this checks REAL permissions even in DEMO_MODE
 * Use for action buttons that should be disabled for users without permission
 */
export function useActionPermission(permissionKey: PermissionKey): boolean {
  const { isOwner, permissions } = usePermissions();
  
  // Owner always has permission
  if (isOwner) return true;
  
  // Check actual permissions (bypasses DEMO_MODE)
  return permissions.some(p => p.permission_key === permissionKey);
}
