'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Settings, Zap, Shield, Star, Download,
  ExternalLink, CheckCircle, Clock, TrendingUp, Filter,
  MoreVertical, Grid, List, Package, Users, BookOpen,
  Activity, AlertTriangle, GitBranch, Globe, Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Spotify Portal Plugin Categories
enum PluginCategory {
  SPOTIFY_PREMIUM = 'spotify-premium',
  OPEN_SOURCE = 'open-source', 
  INSTALLED = 'installed',
  ALL = 'all'
}

interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: PluginCategory;
  version: string;
  status: 'active' | 'inactive' | 'installing' | 'available';
  qualityScore?: number;
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  downloads: number;
  stars: number;
  isInstalled: boolean;
  isPremium: boolean;
  isSpotifyPremium: boolean;
  maintainer: string;
  tags: string[];
  icon?: string;
  lastUpdated: string;
  homepage?: string;
  documentation?: string;
}

// Spotify Portal Premium Plugins - exact replica
const spotifyPremiumPlugins: Plugin[] = [
  {
    id: 'soundcheck',
    name: 'soundcheck',
    displayName: 'Soundcheck',
    description: 'Tech health management and standards enforcement with quality scoring',
    category: PluginCategory.SPOTIFY_PREMIUM,
    version: '1.15.0',
    status: 'active',
    qualityScore: 98,
    qualityGrade: 'A',
    downloads: 50000,
    stars: 4900,
    isInstalled: true,
    isPremium: true,
    isSpotifyPremium: true,
    maintainer: 'Spotify',
    tags: ['quality', 'health', 'standards', 'scoring'],
    lastUpdated: '2024-01-15',
    documentation: '/docs/soundcheck'
  },
  {
    id: 'aika',
    name: 'aika',
    displayName: 'AiKA',
    description: 'AI Knowledge Assistant for organizational documentation and Q&A',
    category: PluginCategory.SPOTIFY_PREMIUM,
    version: '2.3.0',
    status: 'active',
    qualityScore: 95,
    qualityGrade: 'A',
    downloads: 25000,
    stars: 4800,
    isInstalled: true,
    isPremium: true,
    isSpotifyPremium: true,
    maintainer: 'Spotify',
    tags: ['ai', 'knowledge', 'assistant', 'documentation'],
    lastUpdated: '2024-01-14',
    documentation: '/docs/aika'
  },
  {
    id: 'skill-exchange',
    name: 'skill-exchange',
    displayName: 'Skill Exchange',
    description: 'Internal learning and growth marketplace',
    category: PluginCategory.SPOTIFY_PREMIUM,
    version: '1.8.0',
    status: 'active',
    qualityScore: 92,
    qualityGrade: 'A',
    downloads: 15000,
    stars: 4600,
    isInstalled: true,
    isPremium: true,
    isSpotifyPremium: true,
    maintainer: 'Spotify',
    tags: ['learning', 'skills', 'marketplace', 'growth'],
    lastUpdated: '2024-01-13',
    documentation: '/docs/skill-exchange'
  },
  {
    id: 'insights',
    name: 'insights',
    displayName: 'Insights',
    description: 'Usage analytics and Portal adoption tracking',
    category: PluginCategory.SPOTIFY_PREMIUM,
    version: '1.12.0',
    status: 'active',
    qualityScore: 94,
    qualityGrade: 'A',
    downloads: 40000,
    stars: 4700,
    isInstalled: true,
    isPremium: true,
    isSpotifyPremium: true,
    maintainer: 'Spotify',
    tags: ['analytics', 'insights', 'adoption', 'metrics'],
    lastUpdated: '2024-01-12',
    documentation: '/docs/insights'
  },
  {
    id: 'rbac',
    name: 'rbac',
    displayName: 'RBAC',
    description: 'Role-Based Access Control with no-code policy management',
    category: PluginCategory.SPOTIFY_PREMIUM,
    version: '1.6.0',
    status: 'active',
    qualityScore: 96,
    qualityGrade: 'A',
    downloads: 35000,
    stars: 4850,
    isInstalled: true,
    isPremium: true,
    isSpotifyPremium: true,
    maintainer: 'Spotify',
    tags: ['security', 'rbac', 'permissions', 'access-control'],
    lastUpdated: '2024-01-11',
    documentation: '/docs/rbac'
  }
];

// Open source plugins
const openSourcePlugins: Plugin[] = [
  {
    id: 'github-actions',
    name: 'github-actions',
    displayName: 'GitHub Actions',
    description: 'GitHub Actions CI/CD integration',
    category: PluginCategory.OPEN_SOURCE,
    version: '0.6.9',
    status: 'active',
    qualityGrade: 'B',
    downloads: 125000,
    stars: 3200,
    isInstalled: true,
    isPremium: false,
    isSpotifyPremium: false,
    maintainer: 'Backstage Community',
    tags: ['github', 'cicd', 'actions'],
    lastUpdated: '2024-01-10',
    homepage: 'https://github.com/backstage/backstage'
  },
  {
    id: 'kubernetes',
    name: 'kubernetes',
    displayName: 'Kubernetes',
    description: 'Kubernetes clusters and workload management',
    category: PluginCategory.OPEN_SOURCE,
    version: '0.11.4',
    status: 'active',
    qualityGrade: 'A',
    downloads: 98000,
    stars: 2800,
    isInstalled: true,
    isPremium: false,
    isSpotifyPremium: false,
    maintainer: 'Backstage Community',
    tags: ['kubernetes', 'containers', 'orchestration'],
    lastUpdated: '2024-01-08',
    homepage: 'https://github.com/backstage/backstage'
  },
  {
    id: 'gitlab',
    name: 'gitlab',
    displayName: 'GitLab',
    description: 'GitLab integration for CI/CD and repository management',
    category: PluginCategory.OPEN_SOURCE,
    version: '0.5.3',
    status: 'available',
    qualityGrade: 'B',
    downloads: 67000,
    stars: 1900,
    isInstalled: false,
    isPremium: false,
    isSpotifyPremium: false,
    maintainer: 'Backstage Community',
    tags: ['gitlab', 'cicd', 'git'],
    lastUpdated: '2024-01-05',
    homepage: 'https://github.com/backstage/backstage'
  }
];

export default function PluginsPage() {
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory>(PluginCategory.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showInstalled, setShowInstalled] = useState(false);

  // Combine all plugins
  const allPlugins = [...spotifyPremiumPlugins, ...openSourcePlugins];

  // Filter plugins based on category and search
  const filteredPlugins = allPlugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === PluginCategory.ALL || plugin.category === selectedCategory;
    const matchesInstalled = !showInstalled || plugin.isInstalled;
    
    return matchesSearch && matchesCategory && matchesInstalled;
  });

  // Plugin stats
  const stats = {
    total: allPlugins.length,
    installed: allPlugins.filter(p => p.isInstalled).length,
    premium: allPlugins.filter(p => p.isSpotifyPremium).length,
    active: allPlugins.filter(p => p.status === 'active').length
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
              <h1 className="text-3xl font-bold spotify-gradient-text mb-2">
                Plugin Marketplace
              </h1>
              <p className="text-muted-foreground">
                Extend your Portal with plugins from Spotify and the community
              </p>
            </div>
            <button className="spotify-button-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Install Plugin
            </button>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Plugins', value: stats.total, icon: Package, color: 'primary' },
              { label: 'Installed', value: stats.installed, icon: CheckCircle, color: 'green' },
              { label: 'Spotify Premium', value: stats.premium, icon: Star, color: 'accent' },
              { label: 'Active', value: stats.active, icon: Activity, color: 'blue' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="spotify-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl bg-${stat.color}-500/10`}>
                    <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
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

        {/* Filters and Search */}
        <div className="spotify-card p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="spotify-input pl-10 w-full"
              />
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2">
              {[
                { key: PluginCategory.ALL, label: 'All' },
                { key: PluginCategory.SPOTIFY_PREMIUM, label: 'Spotify Premium' },
                { key: PluginCategory.OPEN_SOURCE, label: 'Open Source' },
                { key: PluginCategory.INSTALLED, label: 'Installed' }
              ].map(category => (
                <button
                  key={category.key}
                  onClick={() => {
                    if (category.key === PluginCategory.INSTALLED) {
                      setShowInstalled(!showInstalled);
                      setSelectedCategory(PluginCategory.ALL);
                    } else {
                      setSelectedCategory(category.key);
                      setShowInstalled(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    (selectedCategory === category.key) || (category.key === PluginCategory.INSTALLED && showInstalled)
                      ? 'spotify-tab-active'
                      : 'spotify-tab-inactive'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Spotify Premium Section */}
        {(selectedCategory === PluginCategory.ALL || selectedCategory === PluginCategory.SPOTIFY_PREMIUM) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Spotify Premium</h2>
              </div>
              <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                Premium
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spotifyPremiumPlugins.map((plugin, index) => (
                <motion.div
                  key={plugin.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="spotify-plugin-card group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg">
                        {plugin.displayName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{plugin.displayName}</h3>
                        <p className="text-sm text-muted-foreground">by {plugin.maintainer}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plugin.isInstalled && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <MoreVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  <p className="text-muted-foreground mb-4 line-clamp-2">
                    {plugin.description}
                  </p>

                  <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      {plugin.stars.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      {plugin.downloads.toLocaleString()}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-semibold spotify-quality-score-${plugin.qualityGrade.toLowerCase()}`}>
                      {plugin.qualityGrade}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {plugin.isInstalled ? (
                      <button className="flex-1 spotify-button-secondary px-4 py-2 rounded-lg text-sm font-medium">
                        Configure
                      </button>
                    ) : (
                      <button className="flex-1 spotify-button-primary px-4 py-2 rounded-lg text-sm font-medium">
                        Install
                      </button>
                    )}
                    {plugin.documentation && (
                      <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        <BookOpen className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Open Source Section */}
        {(selectedCategory === PluginCategory.ALL || selectedCategory === PluginCategory.OPEN_SOURCE) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-6">
              <Package className="h-6 w-6 text-muted-foreground" />
              <h2 className="text-2xl font-bold text-foreground">Open Source</h2>
              <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-medium">
                Community
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openSourcePlugins.map((plugin, index) => (
                <motion.div
                  key={plugin.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="spotify-card p-6 hover:spotify-card-hover"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground font-bold text-lg">
                        {plugin.displayName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{plugin.displayName}</h3>
                        <p className="text-sm text-muted-foreground">by {plugin.maintainer}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plugin.isInstalled && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <MoreVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  <p className="text-muted-foreground mb-4 line-clamp-2">
                    {plugin.description}
                  </p>

                  <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      {plugin.stars.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      {plugin.downloads.toLocaleString()}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-semibold spotify-quality-score-${plugin.qualityGrade.toLowerCase()}`}>
                      {plugin.qualityGrade}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {plugin.isInstalled ? (
                      <button className="flex-1 bg-muted text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
                        Configure
                      </button>
                    ) : (
                      <button 
                        onClick={() => toast.success(`Installing ${plugin.displayName}...`)}
                        className="flex-1 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
                      >
                        Install
                      </button>
                    )}
                    {plugin.homepage && (
                      <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {filteredPlugins.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No plugins found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or browse different categories
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}