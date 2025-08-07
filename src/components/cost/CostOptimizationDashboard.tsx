'use client';

import React, { useState, useEffect } from 'react';
import {
 DollarSign,
 TrendingUp,
 TrendingDown,
 AlertTriangle,
 CheckCircle,
 Clock,
 Target,
 Bell,
 Settings,
 ArrowUp,
 ArrowDown,
 Activity,
 Shield,
 Zap,
 Database,
 Cloud,
 Server,
 Users,
 Calendar,
 Filter,
 Download,
 RefreshCw,
 Plus,
 Eye,
 EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
 LineChart,
 Line,
 AreaChart,
 Area,
 BarChart,
 Bar,
 PieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer
} from '@/components/charts';
import { useComponentMonitoring } from '@/hooks/useMonitoring';

interface Budget {
 id: string;
 name: string;
 provider: string;
 amount: number;
 currentSpend: number;
 utilization: number;
 status: 'ok' | 'warning' | 'exceeded';
 daysRemainingInPeriod: number;
}

interface CostAlert {
 id: string;
 name: string;
 type: string;
 severity: 'low' | 'medium' | 'high' | 'critical';
 status: 'active' | 'resolved' | 'snoozed';
 message: string;
 recommendations?: string[];
 triggeredAt: Date;
}

interface CostForecast {
 month: string;
 forecastCost: number;
 confidence: number;
}

export function CostOptimizationDashboard() {
 const { trackInteraction, trackApiCall, trackError } = useComponentMonitoring('CostOptimizationDashboard');
 
 const [budgets, setBudgets] = useState<Budget[]>([]);
 const [alerts, setAlerts] = useState<CostAlert[]>([]);
 const [forecasts, setForecasts] = useState<CostForecast[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<'overview' | 'budgets' | 'alerts' | 'forecasts' | 'optimization'>('overview');
 const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '12m'>('3m');
 const [selectedProvider, setSelectedProvider] = useState<'all' | 'aws' | 'azure' | 'gcp'>('all');

 useEffect(() => {
 loadCostData();
 }, [timeRange, selectedProvider]);

 const loadCostData = async () => {
 try {
 setLoading(true);
 trackInteraction('load_cost_data', { timeRange, provider: selectedProvider });
 
 const endDate = new Date();
 const startDate = new Date();
 
 switch (timeRange) {
 case '1m':
 startDate.setMonth(endDate.getMonth() - 1);
 break;
 case '3m':
 startDate.setMonth(endDate.getMonth() - 3);
 break;
 case '6m':
 startDate.setMonth(endDate.getMonth() - 6);
 break;
 case '12m':
 startDate.setFullYear(endDate.getFullYear() - 1);
 break;
 }

 // Load budgets, alerts, and forecasts in parallel
 const [budgetsResponse, alertsResponse, forecastsResponse] = await Promise.all([
 trackApiCall('fetch_budgets', () => 
 fetch(`/api/costs/budgets?provider=${selectedProvider}`).then(r => r.json())
 ),
 trackApiCall('fetch_cost_alerts', () => 
 fetch(`/api/costs/alerts?status=active`).then(r => r.json())
 ),
 trackApiCall('fetch_cost_forecasts', () => 
 fetch(`/api/costs?type=forecasts&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`).then(r => r.json())
 )
 ]);

 setBudgets(budgetsResponse.budgets || []);
 setAlerts(alertsResponse.alerts || []);
 setForecasts(forecastsResponse || []);
 } catch (error) {
 console.error('Failed to load cost data:', error);
 trackError(error as Error);
 toast.error('Failed to load cost optimization data');
 } finally {
 setLoading(false);
 }
 };

 const handleResolveAlert = async (alertId: string) => {
 try {
 await trackApiCall('resolve_alert', () =>
 fetch('/api/costs/alerts', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'resolve', alertId })
 })
 );

 setAlerts(alerts.filter(a => a.id !== alertId));
 toast.success('Alert resolved successfully');
 trackInteraction('alert_resolved', { alertId });
 } catch (error) {
 console.error('Failed to resolve alert:', error);
 toast.error('Failed to resolve alert');
 }
 };

 const handleSnoozeAlert = async (alertId: string, duration: number) => {
 try {
 await trackApiCall('snooze_alert', () =>
 fetch('/api/costs/alerts', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'snooze', alertId, duration })
 })
 );

 setAlerts(alerts.map(a => 
 a.id === alertId ? { ...a, status: 'snoozed' as const } : a
 ));
 toast.success(`Alert snoozed for ${duration} minutes`);
 trackInteraction('alert_snoozed', { alertId, duration });
 } catch (error) {
 console.error('Failed to snooze alert:', error);
 toast.error('Failed to snooze alert');
 }
 };

 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case 'critical': return 'text-red-600 bg-red-50 border-red-200';
 case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
 case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
 case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
 default: return 'text-gray-600 bg-gray-50 border-gray-200';
 }
 };

 const getBudgetStatusColor = (status: string) => {
 switch (status) {
 case 'exceeded': return 'text-red-600 bg-red-50';
 case 'warning': return 'text-yellow-600 bg-yellow-50';
 case 'ok': return 'text-green-600 bg-green-50';
 default: return 'text-gray-600 bg-gray-50';
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
 const totalSpent = budgets.reduce((sum, b) => sum + b.currentSpend, 0);
 const overallUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
 const activeAlertsCount = alerts.filter(a => a.status === 'active').length;
 const criticalAlertsCount = alerts.filter(a => a.severity === 'critical' && a.status === 'active').length;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Cost Optimization Dashboard
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Monitor budgets, track alerts, and optimize cloud spending
 </p>
 </div>
 <div className="flex items-center gap-3">
 <select
 value={timeRange}
 onChange={(e) => setTimeRange(e.target.value as any)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="1m">Last Month</option>
 <option value="3m">Last 3 Months</option>
 <option value="6m">Last 6 Months</option>
 <option value="12m">Last Year</option>
 </select>
 <select
 value={selectedProvider}
 onChange={(e) => setSelectedProvider(e.target.value as any)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Providers</option>
 <option value="aws">AWS</option>
 <option value="azure">Azure</option>
 <option value="gcp">Google Cloud</option>
 </select>
 <button
 onClick={loadCostData}
 disabled={loading}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
 >
 <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
 Refresh
 </button>
 </div>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-blue-600 dark:text-blue-400">Total Budget</p>
 <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
 ${totalBudget.toLocaleString()}
 </p>
 </div>
 <Target className="w-8 h-8 text-blue-600" />
 </div>
 </div>
 
 <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-green-600 dark:text-green-400">Total Spent</p>
 <p className="text-2xl font-bold text-green-900 dark:text-green-100">
 ${totalSpent.toLocaleString()}
 </p>
 </div>
 <DollarSign className="w-8 h-8 text-green-600" />
 </div>
 </div>
 
 <div className={`rounded-lg p-4 border ${overallUtilization > 90 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 
 overallUtilization > 80 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' : 
 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Utilization</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {overallUtilization.toFixed(1)}%
 </p>
 </div>
 <Activity className="w-8 h-8 text-gray-600" />
 </div>
 </div>
 
 <div className={`rounded-lg p-4 border ${criticalAlertsCount > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 
 activeAlertsCount > 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' : 
 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Active Alerts</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {activeAlertsCount}
 </p>
 </div>
 <Bell className="w-8 h-8 text-gray-600" />
 </div>
 </div>
 </div>
 </div>

 {/* Navigation Tabs */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 <div className="border-b border-gray-200 dark:border-gray-700">
 <nav className="flex space-x-8 px-6">
 {[
 { id: 'overview', label: 'Overview', icon: Activity },
 { id: 'budgets', label: 'Budgets', icon: Target, badge: budgets.filter(b => b.status !== 'ok').length },
 { id: 'alerts', label: 'Alerts', icon: Bell, badge: activeAlertsCount },
 { id: 'forecasts', label: 'Forecasts', icon: TrendingUp },
 { id: 'optimization', label: 'Optimization', icon: Zap }
 ].map((tab) => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => {
 setActiveTab(tab.id as any);
 trackInteraction('tab_changed', { tab: tab.id });
 }}
 className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
 activeTab === tab.id
 ? 'border-blue-500 text-blue-600 dark:text-blue-400'
 : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
 }`}
 >
 <Icon className="w-4 h-4" />
 {tab.label}
 {tab.badge && tab.badge > 0 && (
 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
 {tab.badge}
 </span>
 )}
 </button>
 );
 })}
 </nav>
 </div>

 <div className="p-6">
 {activeTab === 'overview' && (
 <div className="space-y-6">
 {/* Budget Overview */}
 <div>
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Budget Status
 </h3>
 <div className="space-y-3">
 {budgets.slice(0, 3).map(budget => (
 <div key={budget.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 {budget.name}
 </h4>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBudgetStatusColor(budget.status)}`}>
 {budget.status}
 </span>
 </div>
 <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
 <div 
 className={`h-2 rounded-full ${
 budget.utilization > 100 ? 'bg-red-500' :
 budget.utilization > 80 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(budget.utilization, 100)}%` }}
 />
 </div>
 <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
 <span>${budget.currentSpend.toLocaleString()} spent</span>
 <span>${budget.amount.toLocaleString()} budget</span>
 </div>
 </div>
 <div className="text-right ml-6">
 <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {budget.utilization.toFixed(1)}%
 </div>
 <div className="text-xs text-gray-500 dark:text-gray-400">
 {budget.daysRemainingInPeriod} days left
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Recent Alerts */}
 <div>
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Recent Alerts
 </h3>
 <div className="space-y-3">
 {alerts.slice(0, 3).map(alert => (
 <div key={alert.id} className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 {alert.name}
 </h4>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
 {alert.severity}
 </span>
 </div>
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
 {alert.message}
 </p>
 {alert.recommendations && alert.recommendations.length > 0 && (
 <div className="text-xs text-gray-500 dark:text-gray-400">
 Recommended: {alert.recommendations[0]}
 </div>
 )}
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleSnoozeAlert(alert.id, 60)}
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 title="Snooze for 1 hour"
 >
 <Clock className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleResolveAlert(alert.id)}
 className="p-2 text-green-600 hover:text-green-800 dark:hover:text-green-400"
 title="Resolve alert"
 >
 <CheckCircle className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'budgets' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Budget Management
 </h3>
 <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
 <Plus className="w-4 h-4" />
 Create Budget
 </button>
 </div>
 
 <div className="grid gap-4">
 {budgets.map(budget => (
 <div key={budget.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 {budget.name}
 </h4>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 {budget.provider} • Monthly Budget
 </p>
 </div>
 <span className={`px-3 py-1 rounded-full text-sm font-medium ${getBudgetStatusColor(budget.status)}`}>
 {budget.status.toUpperCase()}
 </span>
 </div>
 
 <div className="space-y-4">
 <div className="grid grid-cols-3 gap-4 text-center">
 <div>
 <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 ${budget.amount.toLocaleString()}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">Budget</div>
 </div>
 <div>
 <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 ${budget.currentSpend.toLocaleString()}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">Spent</div>
 </div>
 <div>
 <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {budget.daysRemainingInPeriod}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">Days Left</div>
 </div>
 </div>
 
 <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
 <div 
 className={`h-3 rounded-full transition-all duration-300 ${
 budget.utilization > 100 ? 'bg-red-500' :
 budget.utilization > 80 ? 'bg-yellow-500' : 'bg-green-500'
 }`}
 style={{ width: `${Math.min(budget.utilization, 100)}%` }}
 />
 </div>
 
 <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
 <span>{budget.utilization.toFixed(1)}% utilized</span>
 <span>${(budget.amount - budget.currentSpend).toLocaleString()} remaining</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'alerts' && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Cost Alerts
 </h3>
 
 <div className="space-y-3">
 {alerts.map(alert => (
 <div key={alert.id} className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 {alert.name}
 </h4>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
 {alert.severity}
 </span>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 alert.status === 'active' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
 alert.status === 'snoozed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
 }`}>
 {alert.status}
 </span>
 </div>
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
 {alert.message}
 </p>
 {alert.recommendations && alert.recommendations.length > 0 && (
 <div className="space-y-1">
 <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
 Recommendations:
 </p>
 <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
 {alert.recommendations.map((rec, index) => (
 <li key={index}>{rec}</li>
 ))}
 </ul>
 </div>
 )}
 </div>
 {alert.status === 'active' && (
 <div className="flex items-center gap-2">
 <button
 onClick={() => handleSnoozeAlert(alert.id, 60)}
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
 title="Snooze for 1 hour"
 >
 <EyeOff className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleResolveAlert(alert.id)}
 className="p-2 text-green-600 hover:text-green-800 dark:hover:text-green-400 rounded-md hover:bg-green-100 dark:hover:bg-green-900"
 title="Resolve alert"
 >
 <CheckCircle className="w-4 h-4" />
 </button>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'forecasts' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Cost Forecasts
 </h3>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
 6-Month Cost Projection
 </h4>
 <ResponsiveContainer width="100%" height={300}>
 <AreaChart data={forecasts}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" />
 <YAxis />
 <Tooltip formatter={(value: any) => [`$${value.toFixed(2)}`, 'Forecast Cost']} />
 <Area type="monotone" dataKey="forecastCost" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
 </AreaChart>
 </ResponsiveContainer>
 </div>

 <div className="grid gap-4">
 {forecasts.map((forecast, index) => (
 <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
 <div>
 <div className="font-medium text-gray-900 dark:text-gray-100">
 {forecast.month}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">
 {Math.round(forecast.confidence * 100)}% confidence
 </div>
 </div>
 <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 ${forecast.forecastCost.toLocaleString()}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'optimization' && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Cost Optimization Recommendations
 </h3>
 
 <div className="text-center py-12">
 <Zap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Optimization Analysis
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Advanced cost optimization recommendations will be displayed here
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}