'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Search, Filter, MoreVertical, Settings, Zap, Target,
  BarChart3, Activity, Calendar, Users, GitBranch,
  Star, Award, AlertCircle, Info, ExternalLink
} from 'lucide-react';

// Soundcheck track types - exact replica of Spotify Portal
enum TrackType {
  BASIC_HEALTH = 'basic-health',
  SECURITY = 'security',
  RELIABILITY = 'reliability',
  COST_EFFICIENCY = 'cost-efficiency',
  PERFORMANCE = 'performance',
  MAINTAINABILITY = 'maintainability'
}

interface Check {
  id: string;
  name: string;
  description: string;
  trackType: TrackType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'passing' | 'failing' | 'warning' | 'not-applicable';
  score: number;
  maxScore: number;
  lastRun: string;
  documentation?: string;
}

interface Service {
  id: string;
  name: string;
  overallScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  checks: Check[];
  owner: string;
  lastUpdated: string;
  trackScores: Record<TrackType, number>;
}

// Mock Soundcheck data matching Spotify Portal
const mockServices: Service[] = [
  {
    id: 'user-service',
    name: 'User Service',
    overallScore: 89,
    overallGrade: 'B',
    owner: 'Platform Team',
    lastUpdated: '2024-01-15T10:30:00Z',
    trackScores: {
      [TrackType.BASIC_HEALTH]: 95,
      [TrackType.SECURITY]: 92,
      [TrackType.RELIABILITY]: 87,
      [TrackType.COST_EFFICIENCY]: 82,
      [TrackType.PERFORMANCE]: 90,
      [TrackType.MAINTAINABILITY]: 88
    },
    checks: [
      {
        id: 'has-readme',
        name: 'Has README',
        description: 'Service has comprehensive README documentation',
        trackType: TrackType.BASIC_HEALTH,
        severity: 'medium',
        status: 'passing',
        score: 10,
        maxScore: 10,
        lastRun: '2024-01-15T10:30:00Z'
      },
      {
        id: 'security-scan',
        name: 'Security Scan',
        description: 'No critical security vulnerabilities',
        trackType: TrackType.SECURITY,
        severity: 'critical',
        status: 'warning',
        score: 8,
        maxScore: 10,
        lastRun: '2024-01-15T09:45:00Z'
      }
    ]
  },
  {
    id: 'payment-service',
    name: 'Payment Service',
    overallScore: 96,
    overallGrade: 'A',
    owner: 'Financial Team',
    lastUpdated: '2024-01-15T11:15:00Z',
    trackScores: {
      [TrackType.BASIC_HEALTH]: 98,
      [TrackType.SECURITY]: 97,
      [TrackType.RELIABILITY]: 95,
      [TrackType.COST_EFFICIENCY]: 94,
      [TrackType.PERFORMANCE]: 96,
      [TrackType.MAINTAINABILITY]: 98
    },
    checks: []
  }
];

const trackConfig = {
  [TrackType.BASIC_HEALTH]: {
    name: 'Basic Health',
    description: 'Fundamental service health and documentation',
    icon: CheckCircle,
    color: 'green'
  },
  [TrackType.SECURITY]: {
    name: 'Security',
    description: 'Security compliance and vulnerability management',
    icon: Shield,
    color: 'red'
  },
  [TrackType.RELIABILITY]: {
    name: 'Reliability',
    description: 'Service reliability and error handling',
    icon: Activity,
    color: 'blue'
  },
  [TrackType.COST_EFFICIENCY]: {
    name: 'Cost Efficiency',
    description: 'Resource optimization and cost management',
    icon: TrendingUp,
    color: 'yellow'
  },
  [TrackType.PERFORMANCE]: {
    name: 'Performance',
    description: 'Performance monitoring and optimization',
    icon: Zap,
    color: 'purple'
  },
  [TrackType.MAINTAINABILITY]: {
    name: 'Maintainability',
    description: 'Code quality and maintainability standards',
    icon: Settings,
    color: 'indigo'
  }
};

export default function SoundcheckPage() {
  const [services, setServices] = useState<Service[]>(mockServices);
  const [selectedTrack, setSelectedTrack] = useState<TrackType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'lastUpdated'>('score');

  // Calculate overall stats
  const stats = {
    totalServices: services.length,
    averageScore: Math.round(services.reduce((sum, s) => sum + s.overallScore, 0) / services.length),
    passingServices: services.filter(s => s.overallScore >= 80).length,
    criticalIssues: services.reduce((sum, s) => 
      sum + s.checks.filter(c => c.severity === 'critical' && c.status === 'failing').length, 0
    )
  };

  // Filter and sort services
  const filteredServices = services
    .filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.overallScore - a.overallScore;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'lastUpdated':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100 border-green-200';
      case 'B': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'C': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'D': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'F': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

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
                <Shield className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold spotify-gradient-text">Soundcheck</h1>
                <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  Premium
                </span>
              </div>
              <p className="text-muted-foreground">
                Tech health management and standards enforcement across your services
              </p>
            </div>
            <button className="spotify-button-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure Tracks
            </button>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Services', value: stats.totalServices, icon: Target, color: 'primary' },
              { label: 'Average Score', value: `${stats.averageScore}%`, icon: BarChart3, color: 'blue' },
              { label: 'Passing Services', value: stats.passingServices, icon: CheckCircle, color: 'green' },
              { label: 'Critical Issues', value: stats.criticalIssues, icon: AlertTriangle, color: 'red' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="spotify-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    stat.color === 'primary' ? 'bg-primary/10' :
                    stat.color === 'blue' ? 'bg-blue-500/10' :
                    stat.color === 'green' ? 'bg-green-500/10' :
                    stat.color === 'red' ? 'bg-red-500/10' :
                    'bg-muted'
                  }`}>
                    <stat.icon className={`h-6 w-6 ${
                      stat.color === 'primary' ? 'text-primary' :
                      stat.color === 'blue' ? 'text-blue-600' :
                      stat.color === 'green' ? 'text-green-600' :
                      stat.color === 'red' ? 'text-red-600' :
                      'text-foreground'
                    }`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tracks Overview */}
        <div className="spotify-card p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Soundcheck Tracks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(trackConfig).map(([key, track]) => {
              const TrackIcon = track.icon;
              const avgScore = Math.round(
                services.reduce((sum, s) => sum + s.trackScores[key as TrackType], 0) / services.length
              );
              
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-xl border border-border/50 hover:border-primary/20 transition-all cursor-pointer"
                  onClick={() => setSelectedTrack(key as TrackType)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <TrackIcon className={`h-5 w-5 ${
                      track.color === 'green' ? 'text-green-600' :
                      track.color === 'red' ? 'text-red-600' :
                      track.color === 'blue' ? 'text-blue-600' :
                      track.color === 'yellow' ? 'text-yellow-600' :
                      track.color === 'purple' ? 'text-purple-600' :
                      track.color === 'indigo' ? 'text-indigo-600' :
                      'text-foreground'
                    }`} />
                    <h3 className="font-semibold text-foreground">{track.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{track.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{avgScore}%</span>
                    <div className={`w-16 h-2 rounded-full ${
                      track.color === 'green' ? 'bg-green-200' :
                      track.color === 'red' ? 'bg-red-200' :
                      track.color === 'blue' ? 'bg-blue-200' :
                      track.color === 'yellow' ? 'bg-yellow-200' :
                      track.color === 'purple' ? 'bg-purple-200' :
                      track.color === 'indigo' ? 'bg-indigo-200' :
                      'bg-muted'
                    }`}>
                      <div 
                        className={`h-full rounded-full ${
                          track.color === 'green' ? 'bg-green-600' :
                          track.color === 'red' ? 'bg-red-600' :
                          track.color === 'blue' ? 'bg-blue-600' :
                          track.color === 'yellow' ? 'bg-yellow-600' :
                          track.color === 'purple' ? 'bg-purple-600' :
                          track.color === 'indigo' ? 'bg-indigo-600' :
                          'bg-muted-foreground'
                        }`} 
                        style={{ width: `${avgScore}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="spotify-card p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="spotify-input pl-10 w-full"
              />
            </div>

            <div className="flex items-center gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="spotify-input"
              >
                <option value="score">Sort by Score</option>
                <option value="name">Sort by Name</option>
                <option value="lastUpdated">Sort by Last Updated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-4">
          {filteredServices.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="spotify-card p-6 hover:spotify-card-hover"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-foreground">{service.name}</h3>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getGradeColor(service.overallGrade)}`}>
                      Grade {service.overallGrade}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">by {service.owner}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{service.overallScore}%</p>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                  </div>
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              {/* Track Scores */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(trackConfig).map(([key, track]) => {
                  const score = service.trackScores[key as TrackType];
                  const TrackIcon = track.icon;
                  
                  return (
                    <div key={key} className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <TrackIcon className={`h-4 w-4 ${
                          track.color === 'green' ? 'text-green-600' :
                          track.color === 'red' ? 'text-red-600' :
                          track.color === 'blue' ? 'text-blue-600' :
                          track.color === 'yellow' ? 'text-yellow-600' :
                          track.color === 'purple' ? 'text-purple-600' :
                          track.color === 'indigo' ? 'text-indigo-600' :
                          'text-foreground'
                        }`} />
                      </div>
                      <p className="text-lg font-semibold text-foreground">{score}%</p>
                      <p className="text-xs text-muted-foreground">{track.name}</p>
                    </div>
                  );
                })}
              </div>

              {/* Recent Checks */}
              {service.checks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Recent Check Results</h4>
                  <div className="flex items-center gap-4">
                    {service.checks.slice(0, 3).map(check => {
                      const StatusIcon = check.status === 'passing' ? CheckCircle :
                                       check.status === 'warning' ? AlertTriangle :
                                       check.status === 'failing' ? AlertCircle : Info;
                      const statusColor = check.status === 'passing' ? 'text-green-600' :
                                        check.status === 'warning' ? 'text-yellow-600' :
                                        check.status === 'failing' ? 'text-red-600' : 'text-gray-600';
                      
                      return (
                        <div key={check.id} className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                          <span className="text-sm text-muted-foreground">{check.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredServices.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No services found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or add services to Soundcheck
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}