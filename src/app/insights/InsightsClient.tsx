'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, Activity, Target, 
  Calendar, Download, Filter, RefreshCw, Share,
  ArrowUp, ArrowDown, Eye, MousePointer, Clock,
  GitBranch, Package, Database, Zap, AlertCircle,
  CheckCircle, Settings, PieChart, LineChart, Settings2
} from 'lucide-react';

interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface UsageMetric {
  date: string;
  activeUsers: number;
  pageViews: number;
  pluginUsage: number;
  templateUsage: number;
}

interface TopFeature {
  name: string;
  usage: number;
  change: number;
  category: string;
}

interface UserSegment {
  name: string;
  users: number;
  percentage: number;
  engagement: number;
}

interface TeamMetric {
  team: string;
  adoption: number;
  satisfaction: number;
  activeUsers: number;
  topFeatures: string[];
}

// Mock data for Insights
const metricCards: MetricCard[] = [
  {
    id: 'active-users',
    title: 'Active Users',
    value: '2,847',
    change: 12.5,
    changeLabel: 'vs last month',
    icon: Users,
    color: 'blue'
  },
  {
    id: 'page-views',
    title: 'Monthly Page Views',
    value: '156,432',
    change: 8.3,
    changeLabel: 'vs last month',
    icon: Eye,
    color: 'green'
  },
  {
    id: 'feature-adoption',
    title: 'Feature Adoption',
    value: '89%',
    change: 5.2,
    changeLabel: 'vs last quarter',
    icon: Target,
    color: 'purple'
  },
  {
    id: 'satisfaction',
    title: 'Satisfaction Score',
    value: '4.7/5',
    change: 0.3,
    changeLabel: 'vs last survey',
    icon: CheckCircle,
    color: 'orange'
  }
];

const usageData: UsageMetric[] = [
  { date: '2024-01-01', activeUsers: 2420, pageViews: 142000, pluginUsage: 890, templateUsage: 340 },
  { date: '2024-01-02', activeUsers: 2510, pageViews: 148000, pluginUsage: 920, templateUsage: 360 },
  { date: '2024-01-03', activeUsers: 2680, pageViews: 155000, pluginUsage: 980, templateUsage: 380 },
  { date: '2024-01-04', activeUsers: 2750, pageViews: 159000, pluginUsage: 1020, templateUsage: 395 },
  { date: '2024-01-05', activeUsers: 2847, pageViews: 162000, pluginUsage: 1080, templateUsage: 420 }
];

const topFeatures: TopFeature[] = [
  { name: 'Software Catalog', usage: 2456, change: 15.2, category: 'Core' },
  { name: 'TechDocs', usage: 1890, change: 8.7, category: 'Documentation' },
  { name: 'Scaffolder Templates', usage: 1234, change: 22.1, category: 'Creation' },
  { name: 'Plugin Marketplace', usage: 987, change: 31.5, category: 'Extension' },
  { name: 'API Catalog', usage: 876, change: 12.8, category: 'Discovery' },
  { name: 'Kubernetes Dashboard', usage: 654, change: 19.3, category: 'Monitoring' }
];

const userSegments: UserSegment[] = [
  { name: 'Frontend Developers', users: 1248, percentage: 43.8, engagement: 87 },
  { name: 'Backend Developers', users: 892, percentage: 31.3, engagement: 82 },
  { name: 'DevOps Engineers', users: 445, percentage: 15.6, engagement: 91 },
  { name: 'Product Managers', users: 178, percentage: 6.3, engagement: 74 },
  { name: 'Designers', users: 84, percentage: 3.0, engagement: 68 }
];

const teamMetrics: TeamMetric[] = [
  {
    team: 'Platform Engineering',
    adoption: 98,
    satisfaction: 4.9,
    activeUsers: 45,
    topFeatures: ['Kubernetes Dashboard', 'API Catalog', 'Monitoring']
  },
  {
    team: 'Product Development',
    adoption: 89,
    satisfaction: 4.6,
    activeUsers: 123,
    topFeatures: ['Software Catalog', 'TechDocs', 'Scaffolder']
  },
  {
    team: 'Data Engineering',
    adoption: 76,
    satisfaction: 4.3,
    activeUsers: 67,
    topFeatures: ['Pipeline Catalog', 'Data Discovery', 'Lineage']
  },
  {
    team: 'Security',
    adoption: 94,
    satisfaction: 4.8,
    activeUsers: 34,
    topFeatures: ['Security Scanning', 'Compliance', 'Audit Logs']
  }
];

export default function InsightsClient() {
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'adoption' | 'teams'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="spotify-card p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-${metric.color}-500/10`}>
                <metric.icon className={`h-6 w-6 text-${metric.color}-600`} />
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                metric.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.change > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                <span>{Math.abs(metric.change)}%</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-1">{metric.value}</h3>
            <p className="text-sm text-muted-foreground">{metric.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{metric.changeLabel}</p>
          </motion.div>
        ))}
      </div>

      {/* Usage Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="spotify-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Usage Trends</h2>
          <div className="flex items-center gap-2">
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="spotify-input text-sm">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>
        </div>
        
        <div className="h-64 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <LineChart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Interactive usage chart would appear here</p>
            <p className="text-sm text-muted-foreground">Showing active users, page views, and feature usage over time</p>
          </div>
        </div>
      </motion.div>

      {/* Top Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="spotify-card p-6"
      >
        <h2 className="text-xl font-bold text-foreground mb-6">Top Features This Month</h2>
        <div className="space-y-4">
          {topFeatures.map((feature, index) => (
            <div key={feature.name} className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{feature.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{feature.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{feature.usage.toLocaleString()}</p>
                <div className={`flex items-center gap-1 text-sm ${
                  feature.change > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {feature.change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  <span>{feature.change}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderUsageTab = () => (
    <div className="space-y-6">
      {/* User Segments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="spotify-card p-6"
      >
        <h2 className="text-xl font-bold text-foreground mb-6">User Segments</h2>
        <div className="space-y-4">
          {userSegments.map((segment) => (
            <div key={segment.name} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{segment.name}</h3>
                  <span className="text-sm text-muted-foreground">{segment.users} users</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Share</span>
                      <span className="text-xs font-medium">{segment.percentage}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${segment.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Engagement</span>
                      <span className="text-xs font-medium">{segment.engagement}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-accent h-2 rounded-full"
                        style={{ width: `${segment.engagement}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Feature Usage Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="spotify-card p-6"
      >
        <h2 className="text-xl font-bold text-foreground mb-6">Feature Usage Breakdown</h2>
        <div className="h-64 bg-gradient-to-r from-accent/5 to-primary/5 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <PieChart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Feature usage pie chart would appear here</p>
            <p className="text-sm text-muted-foreground">Breaking down usage by feature category and popularity</p>
          </div>
        </div>
      </motion.div>
    </div>
  );

  const renderAdoptionTab = () => (
    <div className="space-y-6">
      {/* Adoption Funnel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="spotify-card p-6"
      >
        <h2 className="text-xl font-bold text-foreground mb-6">Adoption Funnel</h2>
        <div className="space-y-4">
          {[
            { stage: 'Invited to Platform', users: 3200, percentage: 100 },
            { stage: 'First Login', users: 2956, percentage: 92.4 },
            { stage: 'Service Registered', users: 2680, percentage: 83.8 },
            { stage: 'First Template Used', users: 2134, percentage: 66.7 },
            { stage: 'Active Weekly User', users: 1847, percentage: 57.7 }
          ].map((stage, index) => (
            <div key={stage.stage} className="relative">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground">{stage.stage}</h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{stage.users} users</span>
                  <span className="text-sm font-semibold text-foreground">{stage.percentage}%</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stage.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Time to Value */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {[
          { metric: 'Time to First Service', value: '2.3 days', change: -15.2, icon: Package },
          { metric: 'Time to First Deploy', value: '4.7 days', change: -8.7, icon: GitBranch },
          { metric: 'Feature Discovery Rate', value: '78%', change: 12.1, icon: Target }
        ].map((metric) => (
          <div key={metric.metric} className="spotify-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <metric.icon className="h-6 w-6 text-primary" />
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                metric.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.change > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                <span>{Math.abs(metric.change)}%</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-1">{metric.value}</h3>
            <p className="text-sm text-muted-foreground">{metric.metric}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );

  const renderTeamsTab = () => (
    <div className="space-y-6">
      {teamMetrics.map((team, index) => (
        <motion.div
          key={team.team}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="spotify-card p-6"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">{team.team}</h3>
              <p className="text-sm text-muted-foreground">{team.activeUsers} active users</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{team.adoption}%</p>
                <p className="text-xs text-muted-foreground">Adoption</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">{team.satisfaction}</p>
                <p className="text-xs text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-foreground mb-3">Adoption Progress</h4>
              <div className="w-full bg-muted rounded-full h-3 mb-2">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-500"
                  style={{ width: `${team.adoption}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{team.adoption}% of team members actively using the platform</p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Top Features</h4>
              <div className="flex flex-wrap gap-2">
                {team.topFeatures.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 bg-muted rounded-full text-sm text-muted-foreground"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="spotify-layout min-h-screen">
      <div className="spotify-main-content">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold spotify-gradient-text">Insights</h1>
                <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  Premium
                </span>
              </div>
              <p className="text-muted-foreground">
                Portal usage analytics, adoption metrics, and leadership reporting
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="spotify-button-secondary px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button className="spotify-button-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Report
              </button>
            </div>
          </motion.div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-muted/30 p-1 rounded-xl w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'usage', label: 'Usage Analytics', icon: Activity },
              { id: 'adoption', label: 'Adoption Metrics', icon: TrendingUp },
              { id: 'teams', label: 'Team Performance', icon: Users }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'spotify-tab-active'
                    : 'spotify-tab-inactive'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'usage' && renderUsageTab()}
            {activeTab === 'adoption' && renderAdoptionTab()}
            {activeTab === 'teams' && renderTeamsTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}