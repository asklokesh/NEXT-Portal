'use client';

import React from 'react';
import {
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
  Info,
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
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface MarketplacePluginCardProps {
  plugin: BackstagePlugin;
  viewMode: 'grid' | 'list';
  isInstalling?: boolean;
  isSelected?: boolean;
  showSelectionCheckbox?: boolean;
  onSelect: () => void;
  onToggleSelection: () => void;
  onInstall: () => void;
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

const CATEGORY_COLORS: Record<string, string> = {
  'ci-cd': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  'monitoring': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'infrastructure': 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
  'security': 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  'analytics': 'text-pink-600 bg-pink-50 dark:bg-pink-900/20',
  'documentation': 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20',
  'cost-management': 'text-teal-600 bg-teal-50 dark:bg-teal-900/20',
  'development-tools': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  'default': 'text-gray-600 bg-gray-50 dark:bg-gray-800/20',
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

export function MarketplacePluginCard({
  plugin,
  viewMode,
  isInstalling = false,
  isSelected = false,
  showSelectionCheckbox = false,
  onSelect,
  onToggleSelection,
  onInstall,
}: MarketplacePluginCardProps) {
  const Icon = CATEGORY_ICONS[plugin.category] || CATEGORY_ICONS.default;
  const categoryColor = CATEGORY_COLORS[plugin.category] || CATEGORY_COLORS.default;
  
  const isRecentlyUpdated = plugin.lastUpdated && 
    Date.now() - new Date(plugin.lastUpdated).getTime() < 30 * 24 * 60 * 60 * 1000;

  const compatibilityScore = plugin.compatibility ? 
    Object.keys(plugin.compatibility).filter(k => plugin.compatibility?.[k]).length / 3 * 100 : 85;

  if (viewMode === 'list') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group">
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Selection Checkbox */}
            {showSelectionCheckbox && (
              <div className="flex items-center pt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onToggleSelection}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}

            {/* Plugin Icon */}
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${categoryColor}`}>
              <Icon className="w-6 h-6" />
            </div>

            {/* Plugin Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 
                      className="text-lg font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      onClick={onSelect}
                    >
                      {plugin.title}
                    </h3>
                    {plugin.installed && (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" title="Installed" />
                    )}
                    {plugin.official && (
                      <Award className="w-5 h-5 text-blue-500 flex-shrink-0" title="Official Plugin" />
                    )}
                    {plugin.featured && (
                      <Star className="w-5 h-5 text-yellow-500 flex-shrink-0" title="Featured" />
                    )}
                    {isRecentlyUpdated && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    v{plugin.version} • by {plugin.author}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                    {plugin.description}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => copyToClipboard(plugin.name)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Copy package name"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {plugin.repository && (
                    <a
                      href={plugin.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="View repository"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={onSelect}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="View details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Metadata and Stats */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {formatNumber(plugin.downloads || 0)} downloads
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {plugin.rating?.toFixed(1) || 'N/A'} rating
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getTimeAgo(plugin.lastUpdated)}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {plugin.category}
                </span>
                {compatibilityScore && (
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {compatibilityScore.toFixed(0)}% compatible
                  </span>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-3">
                {plugin.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
                {plugin.tags.length > 3 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5">
                    +{plugin.tags.length - 3} more
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {!plugin.installed ? (
                <button
                  onClick={onInstall}
                  disabled={isInstalling}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[100px]"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Install
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Installed
                  </span>
                  {plugin.configurable && (
                    <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <Settings className="w-4 h-4 mr-1.5" />
                      Configure
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 group relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-50/20 dark:to-blue-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Selection Checkbox */}
      {showSelectionCheckbox && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white"
          />
        </div>
      )}

      {/* Badges */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        {plugin.featured && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <Star className="w-3 h-3 mr-1" />
            Featured
          </span>
        )}
        {isRecentlyUpdated && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
            New
          </span>
        )}
      </div>

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${categoryColor} group-hover:scale-110 transition-transform duration-200`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors group-hover:translate-x-1 duration-200"
                onClick={onSelect}
              >
                {plugin.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                v{plugin.version} • {plugin.author}
              </p>
            </div>
          </div>
          
          {plugin.installed && (
            <CheckCircle className="w-5 h-5 text-green-500" title="Installed" />
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3 group-hover:line-clamp-4 transition-all duration-200">
          {plugin.description}
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Downloads</span>
              <Download className="w-3 h-3 text-gray-400" />
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {formatNumber(plugin.downloads || 0)}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Rating</span>
              <Star className="w-3 h-3 text-gray-400" />
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {plugin.rating?.toFixed(1) || 'N/A'}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {getTimeAgo(plugin.lastUpdated)}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {plugin.category}
          </span>
          {plugin.official && (
            <span className="flex items-center gap-1 text-blue-600">
              <Award className="w-3 h-3" />
              Official
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {plugin.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/20 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200"
            >
              {tag}
            </span>
          ))}
          {plugin.tags.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              +{plugin.tags.length - 3}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {!plugin.installed ? (
              <button
                onClick={onInstall}
                disabled={isInstalling}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-1.5" />
                    Install
                  </>
                )}
              </button>
            ) : (
              <>
                <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Installed
                </span>
                {plugin.configurable && (
                  <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200">
                    <Settings className="w-4 h-4 mr-1.5" />
                    Configure
                  </button>
                )}
              </>
            )}
            <button
              onClick={onSelect}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <Info className="w-4 h-4 mr-1.5" />
              Details
            </button>
          </div>
          
          {/* External Links */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => copyToClipboard(plugin.name)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Copy package name"
            >
              <Copy className="w-4 h-4" />
            </button>
            {plugin.repository && (
              <a
                href={plugin.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="View repository"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}