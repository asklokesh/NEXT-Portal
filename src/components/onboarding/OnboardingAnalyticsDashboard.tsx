/**
 * Onboarding Analytics Dashboard
 * Real-time analytics and insights for onboarding optimization
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import {
  Activity,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Mail,
  Smartphone,
  Globe,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  Eye,
  MousePointer,
  UserCheck,
  DollarSign
} from 'lucide-react';

interface OnboardingMetrics {
  overview: OverviewMetrics;
  funnel: FunnelMetrics;
  conversion: ConversionMetrics;
  engagement: EngagementMetrics;
  performance: PerformanceMetrics;
  cohort: CohortMetrics;
  geographic: GeographicMetrics;
  device: DeviceMetrics;
  source: SourceMetrics;
  timeRange: string;
}

interface OverviewMetrics {
  totalSignups: number;
  completedOnboardings: number;
  conversionRate: number;
  averageCompletionTime: number;
  dropoffRate: number;
  revenueGenerated: number;
  trends: {
    signups: TrendData[];
    completions: TrendData[];
    conversions: TrendData[];
  };
}

interface TrendData {
  date: string;
  value: number;
  change: number;
}

interface FunnelMetrics {
  steps: FunnelStep[];
  dropoffPoints: DropoffPoint[];
  optimizationOpportunities: OptimizationOpportunity[];
}

interface FunnelStep {
  name: string;
  users: number;
  dropoff: number;
  conversionRate: number;
  averageTime: number;
}

interface DropoffPoint {
  step: string;
  dropoffRate: number;
  primaryReasons: string[];
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface OptimizationOpportunity {
  area: string;
  description: string;
  potentialImpact: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  priority: number;
}

interface ConversionMetrics {
  bySource: SourceConversion[];
  byFlow: FlowConversion[];
  byTimeframe: TimeframeConversion[];
  factors: ConversionFactor[];
}

interface SourceConversion {
  source: string;
  signups: number;
  conversions: number;
  rate: number;
  revenue: number;
}

interface FlowConversion {
  flowName: string;
  users: number;
  conversions: number;
  rate: number;
  avgTime: number;
}

interface TimeframeConversion {
  timeframe: string;
  rate: number;
  volume: number;
}

interface ConversionFactor {
  factor: string;
  impact: number;
  confidence: number;
}

interface EngagementMetrics {
  emailEngagement: EmailEngagement;
  tutorialEngagement: TutorialEngagement;
  featureAdoption: FeatureAdoption[];
  userBehavior: UserBehavior;
}

interface EmailEngagement {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  byProvider: ProviderMetrics[];
}

interface ProviderMetrics {
  provider: string;
  volume: number;
  deliveryRate: number;
  openRate: number;
}

interface TutorialEngagement {
  startRate: number;
  completionRate: number;
  averageProgress: number;
  dropoffPoints: string[];
  feedbackScore: number;
}

interface FeatureAdoption {
  feature: string;
  adoptionRate: number;
  timeToAdopt: number;
  impact: number;
}

interface UserBehavior {
  sessionDuration: number;
  pageViews: number;
  interactions: number;
  returnRate: number;
}

interface PerformanceMetrics {
  loadTimes: LoadTimeMetrics;
  errorRates: ErrorMetrics;
  uptime: number;
  apiPerformance: ApiMetrics[];
}

interface LoadTimeMetrics {
  average: number;
  p95: number;
  p99: number;
  byPage: PagePerformance[];
}

interface PagePerformance {
  page: string;
  loadTime: number;
  abandonmentRate: number;
}

interface ErrorMetrics {
  total: number;
  rate: number;
  byType: ErrorType[];
}

interface ErrorType {
  type: string;
  count: number;
  impact: string;
}

interface ApiMetrics {
  endpoint: string;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

interface CohortMetrics {
  retentionCurves: CohortData[];
  activationRates: ActivationData[];
  lifetimeValue: LtvData[];
}

interface CohortData {
  cohort: string;
  day0: number;
  day1: number;
  day7: number;
  day30: number;
}

interface ActivationData {
  cohort: string;
  activationRate: number;
  timeToActivation: number;
}

interface LtvData {
  cohort: string;
  ltv30: number;
  ltv90: number;
  ltv365: number;
}

interface GeographicMetrics {
  byCountry: CountryMetrics[];
  byTimezone: TimezoneMetrics[];
  conversionByRegion: RegionConversion[];
}

interface CountryMetrics {
  country: string;
  signups: number;
  conversions: number;
  rate: number;
}

interface TimezoneMetrics {
  timezone: string;
  signups: number;
  peakHours: number[];
}

interface RegionConversion {
  region: string;
  rate: number;
  averageRevenue: number;
}

interface DeviceMetrics {
  byDevice: DeviceBreakdown[];
  byBrowser: BrowserBreakdown[];
  performanceByDevice: DevicePerformance[];
}

interface DeviceBreakdown {
  device: string;
  percentage: number;
  conversionRate: number;
}

interface BrowserBreakdown {
  browser: string;
  percentage: number;
  issues: string[];
}

interface DevicePerformance {
  device: string;
  loadTime: number;
  errorRate: number;
}

interface SourceMetrics {
  trafficSources: TrafficSource[];
  campaignPerformance: CampaignMetrics[];
  attributionModel: AttributionData[];
}

interface TrafficSource {
  source: string;
  visitors: number;
  signups: number;
  conversions: number;
  cost?: number;
  roi?: number;
}

interface CampaignMetrics {
  campaign: string;
  impressions: number;
  clicks: number;
  signups: number;
  conversions: number;
  cost: number;
  roi: number;
}

interface AttributionData {
  touchpoint: string;
  influence: number;
  position: 'FIRST' | 'MIDDLE' | 'LAST';
}

export function OnboardingAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<OnboardingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMetrics();
  }, [timeRange, filters]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeRange,
          filters
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load onboarding analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/onboarding/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeRange,
          filters,
          format: 'csv'
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `onboarding-analytics-${timeRange}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
          <span className="text-lg text-gray-600">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load analytics</h3>
          <p className="text-gray-600 mb-4">There was an error loading the onboarding analytics.</p>
          <button
            onClick={loadMetrics}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Onboarding Analytics</h1>
              <p className="text-sm text-gray-600">Real-time insights and optimization opportunities</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              
              <button
                onClick={exportData}
                className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              
              <button
                onClick={loadMetrics}
                className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'funnel', label: 'Conversion Funnel', icon: Target },
              { id: 'engagement', label: 'Engagement', icon: UserCheck },
              { id: 'performance', label: 'Performance', icon: TrendingUp },
              { id: 'cohort', label: 'Cohort Analysis', icon: Users },
              { id: 'geographic', label: 'Geographic', icon: Globe },
              { id: 'sources', label: 'Traffic Sources', icon: MousePointer }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab metrics={metrics.overview} />}
        {activeTab === 'funnel' && <FunnelTab metrics={metrics.funnel} />}
        {activeTab === 'engagement' && <EngagementTab metrics={metrics.engagement} />}
        {activeTab === 'performance' && <PerformanceTab metrics={metrics.performance} />}
        {activeTab === 'cohort' && <CohortTab metrics={metrics.cohort} />}
        {activeTab === 'geographic' && <GeographicTab metrics={metrics.geographic} />}
        {activeTab === 'sources' && <SourcesTab metrics={metrics.source} />}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ metrics }: { metrics: OverviewMetrics }) {
  const keyMetrics = [
    {
      label: 'Total Signups',
      value: metrics.totalSignups.toLocaleString(),
      change: metrics.trends.signups[metrics.trends.signups.length - 1]?.change || 0,
      icon: Users,
      color: 'blue'
    },
    {
      label: 'Completed Onboardings',
      value: metrics.completedOnboardings.toLocaleString(),
      change: metrics.trends.completions[metrics.trends.completions.length - 1]?.change || 0,
      icon: CheckCircle,
      color: 'green'
    },
    {
      label: 'Conversion Rate',
      value: `${metrics.conversionRate.toFixed(1)}%`,
      change: metrics.trends.conversions[metrics.trends.conversions.length - 1]?.change || 0,
      icon: Target,
      color: 'purple'
    },
    {
      label: 'Avg. Completion Time',
      value: `${Math.round(metrics.averageCompletionTime)} min`,
      change: -5.2, // Improvement
      icon: Clock,
      color: 'orange'
    },
    {
      label: 'Revenue Generated',
      value: `$${metrics.revenueGenerated.toLocaleString()}`,
      change: 12.8,
      icon: DollarSign,
      color: 'green'
    },
    {
      label: 'Drop-off Rate',
      value: `${metrics.dropoffRate.toFixed(1)}%`,
      change: -2.1, // Improvement
      icon: XCircle,
      color: 'red'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {keyMetrics.map((metric) => {
          const Icon = metric.icon;
          const isPositive = metric.change > 0;
          const isNegative = metric.change < 0;
          
          return (
            <div key={metric.label} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-${metric.color}-100`}>
                  <Icon className={`w-6 h-6 text-${metric.color}-600`} />
                </div>
              </div>
              
              <div className="mt-4 flex items-center">
                {isPositive && (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                )}
                {isNegative && (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm font-medium ${
                  isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {isPositive ? '+' : ''}{metric.change.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500 ml-2">vs last period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trends Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Signup Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={metrics.trends.signups}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.trends.conversions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ fill: '#8B5CF6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Funnel Tab Component
function FunnelTab({ metrics }: { metrics: FunnelMetrics }) {
  const funnelData = metrics.steps.map((step, index) => ({
    name: step.name,
    value: step.users,
    fill: `hsl(${240 + index * 20}, 70%, 50%)`
  }));

  return (
    <div className="space-y-6">
      {/* Funnel Visualization */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={400}>
              <FunnelChart>
                <Tooltip />
                <Funnel
                  dataKey="value"
                  data={funnelData}
                  isAnimationActive
                >
                  <LabelList position="center" fill="#fff" stroke="none" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            {metrics.steps.map((step, index) => (
              <div key={step.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{step.name}</h4>
                  <span className="text-sm text-gray-500">
                    {step.conversionRate.toFixed(1)}% conversion
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Users</p>
                    <p className="font-medium">{step.users.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Drop-off</p>
                    <p className="font-medium text-red-600">{step.dropoff.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg. Time</p>
                    <p className="font-medium">{Math.round(step.averageTime)}s</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drop-off Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Drop-off Points</h3>
          <div className="space-y-4">
            {metrics.dropoffPoints.map((point, index) => (
              <div key={point.step} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{point.step}</p>
                  <p className="text-sm text-gray-600">
                    {point.primaryReasons.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-red-600">{point.dropoffRate.toFixed(1)}%</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    point.impact === 'HIGH' ? 'bg-red-100 text-red-800' :
                    point.impact === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {point.impact} impact
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Optimization Opportunities</h3>
          <div className="space-y-4">
            {metrics.optimizationOpportunities
              .sort((a, b) => b.priority - a.priority)
              .map((opportunity, index) => (
                <div key={opportunity.area} className="border-l-4 border-purple-500 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{opportunity.area}</h4>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      opportunity.difficulty === 'EASY' ? 'bg-green-100 text-green-800' :
                      opportunity.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {opportunity.difficulty}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{opportunity.description}</p>
                  <p className="text-sm font-medium text-purple-600">
                    Potential impact: +{opportunity.potentialImpact.toFixed(1)}% conversion
                  </p>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// Placeholder components for other tabs
function EngagementTab({ metrics }: { metrics: EngagementMetrics }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Engagement Metrics</h3>
      <p className="text-gray-600">Engagement analytics coming soon...</p>
    </div>
  );
}

function PerformanceTab({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
      <p className="text-gray-600">Performance analytics coming soon...</p>
    </div>
  );
}

function CohortTab({ metrics }: { metrics: CohortMetrics }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Cohort Analysis</h3>
      <p className="text-gray-600">Cohort analytics coming soon...</p>
    </div>
  );
}

function GeographicTab({ metrics }: { metrics: GeographicMetrics }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Geographic Metrics</h3>
      <p className="text-gray-600">Geographic analytics coming soon...</p>
    </div>
  );
}

function SourcesTab({ metrics }: { metrics: SourceMetrics }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Traffic Sources</h3>
      <p className="text-gray-600">Source analytics coming soon...</p>
    </div>
  );
}