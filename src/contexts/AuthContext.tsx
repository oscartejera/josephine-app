import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  const [accessibleLocationIds, setAccessibleLocationIds] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [hasGlobalScope, setHasGlobalScope] = useState(false);

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
      // Batch all RPC calls in parallel for faster auth resolution
      const [rolesResult, ownerResult, globalResult, locationsResult, permsResult] = await Promise.all([
        supabase.rpc('get_user_roles_with_scope', { _user_id: userId }),
        supabase.rpc('is_owner', { _user_id: userId }),
        supabase.rpc('get_user_has_global_scope', { _user_id: userId }),
        supabase.rpc('get_user_accessible_locations', { _user_id: userId }),
        supabase.rpc('get_user_permissions', { _user_id: userId }),
      ]);

      setRoles(rolesResult.data ? (rolesResult.data as UserRole[]) : []);
      setIsOwner(ownerResult.data === true);
      setHasGlobalScope(globalResult.data === true);
      setAccessibleLocationIds(locationsResult.data ? (locationsResult.data as string[]) : []);
      setPermissions(permsResult.data ? (permsResult.data as Permission[]) : []);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setRoles([]);
      setPermissions([]);
      setAccessibleLocationIds([]);
      setIsOwner(false);
      setHasGlobalScope(false);
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
    let initialised = false;

    // Set up auth state listener FIRST (per Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip if this is the initial INITIAL_SESSION event — getSession handles it below
        if (!initialised) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const [profileData] = await Promise.all([
            fetchProfile(session.user.id),
            fetchUserData(session.user.id),
          ]);
          setProfile(profileData);
        } else {
          setProfile(null);
          setRoles([]);
          setPermissions([]);
          setAccessibleLocationIds([]);
        }
        setLoading(false);
      }
    );

    // THEN resolve the current session (avoids race condition)
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialised = true;
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

  // Real permission check using database roles
  const hasPermission = useCallback((permissionKey: string, locationId?: string | null): boolean => {
    if (!user) return false;
    if (isOwner) return true;
    return permissions.some(p => p.permission_key === permissionKey);
  }, [user, isOwner, permissions]);

  // Action permission check (alias for hasPermission)
  const hasActionPermission = hasPermission;

  // Check if user has any of the permissions
  const hasAnyPermission = useCallback((permissionKeys: string[]): boolean => {
    if (!user) return false;
    if (isOwner) return true;
    return permissionKeys.some(key => permissions.some(p => p.permission_key === key));
  }, [user, isOwner, permissions]);

  // Check role by name
  const hasRole = useCallback((roleName: string): boolean => {
    if (!user) return false;
    return roles.some(r => r.role_name === roleName);
  }, [user, roles]);

  // Check if admin or ops
  const isAdminOrOps = useCallback((): boolean => {
    if (!user) return false;
    if (isOwner) return true;
    return roles.some(r => ['admin', 'ops_manager'].includes(r.role_name));
  }, [user, isOwner, roles]);

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
