/**
 * Billing Hook
 * React hook for billing and subscription management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';

export interface TenantSubscription {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  nextBillingDate: Date;
  autoRenew: boolean;
  plan: SubscriptionPlan;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  price: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  features: PlanFeature[];
  limits: PlanLimits;
  isActive: boolean;
}

export interface PlanFeature {
  key: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanLimits {
  maxUsers: number;
  maxPlugins: number;
  maxStorage: number;
  maxApiCalls: number;
  maxIntegrations: number;
  maxCustomDomains: number;
  supportLevel: 'COMMUNITY' | 'EMAIL' | 'PRIORITY' | 'DEDICATED';
  slaUptime: number;
}

export interface BillingAnalytics {
  currentUsage: CurrentUsage;
  projectedCosts: ProjectedCosts;
  paymentHistory: PaymentSummary;
  alerts: BillingAlert[];
  recommendations: BillingRecommendation[];
  costOptimization: CostOptimizationSuggestion[];
}

export interface CurrentUsage {
  period: { start: Date; end: Date };
  resources: {
    users: { used: number; limit: number; cost: number };
    storage: { used: number; limit: number; cost: number };
    apiCalls: { used: number; limit: number; cost: number };
    plugins: { used: number; limit: number; cost: number };
    integrations: { used: number; limit: number; cost: number };
  };
  totalCost: number;
  projectedMonthlyTotal: number;
}

export interface ProjectedCosts {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  breakdown: {
    subscription: number;
    usage: number;
    overages: number;
  };
}

export interface PaymentSummary {
  totalPaid: number;
  totalOutstanding: number;
  averageMonthlySpend: number;
  paymentHistory: Array<{
    date: Date;
    amount: number;
    status: string;
  }>;
}

export interface BillingAlert {
  id: string;
  type: AlertType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  threshold?: number;
  currentValue?: number;
  isResolved: boolean;
  createdAt: Date;
}

export interface BillingRecommendation {
  id: string;
  type: 'PLAN_UPGRADE' | 'PLAN_DOWNGRADE' | 'USAGE_OPTIMIZATION' | 'COST_SAVING';
  title: string;
  description: string;
  estimatedSavings?: number;
  estimatedCost?: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  actionRequired: boolean;
}

export interface CostOptimizationSuggestion {
  id: string;
  category: 'USAGE' | 'PLAN' | 'FEATURES' | 'BILLING_CYCLE';
  suggestion: string;
  potentialSavings: number;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
  paymentMethod?: PaymentMethod;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'SUBSCRIPTION' | 'USAGE' | 'ONE_TIME' | 'SETUP' | 'OVERAGE';
  metadata: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  type: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'MANUAL';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  metadata: Record<string, any>;
}

export interface UsageRecord {
  resourceType: UsageResourceType;
  quantity: number;
  metadata?: Record<string, any>;
}

export type SubscriptionStatus = 
  | 'TRIAL' 
  | 'ACTIVE' 
  | 'PAST_DUE' 
  | 'CANCELED' 
  | 'UNPAID' 
  | 'INCOMPLETE' 
  | 'INCOMPLETE_EXPIRED'
  | 'PAUSED';

export type InvoiceStatus = 
  | 'DRAFT' 
  | 'OPEN' 
  | 'PAID' 
  | 'PAST_DUE' 
  | 'CANCELED' 
  | 'UNCOLLECTIBLE';

export type UsageResourceType = 
  | 'USERS' 
  | 'STORAGE_GB' 
  | 'API_CALLS' 
  | 'PLUGINS' 
  | 'INTEGRATIONS' 
  | 'CUSTOM_DOMAINS' 
  | 'SUPPORT_TICKETS';

export type AlertType = 
  | 'USAGE_LIMIT_APPROACHING' 
  | 'USAGE_LIMIT_EXCEEDED' 
  | 'PAYMENT_FAILED' 
  | 'INVOICE_OVERDUE' 
  | 'TRIAL_EXPIRING' 
  | 'SUBSCRIPTION_CANCELED'
  | 'UPGRADE_RECOMMENDED';

export interface BillingState {
  subscription: TenantSubscription | null;
  analytics: BillingAnalytics | null;
  invoices: Invoice[];
  availablePlans: SubscriptionPlan[];
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface BillingActions {
  loadBillingData: () => Promise<void>;
  loadSubscription: () => Promise<void>;
  loadAnalytics: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  loadAvailablePlans: () => Promise<void>;
  createSubscription: (planId: string, options?: any) => Promise<boolean>;
  updateSubscription: (updates: any) => Promise<boolean>;
  cancelSubscription: (reason?: string, immediate?: boolean) => Promise<boolean>;
  recordUsage: (record: UsageRecord) => Promise<boolean>;
  recordBulkUsage: (records: UsageRecord[]) => Promise<boolean>;
  processPayment: (invoiceId: string, paymentMethodId: string) => Promise<boolean>;
  downloadInvoice: (invoiceId: string) => Promise<void>;
  addPaymentMethod: (paymentMethod: any) => Promise<boolean>;
  updatePaymentMethod: (paymentMethodId: string, updates: any) => Promise<boolean>;
  deletePaymentMethod: (paymentMethodId: string) => Promise<boolean>;
  generateInvoice: (billingPeriod: { start: Date; end: Date }) => Promise<boolean>;
  exportBillingData: (format?: 'json' | 'csv' | 'pdf') => Promise<void>;
  refreshBillingData: () => Promise<void>;
  getUsagePercentage: (resourceType: string) => number;
  isNearLimit: (resourceType: string, threshold?: number) => boolean;
  getRecommendations: (category?: string) => BillingRecommendation[];
  getCostOptimizations: () => CostOptimizationSuggestion[];
  estimateCostForPlan: (planId: string) => Promise<number | null>;
}

export interface UseBillingOptions {
  autoLoad?: boolean;
  includeAnalytics?: boolean;
  includeInvoices?: boolean;
  includePlans?: boolean;
  autoRefreshInterval?: number; // milliseconds
}

export function useBilling(options: UseBillingOptions = {}): BillingState & BillingActions {
  const {
    autoLoad = true,
    includeAnalytics = true,
    includeInvoices = true,
    includePlans = false,
    autoRefreshInterval = 0 // disabled by default
  } = options;

  const [state, setState] = useState<BillingState>({
    subscription: null,
    analytics: null,
    invoices: [],
    availablePlans: [],
    paymentMethods: [],
    loading: true,
    error: null,
    lastUpdated: null
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const updateState = useCallback((updates: Partial<BillingState>) => {
    if (!isUnmountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const loadSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/billing?section=subscription');
      const result = await response.json();

      if (result.success) {
        updateState({ subscription: result.data });
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to load subscription');
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      updateState({ error: error instanceof Error ? error.message : 'Failed to load subscription' });
      return null;
    }
  }, [updateState]);

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/billing?section=analytics');
      const result = await response.json();

      if (result.success) {
        updateState({ analytics: result.data });
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      updateState({ error: error instanceof Error ? error.message : 'Failed to load analytics' });
      return null;
    }
  }, [updateState]);

  const loadInvoices = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/billing?section=invoices');
      const result = await response.json();

      if (result.success) {
        updateState({ invoices: result.data || [] });
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to load invoices');
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
      updateState({ error: error instanceof Error ? error.message : 'Failed to load invoices' });
      return [];
    }
  }, [updateState]);

  const loadAvailablePlans = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/billing/plans');
      const result = await response.json();

      if (result.success) {
        updateState({ availablePlans: result.data || [] });
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to load plans');
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      updateState({ error: error instanceof Error ? error.message : 'Failed to load plans' });
      return [];
    }
  }, [updateState]);

  const loadBillingData = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });

      const promises = [loadSubscription()];
      
      if (includeAnalytics) promises.push(loadAnalytics());
      if (includeInvoices) promises.push(loadInvoices());
      if (includePlans) promises.push(loadAvailablePlans());

      await Promise.all(promises);

      updateState({ 
        loading: false, 
        lastUpdated: new Date() 
      });

    } catch (error) {
      console.error('Failed to load billing data:', error);
      updateState({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load billing data'
      });
    }
  }, [loadSubscription, loadAnalytics, loadInvoices, loadAvailablePlans, includeAnalytics, includeInvoices, includePlans, updateState]);

  const createSubscription = useCallback(async (planId: string, options: any = {}): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'create_subscription',
          data: { planId, ...options }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await loadSubscription();
        toast({
          title: 'Success',
          description: 'Subscription created successfully'
        });
        return true;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create subscription',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error while creating subscription',
        variant: 'destructive'
      });
      return false;
    }
  }, [loadSubscription]);

  const updateSubscription = useCallback(async (updates: any): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/billing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'update_subscription',
          data: updates
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await loadSubscription();
        toast({
          title: 'Success',
          description: 'Subscription updated successfully'
        });
        return true;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update subscription',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error while updating subscription',
        variant: 'destructive'
      });
      return false;
    }
  }, [loadSubscription]);

  const cancelSubscription = useCallback(async (reason?: string, immediate: boolean = false): Promise<boolean> => {
    try {
      const params = new URLSearchParams({
        operation: 'cancel_subscription',
        confirm: 'true'
      });
      
      if (reason) params.append('reason', reason);
      if (immediate) params.append('immediate', 'true');

      const response = await fetch(`/api/tenant/billing?${params.toString()}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        await loadSubscription();
        toast({
          title: 'Success',
          description: 'Subscription canceled successfully'
        });
        return true;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to cancel subscription',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error while canceling subscription',
        variant: 'destructive'
      });
      return false;
    }
  }, [loadSubscription]);

  const recordUsage = useCallback(async (record: UsageRecord): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'record_usage',
          data: record
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Optionally refresh analytics
        if (includeAnalytics) {
          await loadAnalytics();
        }
        return true;
      } else {
        console.error('Failed to record usage:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to record usage:', error);
      return false;
    }
  }, [loadAnalytics, includeAnalytics]);

  const recordBulkUsage = useCallback(async (records: UsageRecord[]): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'bulk_record_usage',
          data: { records }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        if (includeAnalytics) {
          await loadAnalytics();
        }
        return true;
      } else {
        console.error('Failed to record bulk usage:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to record bulk usage:', error);
      return false;
    }
  }, [loadAnalytics, includeAnalytics]);

  const processPayment = useCallback(async (invoiceId: string, paymentMethodId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'process_payment',
          data: { invoiceId, paymentMethodId }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await Promise.all([
          loadInvoices(),
          loadAnalytics()
        ]);
        toast({
          title: 'Success',
          description: 'Payment processed successfully'
        });
        return true;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to process payment',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error while processing payment',
        variant: 'destructive'
      });
      return false;
    }
  }, [loadInvoices, loadAnalytics]);

  const downloadInvoice = useCallback(async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/tenant/billing/invoice/${invoiceId}/download`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Success',
          description: 'Invoice downloaded successfully'
        });
      } else {
        throw new Error('Failed to download invoice');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download invoice',
        variant: 'destructive'
      });
    }
  }, []);

  const exportBillingData = useCallback(async (format: 'json' | 'csv' | 'pdf' = 'json') => {
    try {
      const response = await fetch(`/api/tenant/billing/export?format=${format}`);
      const result = await response.json();

      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: format === 'json' ? 'application/json' : 'text/csv'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `billing-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Success',
          description: 'Billing data exported successfully'
        });
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export billing data',
        variant: 'destructive'
      });
    }
  }, []);

  const refreshBillingData = useCallback(async () => {
    await loadBillingData();
    toast({
      title: 'Success',
      description: 'Billing data refreshed'
    });
  }, [loadBillingData]);

  const getUsagePercentage = useCallback((resourceType: string): number => {
    if (!state.analytics?.currentUsage.resources) return 0;
    
    const resource = state.analytics.currentUsage.resources[resourceType as keyof typeof state.analytics.currentUsage.resources];
    if (!resource) return 0;
    
    return Math.round((resource.used / resource.limit) * 100);
  }, [state.analytics]);

  const isNearLimit = useCallback((resourceType: string, threshold: number = 80): boolean => {
    return getUsagePercentage(resourceType) >= threshold;
  }, [getUsagePercentage]);

  const getRecommendations = useCallback((category?: string): BillingRecommendation[] => {
    if (!state.analytics?.recommendations) return [];
    
    return category 
      ? state.analytics.recommendations.filter(rec => rec.type.includes(category.toUpperCase()))
      : state.analytics.recommendations;
  }, [state.analytics]);

  const getCostOptimizations = useCallback((): CostOptimizationSuggestion[] => {
    return state.analytics?.costOptimization || [];
  }, [state.analytics]);

  const estimateCostForPlan = useCallback(async (planId: string): Promise<number | null> => {
    try {
      const response = await fetch(`/api/tenant/billing/estimate?planId=${planId}`);
      const result = await response.json();
      
      return result.success ? result.data.estimatedCost : null;
    } catch (error) {
      console.error('Failed to estimate cost:', error);
      return null;
    }
  }, []);

  // Auto-load billing data on mount
  useEffect(() => {
    if (autoLoad) {
      loadBillingData();
    }

    return () => {
      isUnmountedRef.current = true;
    };
  }, [autoLoad, loadBillingData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        loadBillingData();
      }, autoRefreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefreshInterval, loadBillingData]);

  // Placeholder implementations for additional actions
  const addPaymentMethod = useCallback(async (paymentMethod: any): Promise<boolean> => {
    // TODO: Implement payment method addition
    return false;
  }, []);

  const updatePaymentMethod = useCallback(async (paymentMethodId: string, updates: any): Promise<boolean> => {
    // TODO: Implement payment method update
    return false;
  }, []);

  const deletePaymentMethod = useCallback(async (paymentMethodId: string): Promise<boolean> => {
    // TODO: Implement payment method deletion
    return false;
  }, []);

  const generateInvoice = useCallback(async (billingPeriod: { start: Date; end: Date }): Promise<boolean> => {
    try {
      const response = await fetch('/api/tenant/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'generate_invoice',
          data: {
            billingPeriodStart: billingPeriod.start.toISOString(),
            billingPeriodEnd: billingPeriod.end.toISOString()
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await loadInvoices();
        toast({
          title: 'Success',
          description: 'Invoice generated successfully'
        });
        return true;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to generate invoice',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error while generating invoice',
        variant: 'destructive'
      });
      return false;
    }
  }, [loadInvoices]);

  return {
    // State
    ...state,
    
    // Actions
    loadBillingData,
    loadSubscription,
    loadAnalytics,
    loadInvoices,
    loadAvailablePlans,
    createSubscription,
    updateSubscription,
    cancelSubscription,
    recordUsage,
    recordBulkUsage,
    processPayment,
    downloadInvoice,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    generateInvoice,
    exportBillingData,
    refreshBillingData,
    getUsagePercentage,
    isNearLimit,
    getRecommendations,
    getCostOptimizations,
    estimateCostForPlan
  };
}

/**
 * Hook for automatic usage tracking
 */
export function useUsageTracker() {
  const { recordUsage } = useBilling({ autoLoad: false });

  const trackUsage = useCallback(async (
    resourceType: UsageResourceType,
    quantity: number = 1,
    metadata?: Record<string, any>
  ) => {
    return await recordUsage({
      resourceType,
      quantity,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'automatic_tracking'
      }
    });
  }, [recordUsage]);

  const trackApiCall = useCallback(async (endpoint: string, metadata?: Record<string, any>) => {
    return await trackUsage('API_CALLS', 1, {
      endpoint,
      ...metadata
    });
  }, [trackUsage]);

  const trackStorageUsage = useCallback(async (sizeGB: number, metadata?: Record<string, any>) => {
    return await trackUsage('STORAGE_GB', sizeGB, metadata);
  }, [trackUsage]);

  const trackPluginInstall = useCallback(async (pluginId: string, metadata?: Record<string, any>) => {
    return await trackUsage('PLUGINS', 1, {
      pluginId,
      action: 'install',
      ...metadata
    });
  }, [trackUsage]);

  const trackUserActivity = useCallback(async (metadata?: Record<string, any>) => {
    return await trackUsage('USERS', 1, metadata);
  }, [trackUsage]);

  return {
    trackUsage,
    trackApiCall,
    trackStorageUsage,
    trackPluginInstall,
    trackUserActivity,
    recordUsage
  };
}

export default useBilling;