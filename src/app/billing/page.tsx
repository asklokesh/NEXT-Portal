'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard,
  FileText,
  TrendingUp,
  AlertTriangle,
  Download,
  Eye,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
  Plus,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';

// Types
interface Subscription {
  id: string;
  planName: string;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  quantity: number;
  amount: number;
  currency: string;
  trialEnd?: string;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID';
  total: number;
  currency: string;
  dueDate: string;
  paidAt?: string;
  invoiceUrl?: string;
}

interface UsageMetric {
  resourceType: string;
  quantity: number;
  cost: number;
  unit: string;
  limit?: number;
}

interface BillingAlert {
  id: string;
  type: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  threshold: number;
  currentValue: number;
  createdAt: string;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<UsageMetric[]>([]);
  const [alerts, setAlerts] = useState<BillingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Fetch subscription data
      const subResponse = await fetch('/api/billing/subscription');
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
      }
      
      // Fetch invoices
      const invoicesResponse = await fetch('/api/billing/invoices');
      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        setInvoices(invoicesData.invoices || []);
      }
      
      // Fetch usage metrics
      const usageResponse = await fetch('/api/billing/usage');
      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        setUsage(usageData.breakdown || []);
      }
      
      // Fetch billing alerts
      const alertsResponse = await fetch('/api/billing/alerts');
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'TRIALING':
        return 'bg-blue-100 text-blue-800';
      case 'PAST_DUE':
      case 'OPEN':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
      case 'VOID':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-50 border-red-200';
      case 'WARNING':
        return 'bg-yellow-50 border-yellow-200';
      case 'INFO':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const calculateUsagePercentage = (current: number, limit?: number) => {
    if (!limit || limit <= 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST'
      });
      
      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error accessing billing portal:', error);
    }
  };

  const handleUpgradePlan = () => {
    // Navigate to pricing page
    window.location.href = '/pricing';
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
          <p className="text-gray-600 mt-2">Manage your subscription, usage, and billing information</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => fetchBillingData()}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleManageSubscription}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
        </div>
      </div>

      {/* Billing Alerts */}
      {alerts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{alert.type}:</strong> {alert.message}
                  {alert.severity === 'CRITICAL' && (
                    <Button size="sm" className="ml-4" onClick={handleManageSubscription}>
                      Take Action
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage & Limits</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current Plan */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {subscription?.planName || 'No Plan'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subscription ? (
                    <Badge className={getStatusColor(subscription.status)}>
                      {subscription.status}
                    </Badge>
                  ) : (
                    'No active subscription'
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Monthly Cost */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {subscription ? formatCurrency(subscription.amount) : '$0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subscription ? `${subscription.quantity} seats` : 'No subscription'}
                </p>
              </CardContent>
            </Card>

            {/* Usage This Month */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usage Cost</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(usage.reduce((sum, u) => sum + u.cost, 0))}
                </div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            {/* Next Billing */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {subscription ? format(new Date(subscription.currentPeriodEnd), 'MMM dd') : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subscription && subscription.trialEnd ? 'Trial ends' : 'Billing date'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Manage your subscription and billing settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleUpgradePlan}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
                <Button variant="outline" onClick={handleManageSubscription}>
                  <Settings className="h-4 w-4 mr-2" />
                  Billing Settings
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>
                Monitor your current usage against plan limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {usage.map((metric) => {
                  const percentage = calculateUsagePercentage(metric.quantity, metric.limit);
                  const isOverLimit = metric.limit && metric.quantity > metric.limit;
                  
                  return (
                    <div key={metric.resourceType} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{metric.resourceType.replace('_', ' ')}</h4>
                          <p className="text-sm text-gray-600">
                            {metric.quantity.toLocaleString()} {metric.unit}
                            {metric.limit && ` / ${metric.limit.toLocaleString()} ${metric.unit}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(metric.cost)}</p>
                          {isOverLimit && (
                            <Badge variant="destructive" className="text-xs">
                              Over Limit
                            </Badge>
                          )}
                        </div>
                      </div>
                      {metric.limit && (
                        <Progress 
                          value={percentage} 
                          className={`h-2 ${isOverLimit ? 'bg-red-100' : ''}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>
                View and download your billing history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No invoices found
                  </p>
                ) : (
                  invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <FileText className="h-8 w-8 text-gray-400" />
                        <div>
                          <h4 className="font-medium">{invoice.invoiceNumber}</h4>
                          <p className="text-sm text-gray-600">
                            Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                            {invoice.paidAt && (
                              <span className="ml-2">
                                (Paid: {format(new Date(invoice.paidAt), 'MMM dd, yyyy')})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(invoice.total, invoice.currency)}</p>
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </div>
                        <div className="flex space-x-2">
                          {invoice.invoiceUrl && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleDownloadInvoice(invoice.id)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          {subscription ? (
            <Card>
              <CardHeader>
                <CardTitle>Subscription Details</CardTitle>
                <CardDescription>
                  Manage your current subscription
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900">Plan</h4>
                      <p className="text-2xl font-bold">{subscription.planName}</p>
                      <Badge className={getStatusColor(subscription.status)}>
                        {subscription.status}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Amount</h4>
                      <p className="text-2xl font-bold">
                        {formatCurrency(subscription.amount)} / month
                      </p>
                      <p className="text-sm text-gray-600">
                        {subscription.quantity} seats
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900">Billing Period</h4>
                      <p className="text-gray-600">
                        {format(new Date(subscription.currentPeriodStart), 'MMM dd, yyyy')} - {' '}
                        {format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    {subscription.trialEnd && (
                      <div>
                        <h4 className="font-medium text-gray-900">Trial Ends</h4>
                        <p className="text-gray-600">
                          {format(new Date(subscription.trialEnd), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>

                  {subscription.cancelAtPeriodEnd && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Your subscription will be cancelled at the end of the current billing period
                        ({format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy')}).
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex space-x-3 pt-4 border-t">
                    <Button onClick={handleUpgradePlan}>
                      Upgrade Plan
                    </Button>
                    <Button variant="outline" onClick={handleManageSubscription}>
                      Manage Subscription
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Active Subscription</CardTitle>
                <CardDescription>
                  Start your IDP journey with one of our plans
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    You don't have an active subscription. Choose a plan to get started.
                  </p>
                  <Button onClick={handleUpgradePlan}>
                    <Plus className="h-4 w-4 mr-2" />
                    Choose a Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
