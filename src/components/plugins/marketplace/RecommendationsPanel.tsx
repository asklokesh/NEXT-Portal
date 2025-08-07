'use client';

import React, { useMemo } from 'react';
import {
  Lightbulb,
  TrendingUp,
  Users,
  Zap,
  Shield,
  Star,
  ChevronRight,
  Download,
  CheckCircle,
  Target,
  Brain,
  Sparkles,
} from 'lucide-react';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface RecommendationsPanelProps {
  installedPlugins: BackstagePlugin[];
  availablePlugins: BackstagePlugin[];
  onPluginSelect: (pluginId: string) => void;
}

interface Recommendation {
  type: 'complement' | 'popular' | 'similar' | 'trending';
  title: string;
  description: string;
  icon: any;
  plugins: BackstagePlugin[];
  priority: number;
}

function RecommendationCard({ 
  recommendation, 
  onPluginSelect 
}: { 
  recommendation: Recommendation;
  onPluginSelect: (pluginId: string) => void;
}) {
  const Icon = recommendation.icon;

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {recommendation.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {recommendation.description}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {recommendation.plugins.slice(0, 3).map((plugin) => (
          <div
            key={plugin.id}
            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors group"
            onClick={() => onPluginSelect(plugin.id)}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 bg-blue-600 rounded text-white text-xs font-bold flex items-center justify-center">
                {plugin.title.charAt(0)}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {plugin.title}
                </h4>
                {plugin.official && (
                  <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" title="Official" />
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {formatNumber(plugin.downloads || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {plugin.rating?.toFixed(1) || 'N/A'}
                </span>
                <span className="capitalize">{plugin.category.replace('-', ' ')}</span>
              </div>
            </div>
            
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
          </div>
        ))}
        
        {recommendation.plugins.length > 3 && (
          <div className="text-center pt-2">
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View {recommendation.plugins.length - 3} more plugins
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function RecommendationsPanel({ 
  installedPlugins, 
  availablePlugins, 
  onPluginSelect 
}: RecommendationsPanelProps) {
  const recommendations = useMemo<Recommendation[]>(() => {
    const recs: Recommendation[] = [];

    // Complementary plugins based on what's already installed
    const installedCategories = [...new Set(installedPlugins.map(p => p.category))];
    const complementaryMap: Record<string, string[]> = {
      'ci-cd': ['monitoring', 'security', 'infrastructure'],
      'monitoring': ['ci-cd', 'infrastructure', 'analytics'],
      'infrastructure': ['monitoring', 'security', 'ci-cd'],
      'security': ['infrastructure', 'monitoring', 'compliance'],
      'analytics': ['monitoring', 'documentation', 'productivity'],
      'documentation': ['analytics', 'productivity', 'development-tools'],
    };

    const complementaryCategories = installedCategories
      .flatMap(cat => complementaryMap[cat] || [])
      .filter((cat, index, self) => self.indexOf(cat) === index);

    const complementaryPlugins = availablePlugins
      .filter(p => complementaryCategories.includes(p.category))
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, 6);

    if (complementaryPlugins.length > 0) {
      recs.push({
        type: 'complement',
        title: 'Recommended for You',
        description: 'Plugins that work well with your current setup',
        icon: Target,
        plugins: complementaryPlugins,
        priority: 1,
      });
    }

    // Popular plugins
    const popularPlugins = availablePlugins
      .filter(p => (p.downloads || 0) > 10000)
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, 6);

    if (popularPlugins.length > 0) {
      recs.push({
        type: 'popular',
        title: 'Most Popular',
        description: 'Widely adopted plugins with proven track records',
        icon: TrendingUp,
        plugins: popularPlugins,
        priority: 2,
      });
    }

    // Trending plugins (recently updated with good ratings)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const trendingPlugins = availablePlugins
      .filter(p => {
        const lastUpdated = p.lastUpdated ? new Date(p.lastUpdated).getTime() : 0;
        return lastUpdated > thirtyDaysAgo && (p.rating || 0) >= 4.0;
      })
      .sort((a, b) => {
        const scoreA = (a.rating || 0) * (a.downloads || 0);
        const scoreB = (b.rating || 0) * (b.downloads || 0);
        return scoreB - scoreA;
      })
      .slice(0, 6);

    if (trendingPlugins.length > 0) {
      recs.push({
        type: 'trending',
        title: 'Trending Now',
        description: 'Recently updated plugins gaining popularity',
        icon: Sparkles,
        plugins: trendingPlugins,
        priority: 3,
      });
    }

    // AI/Smart recommendations based on plugin combinations
    const smartPlugins = availablePlugins
      .filter(p => {
        // Recommend plugins that are commonly installed together
        const hasComplementaryTags = installedPlugins.some(installed =>
          installed.tags.some(tag => p.tags.includes(tag))
        );
        return hasComplementaryTags && (p.rating || 0) >= 4.0;
      })
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6);

    if (smartPlugins.length > 0) {
      recs.push({
        type: 'similar',
        title: 'Smart Suggestions',
        description: 'AI-powered recommendations based on your preferences',
        icon: Brain,
        plugins: smartPlugins,
        priority: 4,
      });
    }

    return recs.sort((a, b) => a.priority - b.priority);
  }, [installedPlugins, availablePlugins]);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Lightbulb className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Plugin Recommendations
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={`${recommendation.type}-${recommendation.title}`}
            recommendation={recommendation}
            onPluginSelect={onPluginSelect}
          />
        ))}
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            Community Insights
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {availablePlugins.length}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              Available Plugins
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {Math.round(availablePlugins.reduce((sum, p) => sum + (p.rating || 0), 0) / availablePlugins.length * 10) / 10}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              Average Rating
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatNumber(availablePlugins.reduce((sum, p) => sum + (p.downloads || 0), 0))}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              Total Downloads
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}