'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Mic,
  MicOff,
  Sparkles,
  Filter,
  Sort,
  Loader2,
  AlertCircle,
  TrendingUp,
  Brain,
  MessageSquare,
  Star,
  Download,
  Settings,
  ChevronRight,
  X,
  Zap,
  RefreshCw,
  Target,
  Globe,
  Code,
  Database,
  Shield,
  GitBranch,
  Eye,
  ThumbsUp,
  BookOpen,
  Users,
  Award
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  author: string;
  downloads: number;
  stars: number;
  rating?: number;
  reviewCount?: number;
  installed: boolean;
  enabled: boolean;
  searchScore?: number;
  semanticScore?: number;
  recommendationScore?: number;
  recommendationReason?: string;
  lastUpdated: string;
  npm: string;
  homepage?: string;
  repository?: string;
}

interface SearchIntent {
  intent: 'search' | 'recommend' | 'compare' | 'install' | 'configure';
  entities: string[];
  category?: string;
  confidence: number;
}

interface PluginAISearchProps {
  onPluginSelect?: (plugin: SearchResult) => void;
  onInstall?: (plugin: SearchResult) => void;
  initialQuery?: string;
  mode?: 'embedded' | 'fullscreen';
  userId?: string;
}

export function PluginAISearch({ 
  onPluginSelect, 
  onInstall, 
  initialQuery = '', 
  mode = 'embedded',
  userId = 'anonymous'
}: PluginAISearchProps) {
  const queryClient = useQueryClient();
  
  // State management
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<'search' | 'recommend' | 'trending'>('search');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [filters, setFilters] = useState({
    category: 'all',
    rating: 0,
    downloads: 0,
    verified: false,
    recentlyUpdated: false
  });
  const [sortBy, setSortBy] = useState<'relevance' | 'popularity' | 'rating' | 'recent'>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [userPreferences, setUserPreferences] = useState({
    categories: ['ci-cd', 'infrastructure'],
    technologies: ['kubernetes', 'docker', 'terraform']
  });

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const voiceRecognition = useRef<SpeechRecognition | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      voiceRecognition.current = new SpeechRecognition();
      voiceRecognition.current.continuous = false;
      voiceRecognition.current.interimResults = false;
      voiceRecognition.current.lang = 'en-US';

      voiceRecognition.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsVoiceActive(false);
        // Automatically search after voice input
        handleSearch(transcript);
      };

      voiceRecognition.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsVoiceActive(false);
        toast.error('Voice recognition failed. Please try again.');
      };

      voiceRecognition.current.onend = () => {
        setIsVoiceActive(false);
      };
    }

    return () => {
      if (voiceRecognition.current) {
        voiceRecognition.current.abort();
      }
    };
  }, []);

  // Auto-suggestions query
  const { data: suggestions } = useQuery({
    queryKey: ['plugin-suggestions', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const response = await fetch(
        `/api/plugin-ai-search?mode=suggest&q=${encodeURIComponent(query)}&userId=${userId}`
      );
      return response.ok ? (await response.json()).suggestions : [];
    },
    enabled: query.length >= 2 && showSuggestions,
    staleTime: 300000 // 5 minutes
  });

  // Main search query
  const { data: searchResults, isLoading, error, refetch } = useQuery({
    queryKey: ['plugin-ai-search', query, searchMode, filters, sortBy, userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        mode: searchMode,
        userId,
        limit: '20'
      });

      // Add filters
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.rating > 0) params.append('minRating', filters.rating.toString());
      if (filters.downloads > 0) params.append('minDownloads', filters.downloads.toString());
      if (filters.verified) params.append('verified', 'true');
      if (filters.recentlyUpdated) params.append('recent', 'true');
      
      params.append('sort', sortBy);

      const response = await fetch(`/api/plugin-ai-search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return await response.json();
    },
    enabled: query.length > 0 || searchMode !== 'search',
    staleTime: 60000 // 1 minute
  });

  // Trending plugins query
  const { data: trendingData } = useQuery({
    queryKey: ['plugin-collaboration-trending'],
    queryFn: async () => {
      const response = await fetch('/api/plugin-collaboration?type=analytics');
      return response.ok ? await response.json() : null;
    },
    staleTime: 300000 // 5 minutes
  });

  // Voice search mutation
  const voiceSearchMutation = useMutation({
    mutationFn: async (transcript: string) => {
      const response = await fetch('/api/plugin-ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'voice-search',
          transcript,
          userId
        })
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.processedQuery) {
        setQuery(data.processedQuery);
        handleSearch(data.processedQuery);
      }
    }
  });

  // Search feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async (feedback: {
      query: string;
      selectedPlugin?: string;
      rating: number;
      helpful: boolean;
    }) => {
      await fetch('/api/plugin-ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          userId,
          ...feedback
        })
      });
    }
  });

  // Debounced search function
  const debouncedSearch = useCallback((searchQuery: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      if (searchQuery !== query) {
        setQuery(searchQuery);
      }
    }, 300);
  }, [query]);

  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    // Add to search history
    setSearchHistory(prev => {
      const updated = [q, ...prev.filter(item => item !== q)].slice(0, 10);
      localStorage.setItem('plugin-search-history', JSON.stringify(updated));
      return updated;
    });

    setShowSuggestions(false);
    refetch();
  };

  const toggleVoiceSearch = () => {
    if (!voiceRecognition.current) {
      toast.error('Voice search not supported in this browser');
      return;
    }

    if (isVoiceActive) {
      voiceRecognition.current.stop();
      setIsVoiceActive(false);
    } else {
      try {
        voiceRecognition.current.start();
        setIsVoiceActive(true);
        toast.success('Listening... Speak your search query');
      } catch (error) {
        console.error('Voice recognition start failed:', error);
        toast.error('Failed to start voice recognition');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || !suggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestion >= 0) {
          setQuery(suggestions[selectedSuggestion]);
          handleSearch(suggestions[selectedSuggestion]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        break;
    }
  };

  const categories = [
    { id: 'all', name: 'All', icon: Globe },
    { id: 'ci-cd', name: 'CI/CD', icon: GitBranch },
    { id: 'monitoring', name: 'Monitoring', icon: Shield },
    { id: 'infrastructure', name: 'Infrastructure', icon: Database },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'analytics', name: 'Analytics', icon: TrendingUp },
    { id: 'documentation', name: 'Docs', icon: BookOpen }
  ];

  const renderSearchResults = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchMode === 'recommend' ? 'Generating recommendations...' : 'Searching plugins...'}
            </p>
            {searchMode === 'search' && query && (
              <p className="text-sm text-gray-500 mt-2">Using AI to understand: "{query}"</p>
            )}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Search failed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Search
            </button>
          </div>
        </div>
      );
    }

    const results = searchResults?.plugins || [];
    const intent = searchResults?.intent;

    if (results.length === 0) {
      return (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {query ? 'No plugins found' : 'Start your search'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {query 
              ? 'Try adjusting your search terms or filters' 
              : 'Search for plugins using natural language or specific terms'
            }
          </p>
          {searchHistory.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent searches:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {searchHistory.slice(0, 5).map((term, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setQuery(term);
                      handleSearch(term);
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Search Results Header */}
        {query && intent && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                AI Understanding
              </span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Intent: <span className="font-semibold">{intent.intent}</span>
              {intent.category && (
                <>
                  {' '} • Category: <span className="font-semibold">{intent.category}</span>
                </>
              )}
              {intent.entities.length > 0 && (
                <>
                  {' '} • Technologies: <span className="font-semibold">{intent.entities.join(', ')}</span>
                </>
              )}
              {' '} • Confidence: <span className="font-semibold">{Math.round(intent.confidence * 100)}%</span>
            </p>
          </div>
        )}

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {searchMode === 'recommend' ? 'Recommended for You' : 'Search Results'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found {results.length} plugins
              {searchResults?.processingTime && (
                <> in {searchResults.processingTime}ms</>
              )}
            </p>
          </div>
          
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <Filter className="w-4 h-4 mr-1" />
                Filters
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800"
              >
                <option value="relevance">Relevance</option>
                <option value="popularity">Popularity</option>
                <option value="rating">Rating</option>
                <option value="recent">Recently Updated</option>
              </select>
            </div>
          )}
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Rating
                  </label>
                  <select
                    value={filters.rating}
                    onChange={(e) => setFilters(f => ({ ...f, rating: parseInt(e.target.value) }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800"
                  >
                    <option value={0}>Any</option>
                    <option value={3}>3+ stars</option>
                    <option value={4}>4+ stars</option>
                    <option value={5}>5 stars</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Downloads
                  </label>
                  <select
                    value={filters.downloads}
                    onChange={(e) => setFilters(f => ({ ...f, downloads: parseInt(e.target.value) }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800"
                  >
                    <option value={0}>Any</option>
                    <option value={1000}>1K+</option>
                    <option value={10000}>10K+</option>
                    <option value={100000}>100K+</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.verified}
                      onChange={(e) => setFilters(f => ({ ...f, verified: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Verified</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.recentlyUpdated}
                      onChange={(e) => setFilters(f => ({ ...f, recentlyUpdated: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Recent</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Plugin Results Grid */}
        <div className="grid gap-6">
          {results.map((plugin: SearchResult, index) => (
            <motion.div
              key={plugin.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => onPluginSelect?.(plugin)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {plugin.title}
                    </h3>
                    {plugin.installed && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full">
                        <Zap className="w-3 h-3 mr-1" />
                        Installed
                      </span>
                    )}
                    {plugin.recommendationScore && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full">
                        <Target className="w-3 h-3 mr-1" />
                        {Math.round(plugin.recommendationScore * 100)}% match
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    v{plugin.version} • by {plugin.author}
                  </p>
                  
                  <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-2">
                    {plugin.description}
                  </p>
                  
                  {plugin.recommendationReason && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                            Why we recommend this
                          </p>
                          <p className="text-sm text-purple-600 dark:text-purple-400">
                            {plugin.recommendationReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {plugin.downloads && (
                      <span className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        {plugin.downloads.toLocaleString()}
                      </span>
                    )}
                    {plugin.stars && (
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        {plugin.stars.toLocaleString()}
                      </span>
                    )}
                    {plugin.rating && (
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        {plugin.rating.toFixed(1)} ({plugin.reviewCount || 0} reviews)
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {plugin.category}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {plugin.tags.slice(0, 6).map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                    {plugin.tags.length > 6 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{plugin.tags.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 ml-4">
                  {!plugin.installed ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInstall?.(plugin);
                      }}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Install
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle configuration
                      }}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPluginSelect?.(plugin);
                    }}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                </div>
              </div>
              
              {/* Search Scoring Debug Info (for development) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2 mt-4 font-mono">
                  {plugin.searchScore !== undefined && (
                    <span>Search: {plugin.searchScore.toFixed(3)} </span>
                  )}
                  {plugin.semanticScore !== undefined && (
                    <span>Semantic: {plugin.semanticScore.toFixed(3)} </span>
                  )}
                  {plugin.recommendationScore !== undefined && (
                    <span>Recommendation: {plugin.recommendationScore.toFixed(3)}</span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Similar Plugins */}
        {searchResults?.similarPlugins && searchResults.similarPlugins.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Similar Plugins You Might Like
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.similarPlugins.map((plugin: SearchResult) => (
                <div
                  key={plugin.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                  onClick={() => onPluginSelect?.(plugin)}
                >
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {plugin.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                    {plugin.description}
                  </p>
                  {plugin.similarityScore && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Target className="w-3 h-3" />
                      {Math.round(plugin.similarityScore * 100)}% similar
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`plugin-ai-search ${mode === 'fullscreen' ? 'h-screen' : ''}`}>
      {/* Search Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-lg">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI-Powered Plugin Search</h1>
            <p className="text-blue-100">
              Find plugins using natural language, get smart recommendations, and discover what you need
            </p>
          </div>
        </div>
        
        {/* Search Modes */}
        <div className="flex gap-2 mb-4">
          {(['search', 'recommend', 'trending'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setSearchMode(mode);
                if (mode === 'recommend') setQuery('');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchMode === mode
                  ? 'bg-white text-blue-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {mode === 'search' && <Search className="w-4 h-4 inline mr-2" />}
              {mode === 'recommend' && <Sparkles className="w-4 h-4 inline mr-2" />}
              {mode === 'trending' && <TrendingUp className="w-4 h-4 inline mr-2" />}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Search Input */}
        {searchMode === 'search' && (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ask me anything... 'Show me Kubernetes plugins', 'What's good for CI/CD?', 'I need monitoring tools'"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                  debouncedSearch(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-10 pr-20 py-4 rounded-lg text-gray-900 text-lg placeholder-gray-500 focus:ring-2 focus:ring-white focus:ring-opacity-50 border-0"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
                <button
                  onClick={toggleVoiceSearch}
                  className={`p-2 rounded-lg transition-colors ${
                    isVoiceActive
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={isVoiceActive ? 'Stop listening' : 'Voice search'}
                >
                  {isVoiceActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                {query && (
                  <button
                    onClick={() => {
                      setQuery('');
                      setShowSuggestions(false);
                    }}
                    className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Auto-suggestions */}
            <AnimatePresence>
              {showSuggestions && suggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto"
                >
                  {suggestions.map((suggestion: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(suggestion);
                        handleSearch(suggestion);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        index === selectedSuggestion ? 'bg-gray-50 dark:bg-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Search className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-gray-100">{suggestion}</span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-6">
        {searchMode === 'trending' ? (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Trending Plugins
            </h2>
            {trendingData?.trending && (
              <div className="grid gap-4">
                {trendingData.trending.map((plugin: any, index: number) => (
                  <div key={plugin.pluginId} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {plugin.pluginId}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <span>Score: {plugin.score}</span>
                          <span>Activity: {plugin.activity}</span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            Trending {plugin.trend}
                          </span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-400">
                        #{index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          renderSearchResults()
        )}
      </div>

      {/* Feedback */}
      {searchResults && searchResults.plugins.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Was this search helpful?
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => feedbackMutation.mutate({
                  query,
                  rating: 5,
                  helpful: true
                })}
                className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                title="Yes, helpful"
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <button
                onClick={() => feedbackMutation.mutate({
                  query,
                  rating: 2,
                  helpful: false
                })}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="No, not helpful"
              >
                <ThumbsUp className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}