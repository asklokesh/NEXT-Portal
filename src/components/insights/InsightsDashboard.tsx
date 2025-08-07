'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Users, Activity, Eye, Clock,
  Heart, Star, MessageSquare, GitBranch, Package,
  Zap, Target, Award, AlertTriangle, CheckCircle,
  RefreshCw, Download, Filter, Calendar, Search,
  ArrowUp, ArrowDown, Minus, PieChart, LineChart,
  Globe, Database, Code, BookOpen, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MetricData {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

interface UsageMetric {
  id: string;
  name: string;
  description: string;
  value: number;
  previousValue: number;
  unit: string;
  category: 'adoption' | 'engagement' | 'performance' | 'satisfaction';
  icon: any;
  color: string;
}

interface TeamInsight {
  teamId: string;
  teamName: string;
  members: number;
  services: number;
  templates: number;
  documentation: number;
  activity: number;
  satisfaction: number;
  adoption: number;
}

interface FeatureUsage {
  feature: string;
  usage: number;
  users: number;
  growth: number;
  category: string;
}

const TIME_PERIODS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '1y', label: 'Last year' }
];

const METRIC_CATEGORIES = [
  {
    id: 'adoption',
    name: 'Adoption',
    description: 'Platform adoption and user growth metrics',
    icon: TrendingUp,
    color: 'text-green-600 bg-green-100'
  },
  {
    id: 'engagement',
    name: 'Engagement',
    description: 'User engagement and activity metrics',
    icon: Activity,
    color: 'text-blue-600 bg-blue-100'
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Platform performance and efficiency metrics',
    icon: Zap,
    color: 'text-yellow-600 bg-yellow-100'
  },
  {
    id: 'satisfaction',
    name: 'Satisfaction',
    description: 'Developer satisfaction and feedback metrics',
    icon: Heart,
    color: 'text-pink-600 bg-pink-100'
  }
];

export default function InsightsDashboard() {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [metrics, setMetrics] = useState<UsageMetric[]>([]);
  const [teamInsights, setTeamInsights] = useState<TeamInsight[]>([]);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchInsightsData();
  }, [selectedPeriod]);

  const fetchInsightsData = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockMetrics: UsageMetric[] = [
      {
        id: 'active-users',
        name: 'Active Users',
        description: 'Unique users accessing Backstage',
        value: 1247,
        previousValue: 1156,
        unit: 'users',
        category: 'adoption',
        icon: Users,
        color: 'text-blue-600'
      },
      {
        id: 'service-registrations',
        name: 'Service Registrations',
        description: 'New services added to catalog',
        value: 89,
        previousValue: 76,
        unit: 'services',
        category: 'adoption',
        icon: Package,
        color: 'text-green-600'
      },
      {
        id: 'template-usage',
        name: 'Template Usage',
        description: 'Templates used to create new projects',
        value: 156,
        previousValue: 142,
        unit: 'uses',
        category: 'engagement',
        icon: GitBranch,
        color: 'text-purple-600'
      },
      {
        id: 'documentation-views',
        name: 'Documentation Views',
        description: 'TechDocs page views and engagement',
        value: 3421,
        previousValue: 3187,
        unit: 'views',
        category: 'engagement',
        icon: BookOpen,
        color: 'text-indigo-600'
      },
      {
        id: 'search-queries',
        name: 'Search Queries',
        description: 'Catalog and documentation searches',
        value: 2156,
        previousValue: 2341,
        unit: 'queries',
        category: 'engagement',
        icon: Search,
        color: 'text-orange-600'
      },
      {
        id: 'plugin-installs',
        name: 'Plugin Installations',
        description: 'New plugin installations',
        value: 34,
        previousValue: 28,
        unit: 'installs',
        category: 'adoption',
        icon: Settings,
        color: 'text-teal-600'
      },
      {
        id: 'avg-session-time',
        name: 'Avg Session Time',
        description: 'Average user session duration',
        value: 23,
        previousValue: 21,
        unit: 'minutes',
        category: 'engagement',
        icon: Clock,
        color: 'text-amber-600'
      },
      {
        id: 'satisfaction-score',
        name: 'Satisfaction Score',
        description: 'Developer satisfaction rating',
        value: 4.2,
        previousValue: 4.0,
        unit: 'score',
        category: 'satisfaction',
        icon: Star,
        color: 'text-yellow-600'
      }
    ];

    const mockTeamInsights: TeamInsight[] = [
      {
        teamId: 'platform',
        teamName: 'Platform Team',
        members: 8,
        services: 23,
        templates: 12,
        documentation: 45,
        activity: 92,
        satisfaction: 4.5,
        adoption: 95
      },
      {
        teamId: 'frontend',
        teamName: 'Frontend Team',
        members: 12,
        services: 18,
        templates: 8,
        documentation: 32,
        activity: 88,
        satisfaction: 4.3,
        adoption: 87
      },
      {
        teamId: 'backend',
        teamName: 'Backend Team',
        members: 15,
        services: 31,
        templates: 6,
        documentation: 28,
        activity: 85,
        satisfaction: 4.1,
        adoption: 82
      }
    ];

    const mockFeatureUsage: FeatureUsage[] = [
      {
        feature: 'Software Catalog',
        usage: 95,
        users: 1180,
        growth: 12,
        category: 'core'
      },
      {
        feature: 'TechDocs',
        usage: 78,
        users: 967,
        growth: 18,
        category: 'core'
      },
      {
        feature: 'Software Templates',
        usage: 65,
        users: 810,
        growth: 25,
        category: 'core'
      },
      {
        feature: 'Kubernetes Plugin',
        usage: 45,
        users: 560,
        growth: 32,
        category: 'plugins'
      },
      {
        feature: 'GitHub Actions',
        usage: 52,
        users: 648,
        growth: 15,
        category: 'plugins'
      }
    ];

    setMetrics(mockMetrics);
    setTeamInsights(mockTeamInsights);
    setFeatureUsage(mockFeatureUsage);
    setLoading(false);
  };

  const filteredMetrics = metrics.filter(metric => {
    const matchesCategory = selectedCategory === 'all' || metric.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      metric.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      metric.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (current < previous) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Insights
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Analyzing platform usage and developer metrics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <BarChart3 className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Insights & Analytics</h1>
              <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                Premium
              </span>
            </div>
            <p className="text-xl text-blue-100">
              Developer experience analytics and platform adoption insights
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchInsightsData}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center transition-colors"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh
            </button>
            <button className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 flex items-center transition-colors">
              <Download className="w-5 h-5 mr-2" />
              Export Report
            </button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">1,247</div>
                <div className="text-sm text-blue-100">Active Users</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Activity className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">89%</div>
                <div className="text-sm text-blue-100">Adoption Rate</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Star className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">4.2</div>
                <div className="text-sm text-blue-100">Satisfaction</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">+12%</div>
                <div className="text-sm text-blue-100">Growth</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search metrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              {TIME_PERIODS.map(period => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </select>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Categories</option>
              {METRIC_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            
            <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredMetrics.map((metric) => {
          const Icon = metric.icon;
          const change = getChangePercent(metric.value, metric.previousValue);
          
          return (
            <motion.div
              key={metric.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${metric.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex items-center">
                  {getTrendIcon(metric.value, metric.previousValue)}
                  <span className={`text-sm font-medium ml-1 ${getChangeColor(change)}`}>
                    {change > 0 ? '+' : ''}{change}%
                  </span>
                </div>
              </div>
              
              <div className="mb-2">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metric.value.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {metric.unit}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {metric.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {metric.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Team Insights */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Team Insights</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Platform adoption and engagement by team
            </p>
          </div>
          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            View All Teams
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Team</th>
                <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Members</th>
                <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Services</th>
                <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Activity</th>
                <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Satisfaction</th>
                <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Adoption</th>
              </tr>
            </thead>
            <tbody>
              {teamInsights.map((team) => (
                <tr key={team.teamId} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {team.teamName}
                    </div>
                  </td>
                  <td className="py-4 text-gray-600 dark:text-gray-400">
                    {team.members}
                  </td>
                  <td className="py-4 text-gray-600 dark:text-gray-400">
                    {team.services}
                  </td>
                  <td className="py-4">
                    <div className="flex items-center">
                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${team.activity}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {team.activity}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-500 mr-1" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {team.satisfaction}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center">
                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${team.adoption}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {team.adoption}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Feature Usage</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Most popular features and their adoption rates
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          {featureUsage.map((feature, index) => (
            <div key={feature.feature} className="flex items-center justify-between">
              <div className="flex items-center flex-1">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mr-4">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {feature.feature}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
                      {feature.users} users
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${feature.usage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {feature.usage}%
                    </span>
                  </div>
                </div>
                <div className="ml-6 text-right">
                  <div className="flex items-center text-green-600">
                    <ArrowUp className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">+{feature.growth}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}