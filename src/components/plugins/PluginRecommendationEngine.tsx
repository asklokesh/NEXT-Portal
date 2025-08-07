'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles, TrendingUp, Heart, Download, Star, Clock,
  ThumbsUp, ThumbsDown, Eye, EyeOff, Package, Zap,
  Target, Users, Award, BookOpen, Filter, RefreshCw,
  ArrowRight, Info, CheckCircle, AlertCircle, Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PluginRecommendation {
  pluginId: string;
  pluginName: string;
  description: string;
  category: string;
  score: number;
  confidence: number;
  reasoning: {
    primary: string;
    factors: string[];
    benefits: string[];
  };
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  timeToValue: 'immediate' | 'days' | 'weeks';
  prerequisites: string[];
  similarUsers: {
    count: number;
    adoptionRate: number;
    satisfaction: number;
  };
  metadata: {
    downloads: number;
    stars: number;
    lastUpdate: string;
    maintainers: number;
    communitySize: number;
  };
}

interface UserProfile {
  id: string;
  role: string;
  experience: string;
  interests: string[];
}

interface PluginRecommendationEngineProps {
  userId?: string;
  onPluginSelect?: (pluginId: string) => void;
  onFeedback?: (pluginId: string, action: string) => void;
  className?: string;
}

export default function PluginRecommendationEngine({ 
  userId = 'user1',
  onPluginSelect,
  onFeedback,
  className = '' 
}: PluginRecommendationEngineProps) {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<PluginRecommendation[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [dismissedPlugins, setDismissedPlugins] = useState<Set<string>>(new Set());
  const [likedPlugins, setLikedPlugins] = useState<Set<string>>(new Set());
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, [userId, categoryFilter]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId,
        limit: '20',
        ...(categoryFilter !== 'all' && { category: categoryFilter })
      });
      
      const response = await fetch(`/api/plugin-recommendations?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
        setUserProfile(data.metadata.userProfile);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (pluginId: string, action: string) => {
    try {
      const response = await fetch('/api/plugin-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          pluginId,
          action
        }),
      });

      if (response.ok) {
        // Update local state based on action
        switch (action) {
          case 'like':
            setLikedPlugins(prev => new Set(prev).add(pluginId));
            break;
          case 'dismiss':
            setDismissedPlugins(prev => new Set(prev).add(pluginId));
            break;
        }
        
        if (onFeedback) {
          onFeedback(pluginId, action);
        }
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTimeToValueIcon = (timeToValue: string) => {
    switch (timeToValue) {
      case 'immediate': return <Zap className="w-4 h-4 text-green-500" />;
      case 'days': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'weeks': return <Clock className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      'ci-cd': Target,
      'monitoring': TrendingUp,
      'quality': Award,
      'cost': Lightbulb,
      'security': CheckCircle,
      'default': Package
    };
    const Icon = icons[category] || icons.default;
    return <Icon className="w-5 h-5" />;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const filteredRecommendations = recommendations.filter(rec => {
    if (dismissedPlugins.has(rec.pluginId)) return false;
    if (difficultyFilter !== 'all' && rec.difficulty !== difficultyFilter) return false;
    return true;
  });

  const categories = ['all', ...Array.from(new Set(recommendations.map(r => r.category)))];

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <Sparkles className="w-16 h-16 animate-pulse text-purple-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Generating Recommendations
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Analyzing your preferences and usage patterns...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Sparkles className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Plugin Recommendations</h1>
              <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                AI-Powered
              </span>
            </div>
            <p className="text-xl text-purple-100">
              Personalized plugin suggestions based on your role and usage patterns
            </p>
          </div>
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 flex items-center transition-colors"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        {/* User Profile Summary */}
        {userProfile && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-6 h-6 mr-3" />
              <div>
                <div className="text-lg font-semibold">
                  {userProfile.role} • {userProfile.experience} level
                </div>
                <div className="text-sm text-purple-100">
                  Interests: {userProfile.interests.join(', ')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex gap-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : 
                   cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
            
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'cards' 
                  ? 'bg-purple-600 text-white' 
                  : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'list' 
                  ? 'bg-purple-600 text-white' 
                  : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              List
            </button>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredRecommendations.length} personalized recommendations
        </div>
      </div>

      {/* Recommendations Grid/List */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecommendations.map((rec) => (
            <motion.div
              key={rec.pluginId}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  {getCategoryIcon(rec.category)}
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {rec.pluginName}
                    </h3>
                    <div className="flex items-center mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(rec.difficulty)}`}>
                        {rec.difficulty}
                      </span>
                      <div className="flex items-center ml-2">
                        {getTimeToValueIcon(rec.timeToValue)}
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                          {rec.timeToValue}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600">
                    {rec.score}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    match
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm line-clamp-2">
                {rec.description}
              </p>

              {/* Primary Reason */}
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-start">
                  <Lightbulb className="w-4 h-4 text-purple-600 mr-2 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                      Why we recommend this
                    </div>
                    <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      {rec.reasoning.primary}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {rec.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
                {rec.tags.length > 3 && (
                  <span className="px-2 py-1 text-gray-500 dark:text-gray-400 text-xs">
                    +{rec.tags.length - 3}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                <span className="flex items-center">
                  <Download className="w-3 h-3 mr-1" />
                  {formatNumber(rec.metadata.downloads)}
                </span>
                <span className="flex items-center">
                  <Star className="w-3 h-3 mr-1 text-yellow-500" />
                  {rec.metadata.stars}
                </span>
                <span className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {rec.similarUsers.adoptionRate}% adopt
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleFeedback(rec.pluginId, 'install');
                    if (onPluginSelect) onPluginSelect(rec.pluginId);
                  }}
                  className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center justify-center"
                >
                  <Package className="w-4 h-4 mr-1" />
                  Install
                </button>
                <button
                  onClick={() => setExpandedPlugin(rec.pluginId)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFeedback(rec.pluginId, likedPlugins.has(rec.pluginId) ? 'dislike' : 'like')}
                  className={`px-3 py-2 border rounded-lg text-sm ${
                    likedPlugins.has(rec.pluginId)
                      ? 'border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${likedPlugins.has(rec.pluginId) ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => handleFeedback(rec.pluginId, 'dismiss')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecommendations.map((rec) => (
            <div
              key={rec.pluginId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  {getCategoryIcon(rec.category)}
                  <div className="ml-4 flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {rec.pluginName}
                      </h3>
                      <span className="ml-3 text-2xl font-bold text-purple-600">
                        {rec.score}%
                      </span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(rec.difficulty)}`}>
                        {rec.difficulty}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      {rec.description}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center">
                        <Download className="w-4 h-4 mr-1" />
                        {formatNumber(rec.metadata.downloads)} downloads
                      </span>
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {rec.similarUsers.adoptionRate}% adoption
                      </span>
                      <span className="flex items-center">
                        {getTimeToValueIcon(rec.timeToValue)}
                        <span className="ml-1">{rec.timeToValue} to value</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-6">
                  <button
                    onClick={() => {
                      handleFeedback(rec.pluginId, 'install');
                      if (onPluginSelect) onPluginSelect(rec.pluginId);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Install
                  </button>
                  <button
                    onClick={() => setExpandedPlugin(rec.pluginId)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plugin Detail Modal */}
      {expandedPlugin && (
        <PluginDetailModal
          plugin={filteredRecommendations.find(r => r.pluginId === expandedPlugin)}
          onClose={() => setExpandedPlugin(null)}
          onInstall={() => {
            handleFeedback(expandedPlugin, 'install');
            if (onPluginSelect) onPluginSelect(expandedPlugin);
            setExpandedPlugin(null);
          }}
          onFeedback={(action) => handleFeedback(expandedPlugin, action)}
        />
      )}

      {/* Empty State */}
      {filteredRecommendations.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No recommendations found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try adjusting your filters or check back later for new suggestions
          </p>
          <button
            onClick={() => {
              setCategoryFilter('all');
              setDifficultyFilter('all');
              fetchRecommendations();
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}

// Plugin Detail Modal Component
const PluginDetailModal = ({ plugin, onClose, onInstall, onFeedback }: any) => {
  if (!plugin) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {plugin.pluginName}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {plugin.score}% compatibility match • {plugin.confidence}% confidence
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Description</h3>
              <p className="text-gray-600 dark:text-gray-400">{plugin.description}</p>
            </div>

            {/* Reasoning */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Why We Recommend This</h3>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-purple-900 dark:text-purple-100 mb-3">{plugin.reasoning.primary}</p>
                <div className="space-y-2">
                  {plugin.reasoning.factors.map((factor: string, index: number) => (
                    <div key={index} className="flex items-center text-sm text-purple-700 dark:text-purple-300">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {factor}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Benefits</h3>
              <ul className="space-y-1">
                {plugin.reasoning.benefits.map((benefit: string, index: number) => (
                  <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <ArrowRight className="w-4 h-4 mr-2 text-green-500" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Prerequisites */}
            {plugin.prerequisites.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Prerequisites</h3>
                <div className="space-y-1">
                  {plugin.prerequisites.map((prereq: string, index: number) => (
                    <div key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
                      {prereq}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Community Stats */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Community</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {plugin.similarUsers.count}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Similar users</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {plugin.similarUsers.satisfaction}/5
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Satisfaction</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onInstall}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center"
          >
            <Package className="w-4 h-4 mr-2" />
            Install Plugin
          </button>
          <button
            onClick={() => onFeedback('interested')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Heart className="w-4 h-4 mr-2 inline" />
            Interested
          </button>
          <button
            onClick={() => onFeedback('dismiss')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Not Interested
          </button>
        </div>
      </motion.div>
    </div>
  );
};