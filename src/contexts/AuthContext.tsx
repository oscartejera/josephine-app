import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { DEMO_MODE } from './DemoModeContext';

interface Profile {
  id: string;
  group_id: string | null;
  full_name: string | null;
}

interface UserRole {
  role_name: string;
  role_id: string;
  location_id: string | null;
  location_name: string | null;
}

interface Permission {
  permission_key: string;
  module: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  permissions: Permission[];
  loading: boolean;
  isOwner: boolean;
  hasGlobalScope: boolean;
  accessibleLocationIds: string[];
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (permissionKey: string, locationId?: string | null) => boolean;
  hasAnyPermission: (permissionKeys: string[]) => boolean;
  hasRole: (roleName: string) => boolean;
  isAdminOrOps: () => boolean;
  refreshPermissions: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // For action-level permission checks (not for hiding content)
  hasActionPermission: (permissionKey: string, locationId?: string | null) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [realIsOwner, setRealIsOwner] = useState(false);
  const [realHasGlobalScope, setRealHasGlobalScope] = useState(false);
  const [realAccessibleLocationIds, setRealAccessibleLocationIds] = useState<string[]>([]);

  // In DEMO_MODE, everyone acts as owner for viewing purposes
  const isOwner = DEMO_MODE ? true : realIsOwner;
  const hasGlobalScope = DEMO_MODE ? true : realHasGlobalScope;
  const accessibleLocationIds = realAccessibleLocationIds; // Still tracked for reference

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, group_id, full_name')
      .eq('id', userId)
      .single();
    return data as Profile | null;
  };

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch roles with scope using RPC
      const { data: rolesData } = await supabase.rpc('get_user_roles_with_scope', {
        _user_id: userId
      });
      
      if (rolesData) {
        setRoles(rolesData as UserRole[]);
      } else {
        setRoles([]);
      }

      // Check if owner
      const { data: isOwnerData } = await supabase.rpc('is_owner', {
        _user_id: userId
      });
      setRealIsOwner(isOwnerData === true);

      // Check global scope
      const { data: globalScopeData } = await supabase.rpc('get_user_has_global_scope', {
        _user_id: userId
      });
      setRealHasGlobalScope(globalScopeData === true);

      // Get accessible locations
      const { data: locationsData } = await supabase.rpc('get_user_accessible_locations', {
        _user_id: userId
      });
      if (locationsData) {
        setRealAccessibleLocationIds(locationsData as string[]);
      } else {
        setRealAccessibleLocationIds([]);
      }

      // Get permissions
      const { data: permsData } = await supabase.rpc('get_user_permissions', {
        _user_id: userId
      });
      if (permsData) {
        setPermissions(permsData as Permission[]);
      } else {
        setPermissions([]);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setRoles([]);
      setPermissions([]);
      setRealIsOwner(false);
      setRealHasGlobalScope(false);
      setRealAccessibleLocationIds([]);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
      await fetchUserData(user.id);
    }
  }, [user?.id, fetchUserData]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid blocking the auth state change
          setTimeout(async () => {
            const profileData = await fetchProfile(session.user.id);
            setProfile(profileData);
            await fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setPermissions([]);
          setRealIsOwner(false);
          setRealHasGlobalScope(false);
          setRealAccessibleLocationIds([]);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchUserData(session.user.id)
        ]).then(([profileData]) => {
          setProfile(profileData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Check if user has a specific permission - ALWAYS returns true in DEMO_MODE for viewing
  const hasPermission = useCallback((permissionKey: string, locationId?: string | null): boolean => {
    // In DEMO_MODE, all view permissions are granted
    if (DEMO_MODE) return true;
    // Owner has all permissions
    if (realIsOwner) return true;
    // Check if permission exists in user's permissions
    return permissions.some(p => p.permission_key === permissionKey);
  }, [realIsOwner, permissions]);

  // Real permission check for action buttons (can disable but not hide)
  const hasActionPermission = useCallback((permissionKey: string, locationId?: string | null): boolean => {
    // Owner has all permissions
    if (realIsOwner) return true;
    // Check if permission exists in user's permissions
    return permissions.some(p => p.permission_key === permissionKey);
  }, [realIsOwner, permissions]);

  // Check if user has any of the given permissions
  const hasAnyPermission = useCallback((permissionKeys: string[]): boolean => {
    if (DEMO_MODE) return true;
    if (realIsOwner) return true;
    return permissionKeys.some(key => permissions.some(p => p.permission_key === key));
  }, [realIsOwner, permissions]);

  // Check if user has a specific role
  const hasRole = useCallback((roleName: string): boolean => {
    if (DEMO_MODE && roleName === 'owner') return true;
    if (realIsOwner && roleName === 'owner') return true;
    return roles.some(r => r.role_name === roleName);
  }, [realIsOwner, roles]);

  // Check if user is admin or ops manager (legacy compatibility)
  const isAdminOrOps = useCallback((): boolean => {
    if (DEMO_MODE) return true;
    if (realIsOwner) return true;
    return roles.some(r => ['owner', 'admin', 'ops_manager'].includes(r.role_name));
  }, [realIsOwner, roles]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      permissions,
      loading,
      isOwner,
      hasGlobalScope,
      accessibleLocationIds,
      signIn,
      signUp,
      signOut,
      hasPermission,
      hasAnyPermission,
      hasRole,
      isAdminOrOps,
      refreshPermissions,
      refreshProfile,
      hasActionPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
