/**
 * Tenant Configuration Hook
 * React hook for managing tenant configuration state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

export interface TenantConfiguration {
  authentication: {
    providers: AuthProvider[];
    ssoEnabled: boolean;
    mfaRequired: boolean;
    sessionTimeout: number;
    passwordPolicy: PasswordPolicy;
  };
  branding: {
    organizationName: string;
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    customCSS?: string;
    footerText?: string;
    supportEmail?: string;
  };
  features: {
    enabledFeatures: FeatureToggle[];
    maxUsers: number;
    maxPlugins: number;
    maxStorage: number;
    customDomainEnabled: boolean;
    whitelabelEnabled: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
  security: {
    ipWhitelist: string[];
    domainWhitelist: string[];
    dataRetentionDays: number;
    auditLogRetentionDays: number;
    encryptionAtRest: boolean;
    backupFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  };
  integrations: {
    github: GitHubIntegration;
    slack: SlackIntegration;
    jira: JiraIntegration;
    azure: AzureIntegration;
    aws: AWSIntegration;
  };
  notifications: {
    emailEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
    notificationTypes: NotificationType[];
  };
  portal: {
    sidebarLayout: 'EXPANDED' | 'COLLAPSED' | 'MINIMAL';
    darkMode: boolean;
    customPages: CustomPage[];
    navigation: NavigationItem[];
    dashboard: DashboardConfiguration;
  };
}

export interface AuthProvider {
  type: 'GITHUB' | 'GOOGLE' | 'AZURE' | 'SAML' | 'LDAP' | 'OIDC';
  enabled: boolean;
  config: Record<string, any>;
  displayName: string;
  order: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  maxAge: number;
  historySize: number;
}

export interface FeatureToggle {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: Record<string, any>;
}

export interface GitHubIntegration {
  enabled: boolean;
  orgWhitelist: string[];
  appId?: string;
  installationId?: string;
}

export interface SlackIntegration {
  enabled: boolean;
  workspaces: string[];
  channels: string[];
  botToken?: string;
}

export interface JiraIntegration {
  enabled: boolean;
  baseUrl?: string;
  projects: string[];
  username?: string;
}

export interface AzureIntegration {
  enabled: boolean;
  tenantId?: string;
  subscriptions: string[];
}

export interface AWSIntegration {
  enabled: boolean;
  accountIds: string[];
  regions: string[];
}

export interface NotificationType {
  type: string;
  channels: ('EMAIL' | 'SLACK' | 'WEBHOOK')[];
  enabled: boolean;
}

export interface CustomPage {
  id: string;
  title: string;
  path: string;
  content: string;
  enabled: boolean;
  order: number;
}

export interface NavigationItem {
  id: string;
  title: string;
  path: string;
  icon?: string;
  order: number;
  parentId?: string;
  enabled: boolean;
  permissions?: string[];
}

export interface DashboardConfiguration {
  widgets: DashboardWidget[];
  layout: 'GRID' | 'MASONRY';
  refreshInterval: number;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  config: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
  enabled: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  tier: string;
  status: string;
}

export interface ConfigurationState {
  config: TenantConfiguration | null;
  tenant: TenantInfo | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  unsavedChanges: boolean;
}

export interface ConfigurationActions {
  loadConfiguration: () => Promise<void>;
  updateConfiguration: (updates: Partial<TenantConfiguration>, section?: string) => Promise<boolean>;
  updateBranding: (branding: Partial<TenantConfiguration['branding']>) => Promise<boolean>;
  updateFeatureToggle: (featureKey: string, enabled: boolean, rolloutPercentage?: number) => Promise<boolean>;
  updateIntegration: (integration: keyof TenantConfiguration['integrations'], config: any) => Promise<boolean>;
  exportConfiguration: () => Promise<void>;
  importConfiguration: (configData: any) => Promise<boolean>;
  resetConfiguration: (section?: string) => Promise<boolean>;
  isFeatureEnabled: (featureKey: string) => boolean;
  getIntegrationConfig: <T extends keyof TenantConfiguration['integrations']>(
    integration: T
  ) => TenantConfiguration['integrations'][T] | null;
  markUnsaved: () => void;
  clearUnsaved: () => void;
}

export function useTenantConfiguration(): ConfigurationState & ConfigurationActions {
  const [state, setState] = useState<ConfigurationState>({
    config: null,
    tenant: null,
    loading: true,
    saving: false,
    error: null,
    unsavedChanges: false
  });

  const updateState = useCallback((updates: Partial<ConfigurationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadConfiguration = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });
      
      const response = await fetch('/api/tenant/configuration');
      const result = await response.json();

      if (result.success) {
        updateState({
          config: result.data,
          tenant: result.tenant,
          loading: false,
          unsavedChanges: false
        });
      } else {
        updateState({
          loading: false,
          error: result.error || 'Failed to load configuration'
        });
        
        toast({
          title: 'Error',
          description: result.error || 'Failed to load configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      updateState({
        loading: false,
        error: errorMessage
      });
      
      toast({
        title: 'Error',
        description: 'Network error loading configuration',
        variant: 'destructive'
      });
    }
  }, [updateState]);

  const updateConfiguration = useCallback(async (
    updates: Partial<TenantConfiguration>,
    section?: string
  ): Promise<boolean> => {
    try {
      updateState({ saving: true, error: null });

      const payload = section 
        ? { section, updates }
        : { updates };

      const response = await fetch('/api/tenant/configuration', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        updateState({
          saving: false,
          unsavedChanges: false
        });

        toast({
          title: 'Success',
          description: result.message || 'Configuration updated successfully'
        });

        if (result.requiresRestart) {
          toast({
            title: 'Restart Required',
            description: 'Some changes may require a portal restart to take effect',
            variant: 'destructive'
          });
        }

        // Reload configuration to get updated state
        await loadConfiguration();
        return true;
      } else {
        updateState({
          saving: false,
          error: result.error || 'Failed to update configuration'
        });

        toast({
          title: 'Error',
          description: result.error || 'Failed to update configuration',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      updateState({
        saving: false,
        error: errorMessage
      });

      toast({
        title: 'Error',
        description: 'Network error updating configuration',
        variant: 'destructive'
      });
      return false;
    }
  }, [updateState, loadConfiguration]);

  const updateBranding = useCallback(async (
    branding: Partial<TenantConfiguration['branding']>
  ): Promise<boolean> => {
    return await updateConfiguration({ branding }, 'branding');
  }, [updateConfiguration]);

  const updateFeatureToggle = useCallback(async (
    featureKey: string,
    enabled: boolean,
    rolloutPercentage: number = 100
  ): Promise<boolean> => {
    try {
      updateState({ saving: true, error: null });

      const response = await fetch('/api/tenant/configuration', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          section: 'feature_toggle',
          updates: { featureKey, enabled, rolloutPercentage }
        })
      });

      const result = await response.json();

      if (result.success) {
        updateState({ saving: false });
        
        toast({
          title: 'Success',
          description: `Feature ${featureKey} ${enabled ? 'enabled' : 'disabled'}`
        });

        await loadConfiguration();
        return true;
      } else {
        updateState({
          saving: false,
          error: result.error || 'Failed to update feature toggle'
        });

        toast({
          title: 'Error',
          description: result.error || 'Failed to update feature toggle',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      updateState({ saving: false, error: 'Network error' });
      toast({
        title: 'Error',
        description: 'Network error updating feature toggle',
        variant: 'destructive'
      });
      return false;
    }
  }, [updateState, loadConfiguration]);

  const updateIntegration = useCallback(async (
    integration: keyof TenantConfiguration['integrations'],
    config: any
  ): Promise<boolean> => {
    return await updateConfiguration({ integrations: { [integration]: config } }, integration);
  }, [updateConfiguration]);

  const exportConfiguration = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/configuration?export=true');
      const result = await response.json();

      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tenant-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Success',
          description: 'Configuration exported successfully'
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to export configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error exporting configuration',
        variant: 'destructive'
      });
    }
  }, []);

  const importConfiguration = useCallback(async (configData: any): Promise<boolean> => {
    try {
      updateState({ saving: true, error: null });

      const response = await fetch('/api/tenant/configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: 'import',
          data: configData
        })
      });

      const result = await response.json();

      if (result.success) {
        updateState({ saving: false });
        
        toast({
          title: 'Success',
          description: 'Configuration imported successfully'
        });

        await loadConfiguration();
        return true;
      } else {
        updateState({
          saving: false,
          error: result.error || 'Failed to import configuration'
        });

        toast({
          title: 'Error',
          description: result.error || 'Failed to import configuration',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      updateState({ saving: false, error: 'Network error' });
      toast({
        title: 'Error',
        description: 'Network error importing configuration',
        variant: 'destructive'
      });
      return false;
    }
  }, [updateState, loadConfiguration]);

  const resetConfiguration = useCallback(async (section?: string): Promise<boolean> => {
    try {
      updateState({ saving: true, error: null });

      const url = section 
        ? `/api/tenant/configuration?confirm=true&section=${section}`
        : '/api/tenant/configuration?confirm=true';

      const response = await fetch(url, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        updateState({ saving: false, unsavedChanges: false });
        
        toast({
          title: 'Success',
          description: result.message || 'Configuration reset successfully'
        });

        await loadConfiguration();
        return true;
      } else {
        updateState({
          saving: false,
          error: result.error || 'Failed to reset configuration'
        });

        toast({
          title: 'Error',
          description: result.error || 'Failed to reset configuration',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      updateState({ saving: false, error: 'Network error' });
      toast({
        title: 'Error',
        description: 'Network error resetting configuration',
        variant: 'destructive'
      });
      return false;
    }
  }, [updateState, loadConfiguration]);

  const isFeatureEnabled = useCallback((featureKey: string): boolean => {
    if (!state.config) return false;
    
    const feature = state.config.features.enabledFeatures.find(f => f.key === featureKey);
    return feature?.enabled || false;
  }, [state.config]);

  const getIntegrationConfig = useCallback(<T extends keyof TenantConfiguration['integrations']>(
    integration: T
  ): TenantConfiguration['integrations'][T] | null => {
    if (!state.config) return null;
    return state.config.integrations[integration];
  }, [state.config]);

  const markUnsaved = useCallback(() => {
    updateState({ unsavedChanges: true });
  }, [updateState]);

  const clearUnsaved = useCallback(() => {
    updateState({ unsavedChanges: false });
  }, [updateState]);

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  return {
    // State
    ...state,
    
    // Actions
    loadConfiguration,
    updateConfiguration,
    updateBranding,
    updateFeatureToggle,
    updateIntegration,
    exportConfiguration,
    importConfiguration,
    resetConfiguration,
    isFeatureEnabled,
    getIntegrationConfig,
    markUnsaved,
    clearUnsaved
  };
}

export default useTenantConfiguration;