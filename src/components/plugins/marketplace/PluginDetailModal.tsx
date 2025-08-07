'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Star,
  Download,
  Shield,
  Package,
  GitBranch,
  Database,
  Code,
  Sparkles,
  Layers,
  Terminal,
  Globe,
  Zap,
  Settings,
  CheckCircle,
  Clock,
  Users,
  Heart,
  Award,
  Activity,
  ExternalLink,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Eye,
  Bookmark,
  Share2,
  Copy,
  Calendar,
  FileText,
  Image as ImageIcon,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  Info,
  ChevronRight,
  ChevronLeft,
  ThumbsUp,
  MessageCircle,
  Flag,
  Link,
  Hash,
  Tag,
  Server,
  Cpu,
  HardDrive,
  Network,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface PluginDetailModalProps {
  plugin: BackstagePlugin;
  onClose: () => void;
  onInstall: () => void;
  isInstalling?: boolean;
}

interface TabConfig {
  id: string;
  label: string;
  icon: any;
  content: React.ReactNode;
}

const CATEGORY_ICONS: Record<string, any> = {
  'ci-cd': GitBranch,
  'monitoring': Activity,
  'infrastructure': Database,
  'security': Shield,
  'analytics': Sparkles,
  'documentation': Code,
  'cost-management': Layers,
  'development-tools': Terminal,
  'default': Package,
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function getTimeAgo(dateString: string | undefined): string {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return '1 day ago';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard!');
}

export function PluginDetailModal({ plugin, onClose, onInstall, isInstalling = false }: PluginDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const Icon = CATEGORY_ICONS[plugin.category] || CATEGORY_ICONS.default;

  // Mock data for demo purposes - in real implementation, fetch from API
  const pluginDetails = useMemo(() => ({
    screenshots: [
      '/screenshots/plugin-dashboard.png',
      '/screenshots/plugin-config.png',
      '/screenshots/plugin-metrics.png',
    ],
    videos: [
      '/videos/plugin-demo.mp4',
    ],
    readme: `# ${plugin.title}

${plugin.description}

## Features

- Feature 1: Comprehensive monitoring and alerting
- Feature 2: Easy integration with existing tools  
- Feature 3: Real-time dashboard and metrics
- Feature 4: Configurable notifications

## Installation

This plugin can be installed through the NEXT Portal marketplace with one-click setup.

## Configuration

The plugin supports various configuration options:

- API endpoints and authentication
- Custom dashboards and widgets
- Notification preferences
- Integration settings

## Documentation

For complete documentation, visit the [official docs](${plugin.homepage || '#'}).

## Support

For issues and feature requests, please use the GitHub repository.`,
    versions: [
      { version: plugin.version, date: plugin.lastUpdated, changes: ['Latest version with bug fixes', 'Performance improvements', 'New dashboard features'] },
      { version: '0.17.2', date: '2024-01-10', changes: ['Security updates', 'API improvements'] },
      { version: '0.17.1', date: '2024-01-05', changes: ['Bug fixes', 'UI improvements'] },
    ],
    reviews: [
      { 
        user: 'developer1', 
        rating: 5, 
        comment: 'Excellent plugin! Easy to set up and works perfectly with our CI/CD pipeline.',
        date: '2024-01-15',
        helpful: 12,
        verified: true
      },
      { 
        user: 'devops_engineer', 
        rating: 4, 
        comment: 'Great functionality, but could use better documentation for advanced features.',
        date: '2024-01-12',
        helpful: 8,
        verified: true
      },
      { 
        user: 'platform_team', 
        rating: 5, 
        comment: 'This plugin has significantly improved our developer experience. Highly recommended!',
        date: '2024-01-10',
        helpful: 15,
        verified: true
      },
    ],
    dependencies: plugin.dependencies || [
      '@backstage/core-plugin-api',
      '@backstage/theme',
      'react',
      'react-dom',
    ],
    requirements: {
      backstageVersion: '>=1.18.0',
      nodeVersion: '>=18.0.0',
      npmVersion: '>=9.0.0',
      memory: '512MB',
      disk: '50MB',
    },
    permissions: [
      'catalog:read',
      'catalog:write',
      'scaffolder:read',
      'scaffolder:write',
    ],
    apiEndpoints: [
      '/api/catalog/entities',
      '/api/scaffolder/templates',
      '/api/auth/refresh',
    ],
    metrics: {
      installTime: '2-5 minutes',
      averageRating: 4.6,
      totalReviews: 127,
      weeklyDownloads: 15420,
      monthlyDownloads: 58230,
      totalDownloads: plugin.downloads || 125000,
    }
  }), [plugin]);

  const tabs: TabConfig[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Info,
      content: (
        <div className="space-y-6">
          {/* Screenshots */}
          {pluginDetails.screenshots.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Screenshots</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {pluginDetails.screenshots.map((screenshot, index) => (
                  <div 
                    key={index}
                    className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
                        {index + 1}/{pluginDetails.screenshots.length}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Description</h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-300">
                {showFullDescription 
                  ? plugin.description + ' This plugin provides comprehensive functionality for modern developer workflows, including advanced monitoring capabilities, seamless integrations, and intuitive user interfaces designed to enhance productivity and reduce complexity.'
                  : plugin.description
                }
              </p>
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
              >
                {showFullDescription ? 'Show less' : 'Show more'}
              </button>
            </div>
          </div>

          {/* Key Features */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Key Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: Activity, text: 'Real-time monitoring and alerts' },
                { icon: Settings, text: 'Configurable dashboards' },
                { icon: Shield, text: 'Enterprise security compliance' },
                { icon: GitBranch, text: 'CI/CD pipeline integration' },
                { icon: Database, text: 'Multiple data source support' },
                { icon: Users, text: 'Team collaboration features' },
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <feature.icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Plugin Metrics</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <Download className="w-6 h-6 text-blue-600 mb-2" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatNumber(pluginDetails.metrics.totalDownloads)}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Total Downloads</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600 mb-2" />
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {pluginDetails.metrics.averageRating}
                </div>
                <div className="text-sm text-yellow-600 dark:text-yellow-400">Average Rating</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatNumber(pluginDetails.metrics.weeklyDownloads)}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Weekly Downloads</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <MessageCircle className="w-6 h-6 text-purple-600 mb-2" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {pluginDetails.metrics.totalReviews}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">Reviews</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'installation',
      label: 'Installation',
      icon: Download,
      content: (
        <div className="space-y-6">
          {/* Requirements */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(pluginDetails.requirements).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Dependencies</h3>
            <div className="space-y-2">
              {pluginDetails.dependencies.map((dep, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{dep}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">Compatible</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Installation Steps */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Installation Guide</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">One-Click Installation</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Click the install button above to automatically download and configure the plugin.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">Automatic Configuration</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    The system will automatically configure dependencies and register routes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-1">Ready to Use</h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    The plugin will be available in your navigation menu and ready to use immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Manual Installation */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Manual Installation</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">NPM Package</span>
                <button
                  onClick={() => copyToClipboard(`npm install ${plugin.name}`)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  <Copy className="w-4 h-4 inline mr-1" />
                  Copy
                </button>
              </div>
              <code className="text-green-400 text-sm font-mono">
                npm install {plugin.name}
              </code>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'documentation',
      label: 'Documentation',
      icon: FileText,
      content: (
        <div className="space-y-6">
          <div className="prose dark:prose-invert max-w-none">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
              <div className="whitespace-pre-wrap text-sm font-mono text-gray-700 dark:text-gray-300">
                {pluginDetails.readme}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <a
              href={plugin.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Official Documentation
            </a>
            <a
              href={plugin.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <GitBranch className="w-4 h-4 mr-2" />
              GitHub Repository
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'reviews',
      label: 'Reviews',
      icon: Star,
      content: (
        <div className="space-y-6">
          {/* Rating Summary */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {pluginDetails.metrics.averageRating}
                </div>
                <div className="flex items-center justify-center gap-1 my-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.floor(pluginDetails.metrics.averageRating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {pluginDetails.metrics.totalReviews} reviews
                </div>
              </div>
              
              <div className="flex-1">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center gap-2 mb-1">
                    <span className="text-sm w-4">{rating}</span>
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{
                          width: `${
                            rating === 5 ? 75 : rating === 4 ? 15 : rating === 3 ? 5 : rating === 2 ? 3 : 2
                          }%`
                        }}
                      />
                    </div>
                    <span className="text-sm w-8 text-gray-600 dark:text-gray-400">
                      {rating === 5 ? 75 : rating === 4 ? 15 : rating === 3 ? 5 : rating === 2 ? 3 : 2}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Individual Reviews */}
          <div className="space-y-4">
            {pluginDetails.reviews.map((review, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {review.user[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {review.user}
                        </span>
                        {review.verified && (
                          <CheckCircle className="w-4 h-4 text-green-500" title="Verified user" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= review.rating
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {getTimeAgo(review.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-700 dark:text-gray-300 mb-3">{review.comment}</p>
                
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300">
                    <ThumbsUp className="w-4 h-4" />
                    Helpful ({review.helpful})
                  </button>
                  <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300">
                    <Flag className="w-4 h-4" />
                    Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'versions',
      label: 'Versions',
      icon: Clock,
      content: (
        <div className="space-y-4">
          {pluginDetails.versions.map((version, index) => (
            <div key={version.version} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    v{version.version}
                  </span>
                  {index === 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                      Latest
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {getTimeAgo(version.date)}
                </span>
              </div>
              
              <div className="space-y-1">
                {version.changes.map((change, changeIndex) => (
                  <div key={changeIndex} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{change}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="relative flex h-full">
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 ml-auto max-w-4xl w-full">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
                  <Icon className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {plugin.title}
                    </h1>
                    {plugin.installed && (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                    {plugin.official && (
                      <Award className="w-6 h-6 text-blue-500" />
                    )}
                    {plugin.featured && (
                      <Star className="w-6 h-6 text-yellow-500" />
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    v{plugin.version} • by {plugin.author} • {getTimeAgo(plugin.lastUpdated)}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      {formatNumber(plugin.downloads || 0)} downloads
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      {plugin.rating?.toFixed(1) || 'N/A'} rating
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      {plugin.category}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {!plugin.installed ? (
                  <button
                    onClick={onInstall}
                    disabled={isInstalling}
                    className="inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Install Plugin
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Installed
                    </span>
                    {plugin.configurable && (
                      <button className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </button>
                    )}
                  </div>
                )}
                
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tabs.find(tab => tab.id === activeTab)?.content}
          </div>
        </div>
      </div>
    </div>
  );
}