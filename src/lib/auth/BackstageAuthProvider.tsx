'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  role: string;
  provider: string;
  isActive: boolean;
  lastLogin?: Date;
  teams?: Array<{
    id: string;
    name: string;
    displayName?: string;
    role: string;
  }>;
  services?: Array<{
    id: string;
    name: string;
    displayName?: string;
  }>;
  permissions?: string[];
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithBackstage: (token: string) => Promise<{ success: boolean; error?: string }>;
  loginWithProvider: (provider: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (roles: string | string[]) => boolean;
  isTeamMember: (teamId: string) => boolean;
  isTeamOwner: (teamId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface BackstageAuthProviderProps {
  children: ReactNode;
}

export function BackstageAuthProvider({ children }: BackstageAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to check authentication:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login with email/password
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  }, []);

  // Login with Backstage token
  const loginWithBackstage = useCallback(async (token: string) => {
    try {
      const response = await fetch('/api/auth/backstage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Backstage authentication failed' };
      }
    } catch (error) {
      console.error('Backstage login error:', error);
      return { success: false, error: 'Network error' };
    }
  }, []);

  // Login with OAuth provider
  const loginWithProvider = useCallback(async (provider: string) => {
    window.location.href = `/api/auth/${provider}`;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (data: Partial<User>) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setUser(result.user);
        return { success: true };
      } else {
        return { success: false, error: result.message || 'Update failed' };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: 'Network error' };
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  // Permission checking functions
  const hasPermission = useCallback((resource: string, action: string) => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'ADMIN') return true;
    
    // Platform engineers have broad permissions
    if (user.role === 'PLATFORM_ENGINEER') {
      const platformResources = ['catalog', 'template', 'service', 'deployment', 'monitoring'];
      return platformResources.includes(resource);
    }
    
    // Check specific permissions if available
    if (user.permissions) {
      const permissionKey = `${resource}.${action}`;
      return user.permissions.includes(permissionKey) || user.permissions.includes(`${resource}.*`);
    }
    
    // Default role-based permissions
    const rolePermissions: Record<string, string[]> = {
      DEVELOPER: [
        'catalog.read',
        'template.read',
        'template.execute',
        'service.read.own',
        'service.write.own',
        'deployment.read.own',
        'cost.read.own'
      ],
      VIEWER: [
        'catalog.read',
        'template.read',
        'service.read',
        'deployment.read',
        'cost.read'
      ]
    };
    
    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes(`${resource}.${action}`) || 
           userPermissions.includes(`${resource}.${action}.own`);
  }, [user]);

  const hasRole = useCallback((roles: string | string[]) => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }, [user]);

  const isTeamMember = useCallback((teamId: string) => {
    if (!user?.teams) return false;
    return user.teams.some(team => team.id === teamId);
  }, [user]);

  const isTeamOwner = useCallback((teamId: string) => {
    if (!user?.teams) return false;
    return user.teams.some(team => team.id === teamId && team.role === 'OWNER');
  }, [user]);

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithBackstage,
    loginWithProvider,
    logout,
    updateProfile,
    refreshUser,
    hasPermission,
    hasRole,
    isTeamMember,
    isTeamOwner,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a BackstageAuthProvider');
  }
  return context;
}

// Hook for permission checking
export function usePermissions() {
  const { hasPermission, hasRole, isTeamMember, isTeamOwner } = useAuth();
  
  return {
    hasPermission,
    hasRole,
    isTeamMember,
    isTeamOwner,
    can: hasPermission,
    is: hasRole,
  };
}

// Hook for protected routes
export function useRequireAuth(redirectTo = '/login') {
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);
  
  return { isAuthenticated, isLoading };
}

// Hook for role-based access
export function useRequireRole(roles: string | string[], redirectTo = '/unauthorized') {
  const { hasRole, isLoading } = useAuth();
  const hasRequiredRole = hasRole(roles);
  
  useEffect(() => {
    if (!isLoading && !hasRequiredRole) {
      window.location.href = redirectTo;
    }
  }, [hasRequiredRole, isLoading, redirectTo]);
  
  return { hasRequiredRole, isLoading };
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: { 
    redirectTo?: string;
    roles?: string | string[];
    permissions?: Array<{ resource: string; action: string }>;
  } = {}
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
    const { redirectTo = '/login', roles, permissions } = options;
    
    useEffect(() => {
      if (!isLoading) {
        if (!isAuthenticated) {
          window.location.href = redirectTo;
          return;
        }
        
        if (roles && !hasRole(roles)) {
          window.location.href = '/unauthorized';
          return;
        }
        
        if (permissions && !permissions.every(p => hasPermission(p.resource, p.action))) {
          window.location.href = '/unauthorized';
          return;
        }
      }
    }, [isAuthenticated, isLoading, hasRole, hasPermission]);
    
    if (isLoading) {
      return <div>Loading...</div>;
    }
    
    if (!isAuthenticated) {
      return null;
    }
    
    if (roles && !hasRole(roles)) {
      return null;
    }
    
    if (permissions && !permissions.every(p => hasPermission(p.resource, p.action))) {
      return null;
    }
    
    return <WrappedComponent {...props} />;
  };
}

// Component for conditional rendering based on permissions
interface ProtectedProps {
  children: ReactNode;
  roles?: string | string[];
  permissions?: Array<{ resource: string; action: string }>;
  fallback?: ReactNode;
}

export function Protected({ children, roles, permissions, fallback = null }: ProtectedProps) {
  const { hasRole, hasPermission } = useAuth();
  
  // Check role requirements
  if (roles && !hasRole(roles)) {
    return <>{fallback}</>;
  }
  
  // Check permission requirements
  if (permissions && !permissions.every(p => hasPermission(p.resource, p.action))) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

export default BackstageAuthProvider;