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
  const [realAccessibleLocationIds, setRealAccessibleLocationIds] = useState<string[]>([]);

  // SIMPLIFIED: Any authenticated user is now treated as owner with full access
  const isOwner = user !== null;
  const hasGlobalScope = user !== null;
  const accessibleLocationIds = realAccessibleLocationIds;

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

      // Note: is_owner and get_user_has_global_scope now always return true for authenticated users
      // These calls are kept for backwards compatibility but their results are ignored

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

  // SIMPLIFIED: Any authenticated user has all permissions
  const hasPermission = useCallback((permissionKey: string, locationId?: string | null): boolean => {
    return user !== null;
  }, [user]);

  // SIMPLIFIED: Any authenticated user has all action permissions
  const hasActionPermission = useCallback((permissionKey: string, locationId?: string | null): boolean => {
    return user !== null;
  }, [user]);

  // SIMPLIFIED: Any authenticated user has all permissions
  const hasAnyPermission = useCallback((permissionKeys: string[]): boolean => {
    return user !== null;
  }, [user]);

  // SIMPLIFIED: Any authenticated user is treated as having all roles
  const hasRole = useCallback((roleName: string): boolean => {
    return user !== null;
  }, [user]);

  // SIMPLIFIED: Any authenticated user is admin/ops
  const isAdminOrOps = useCallback((): boolean => {
    return user !== null;
  }, [user]);

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
