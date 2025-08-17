/**
 * Tenant Billing Dashboard
 * Comprehensive billing and subscription management interface
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Database,
  Activity,
  Zap,
  Settings,
  Bell,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Shield,
  FileText
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface TenantSubscription {
  id: string;
  planId: string;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  nextBillingDate: Date;
  autoRenew: boolean;
  plan: {
    id: string;
    name: string;
    tier: string;
    price: number;
    currency: string;
    billingCycle: string;
    features: Array<{
      key: string;
      name: string;
      included: boolean;
      limit?: number;
    }>;
    limits: {
      maxUsers: number;
      maxPlugins: number;
      maxStorage: number;
      maxApiCalls: number;
    };
  };
}

interface BillingAnalytics {
  currentUsage: {
    period: { start: Date; end: Date };
    resources: {
      users: { used: number; limit: number; cost: number };
      storage: { used: number; limit: number; cost: number };
      apiCalls: { used: number; limit: number; cost: number };
      plugins: { used: number; limit: number; cost: number };
    };
    totalCost: number;
    projectedMonthlyTotal: number;
  };
  projectedCosts: {
    nextMonth: number;
    nextQuarter: number;
    nextYear: number;
    breakdown: {
      subscription: number;
      usage: number;
      overages: number;
    };
  };
  paymentHistory: {
    totalPaid: number;
    totalOutstanding: number;
    averageMonthlySpend: number;
    paymentHistory: Array<{
      date: Date;
      amount: number;
      status: string;
    }>;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    message: string;
    isResolved: boolean;
    createdAt: Date;
  }>;
  recommendations: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    estimatedSavings?: number;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'PAST_DUE' | 'CANCELED';
  total: number;
  currency: string;
  dueDate: Date;
  paidAt?: Date;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    type: string;
  }>;
}

const STATUS_COLORS = {
  TRIAL: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAST_DUE: 'bg-red-100 text-red-800',
  CANCELED: 'bg-gray-100 text-gray-800',
  UNPAID: 'bg-yellow-100 text-yellow-800'
};

const ALERT_COLORS = {
  INFO: 'text-blue-600 bg-blue-50 border-blue-200',
  WARNING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  CRITICAL: 'text-red-600 bg-red-50 border-red-200'
};

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function TenantBillingDashboard() {
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      
      const [subscriptionResponse, analyticsResponse, invoicesResponse] = await Promise.all([
        fetch('/api/tenant/billing?section=subscription'),
        fetch('/api/tenant/billing?section=analytics'),
        fetch('/api/tenant/billing?section=invoices')
      ]);

      const [subscriptionResult, analyticsResult, invoicesResult] = await Promise.all([
        subscriptionResponse.json(),
        analyticsResponse.json(),
        invoicesResponse.json()
      ]);

      if (subscriptionResult.success) {
        setSubscription(subscriptionResult.data);
      }

      if (analyticsResult.success) {
        setAnalytics(analyticsResult.data);
      }

      if (invoicesResult.success) {
        setInvoices(invoicesResult.data);
      }

    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load billing information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshBillingData = async () => {
    setRefreshing(true);
    await loadBillingData();
    setRefreshing(false);
    
    toast({
      title: 'Success',
      description: 'Billing data refreshed'
    });
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/tenant/billing/invoice/${invoiceId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download invoice',
        variant: 'destructive'
      });
    }
  };

  const changePlan = async (newPlanId: string) => {
    try {
      const response = await fetch('/api/tenant/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'create_subscription',
          data: { planId: newPlanId }
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadBillingData();
        toast({
          title: 'Success',
          description: 'Subscription plan updated successfully'
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update subscription',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update subscription',
        variant: 'destructive'
      });
    }
  };

  const cancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/tenant/billing?operation=cancel_subscription&confirm=true', {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        await loadBillingData();
        toast({
          title: 'Success',
          description: 'Subscription canceled successfully'
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to cancel subscription',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive'
      });
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
              <CardDescription>
                Your current plan and billing status
              </CardDescription>
            </div>
            <Badge className={STATUS_COLORS[subscription?.status || 'ACTIVE']}>
              {subscription?.status || 'ACTIVE'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Plan</div>
              <div className="text-lg font-semibold">{subscription?.plan.name || 'Professional'}</div>
              <div className="text-sm text-gray-500">{subscription?.plan.tier || 'PROFESSIONAL'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Price</div>
              <div className="text-lg font-semibold">
                ${subscription?.plan.price || 99}/{subscription?.plan.billingCycle.toLowerCase() || 'month'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Next Billing</div>
              <div className="text-lg font-semibold">
                {subscription?.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Auto Renew</div>
              <div className="text-lg font-semibold">
                {subscription?.autoRenew ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>

          {subscription?.status === 'TRIAL' && subscription.trialEnd && (
            <Alert className="mt-4">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Your trial expires on {new Date(subscription.trialEnd).toLocaleDateString()}.
                <Button variant="link" className="p-0 ml-2 h-auto">
                  Upgrade now
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Users</div>
                <div className="text-lg font-semibold">
                  {analytics?.currentUsage.resources.users.used || 0} / {analytics?.currentUsage.resources.users.limit || 0}
                </div>
                <Progress 
                  value={((analytics?.currentUsage.resources.users.used || 0) / (analytics?.currentUsage.resources.users.limit || 1)) * 100} 
                  className="mt-1 w-16 h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Database className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Storage</div>
                <div className="text-lg font-semibold">
                  {analytics?.currentUsage.resources.storage.used || 0} / {analytics?.currentUsage.resources.storage.limit || 0} GB
                </div>
                <Progress 
                  value={((analytics?.currentUsage.resources.storage.used || 0) / (analytics?.currentUsage.resources.storage.limit || 1)) * 100} 
                  className="mt-1 w-16 h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Activity className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">API Calls</div>
                <div className="text-lg font-semibold">
                  {(analytics?.currentUsage.resources.apiCalls.used || 0).toLocaleString()} / {(analytics?.currentUsage.resources.apiCalls.limit || 0).toLocaleString()}
                </div>
                <Progress 
                  value={((analytics?.currentUsage.resources.apiCalls.used || 0) / (analytics?.currentUsage.resources.apiCalls.limit || 1)) * 100} 
                  className="mt-1 w-16 h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Zap className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <div className="text-sm text-gray-600">Plugins</div>
                <div className="text-lg font-semibold">
                  {analytics?.currentUsage.resources.plugins.used || 0} / {analytics?.currentUsage.resources.plugins.limit || 0}
                </div>
                <Progress 
                  value={((analytics?.currentUsage.resources.plugins.used || 0) / (analytics?.currentUsage.resources.plugins.limit || 1)) * 100} 
                  className="mt-1 w-16 h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Period Costs</CardTitle>
            <CardDescription>
              Billing period: {analytics?.currentUsage.period.start ? new Date(analytics.currentUsage.period.start).toLocaleDateString() : ''} - {analytics?.currentUsage.period.end ? new Date(analytics.currentUsage.period.end).toLocaleDateString() : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subscription</span>
                <span className="font-semibold">${analytics?.projectedCosts.breakdown.subscription || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Usage</span>
                <span className="font-semibold">${analytics?.projectedCosts.breakdown.usage || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Overages</span>
                <span className="font-semibold">${analytics?.projectedCosts.breakdown.overages || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${analytics?.currentUsage.totalCost || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projected Costs</CardTitle>
            <CardDescription>
              Estimated future costs based on current usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Next Month</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">${analytics?.projectedCosts.nextMonth || 0}</span>
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Next Quarter</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">${analytics?.projectedCosts.nextQuarter || 0}</span>
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Next Year</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">${analytics?.projectedCosts.nextYear || 0}</span>
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Recommendations */}
      {(analytics?.alerts.length || analytics?.recommendations.length) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alerts */}
          {analytics?.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.alerts.filter(alert => !alert.isResolved).slice(0, 3).map((alert) => (
                    <div key={alert.id} className={`p-3 rounded-lg border ${ALERT_COLORS[alert.severity]}`}>
                      <div className="font-medium text-sm">{alert.title}</div>
                      <div className="text-xs opacity-90">{alert.message}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {analytics?.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.recommendations.slice(0, 3).map((rec) => (
                    <div key={rec.id} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{rec.title}</span>
                        <Badge variant={rec.priority === 'HIGH' ? 'destructive' : rec.priority === 'MEDIUM' ? 'default' : 'secondary'}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">{rec.description}</div>
                      {rec.estimatedSavings && (
                        <div className="text-xs text-green-600 mt-1">
                          Potential savings: ${rec.estimatedSavings}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );

  const renderInvoicesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices
          </CardTitle>
          <CardDescription>
            View and download your billing invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">{invoice.invoiceNumber}</div>
                  <div className="text-sm text-gray-600">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                  <Badge variant={invoice.status === 'PAID' ? 'default' : invoice.status === 'PAST_DUE' ? 'destructive' : 'secondary'}>
                    {invoice.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${invoice.total} {invoice.currency}</div>
                  {invoice.paidAt && (
                    <div className="text-sm text-gray-600">
                      Paid: {new Date(invoice.paidAt).toLocaleDateString()}
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => downloadInvoice(invoice.id)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
            
            {invoices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2" />
                <p>No invoices available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Subscription Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Auto Renewal</div>
              <div className="text-sm text-gray-600">
                Automatically renew your subscription
              </div>
            </div>
            <Button variant="outline">
              {subscription?.autoRenew ? 'Disable' : 'Enable'}
            </Button>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Change Plan</div>
              <div className="text-sm text-gray-600">
                Upgrade or downgrade your subscription
              </div>
            </div>
            <Button variant="outline">
              View Plans
            </Button>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-red-600">Cancel Subscription</div>
              <div className="text-sm text-gray-600">
                Cancel your current subscription
              </div>
            </div>
            <Button 
              variant="destructive" 
              onClick={cancelSubscription}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading billing information...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-gray-600">
            Manage your subscription, view usage, and download invoices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshBillingData} disabled={refreshing}>
            {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {renderOverviewTab()}
        </TabsContent>

        <TabsContent value="invoices">
          {renderInvoicesTab()}
        </TabsContent>

        <TabsContent value="settings">
          {renderSettingsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}