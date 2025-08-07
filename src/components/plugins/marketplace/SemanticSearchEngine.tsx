'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Brain,
  Sparkles,
  Filter,
  Target,
  Zap,
  TrendingUp,
  Star,
  Clock,
  Users,
  Tag,
  ArrowRight,
  X,
  Lightbulb,
  MessageCircle,
  Hash,
  Globe,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface SearchResult {
  plugin: BackstagePlugin;
  score: number;
  matchReasons: SearchMatchReason[];
  semanticScore: number;
  relevanceScore: number;
}

interface SearchMatchReason {
  type: 'title' | 'description' | 'tags' | 'category' | 'semantic' | 'functionality';
  field: string;
  matchedText: string;
  confidence: number;
}

interface SearchSuggestion {
  type: 'query' | 'category' | 'tag' | 'functionality';
  text: string;
  count: number;
  icon: any;
}

interface SemanticSearchProps {
  plugins: BackstagePlugin[];
  onResults: (results: SearchResult[]) => void;
  onSuggestionSelect?: (suggestion: string) => void;
}

// Semantic search functionality mapping
const FUNCTIONALITY_KEYWORDS = {
  'monitoring': ['monitor', 'observe', 'alert', 'metric', 'dashboard', 'health', 'status', 'uptime', 'sla'],
  'ci-cd': ['build', 'deploy', 'pipeline', 'automation', 'release', 'continuous', 'integration', 'delivery'],
  'security': ['auth', 'secure', 'permission', 'rbac', 'oauth', 'token', 'encrypt', 'vault', 'policy'],
  'documentation': ['docs', 'document', 'guide', 'readme', 'wiki', 'knowledge', 'help', 'tutorial'],
  'infrastructure': ['infra', 'cloud', 'server', 'container', 'kubernetes', 'docker', 'terraform', 'provision'],
  'analytics': ['analyze', 'report', 'insight', 'data', 'visualization', 'chart', 'graph', 'business intelligence'],
  'cost-management': ['cost', 'budget', 'billing', 'expense', 'optimization', 'spend', 'finance', 'savings'],
  'development-tools': ['dev', 'code', 'debug', 'test', 'lint', 'format', 'ide', 'editor', 'tool'],
};

// Intent detection patterns
const INTENT_PATTERNS = {
  'find-similar': ['similar to', 'like', 'alternatives to', 'comparable', 'equivalent'],
  'find-category': ['for', 'related to', 'about', 'category', 'type of'],
  'find-functionality': ['help with', 'used for', 'can do', 'provides', 'enables'],
  'find-integration': ['works with', 'integrates with', 'connects to', 'compatible with'],
  'find-popular': ['popular', 'trending', 'most used', 'recommended', 'best'],
  'find-recent': ['new', 'recent', 'latest', 'updated', 'fresh'],
};

class SemanticSearchEngine {
  private functionalities: Map<string, string[]> = new Map();
  private pluginEmbeddings: Map<string, number[]> = new Map();

  constructor() {
    // Initialize functionality mappings
    Object.entries(FUNCTIONALITY_KEYWORDS).forEach(([category, keywords]) => {
      this.functionalities.set(category, keywords);
    });
  }

  // Simple semantic similarity using cosine similarity of keyword vectors
  private calculateSemanticSimilarity(query: string, plugin: BackstagePlugin): number {
    const queryWords = this.tokenize(query.toLowerCase());
    const pluginWords = this.tokenize(
      `${plugin.title} ${plugin.description} ${plugin.tags.join(' ')} ${plugin.category}`.toLowerCase()
    );

    // Create keyword vectors
    const allWords = [...new Set([...queryWords, ...pluginWords])];
    const queryVector = allWords.map(word => queryWords.filter(w => w === word).length);
    const pluginVector = allWords.map(word => pluginWords.filter(w => w === word).length);

    // Calculate cosine similarity
    const dotProduct = queryVector.reduce((sum, val, i) => sum + val * pluginVector[i], 0);
    const queryMagnitude = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
    const pluginMagnitude = Math.sqrt(pluginVector.reduce((sum, val) => sum + val * val, 0));

    if (queryMagnitude === 0 || pluginMagnitude === 0) return 0;
    return dotProduct / (queryMagnitude * pluginMagnitude);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'for', 'with', 'this', 'that'].includes(word));
  }

  private detectIntent(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (patterns.some(pattern => lowerQuery.includes(pattern))) {
        return intent;
      }
    }
    
    return null;
  }

  private extractFunctionalityMatches(query: string, plugin: BackstagePlugin): SearchMatchReason[] {
    const matches: SearchMatchReason[] = [];
    const queryWords = this.tokenize(query.toLowerCase());
    
    for (const [category, keywords] of this.functionalities) {
      const matchingKeywords = keywords.filter(keyword => 
        queryWords.some(word => word.includes(keyword) || keyword.includes(word))
      );
      
      if (matchingKeywords.length > 0 && plugin.category === category) {
        matches.push({
          type: 'functionality',
          field: 'category',
          matchedText: matchingKeywords.join(', '),
          confidence: matchingKeywords.length / keywords.length,
        });
      }
    }
    
    return matches;
  }

  private calculateRelevanceScore(plugin: BackstagePlugin, query: string): number {
    let score = 0;
    
    // Popularity factors
    score += Math.min((plugin.downloads || 0) / 10000, 10); // Max 10 points for downloads
    score += (plugin.rating || 0) * 2; // Max 10 points for rating
    score += (plugin.stars || 0) / 100; // Stars contribution
    
    // Freshness factor
    if (plugin.lastUpdated) {
      const daysSinceUpdate = (Date.now() - new Date(plugin.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 5 - daysSinceUpdate / 30); // Fresh updates get bonus
    }
    
    // Official plugin bonus
    if (plugin.official) score += 5;
    if (plugin.featured) score += 3;
    
    return score;
  }

  public search(query: string, plugins: BackstagePlugin[]): SearchResult[] {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    plugins.forEach(plugin => {
      const matchReasons: SearchMatchReason[] = [];
      let totalScore = 0;

      // Exact matches (highest priority)
      if (plugin.title.toLowerCase().includes(queryLower)) {
        matchReasons.push({
          type: 'title',
          field: 'title',
          matchedText: plugin.title,
          confidence: queryLower.length / plugin.title.length,
        });
        totalScore += 100 * (queryLower.length / plugin.title.length);
      }

      // Description matches
      if (plugin.description.toLowerCase().includes(queryLower)) {
        matchReasons.push({
          type: 'description',
          field: 'description',
          matchedText: query,
          confidence: queryLower.length / plugin.description.length,
        });
        totalScore += 50 * (queryLower.length / plugin.description.length);
      }

      // Tag matches
      const matchingTags = plugin.tags.filter(tag => 
        tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())
      );
      if (matchingTags.length > 0) {
        matchReasons.push({
          type: 'tags',
          field: 'tags',
          matchedText: matchingTags.join(', '),
          confidence: matchingTags.length / plugin.tags.length,
        });
        totalScore += 30 * matchingTags.length;
      }

      // Category matches
      if (plugin.category.toLowerCase().includes(queryLower)) {
        matchReasons.push({
          type: 'category',
          field: 'category',
          matchedText: plugin.category,
          confidence: 1,
        });
        totalScore += 40;
      }

      // Functionality matches
      const functionalityMatches = this.extractFunctionalityMatches(query, plugin);
      matchReasons.push(...functionalityMatches);
      totalScore += functionalityMatches.reduce((sum, match) => sum + match.confidence * 25, 0);

      // Semantic similarity
      const semanticScore = this.calculateSemanticSimilarity(query, plugin);
      if (semanticScore > 0.1) {
        matchReasons.push({
          type: 'semantic',
          field: 'semantic',
          matchedText: 'Semantic similarity',
          confidence: semanticScore,
        });
        totalScore += semanticScore * 20;
      }

      // Add relevance score
      const relevanceScore = this.calculateRelevanceScore(plugin, query);
      totalScore += relevanceScore;

      // Only include plugins with meaningful matches
      if (matchReasons.length > 0 && totalScore > 5) {
        results.push({
          plugin,
          score: totalScore,
          matchReasons,
          semanticScore,
          relevanceScore,
        });
      }
    });

    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Limit to top 50 results
  }

  public generateSuggestions(query: string, plugins: BackstagePlugin[]): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    
    if (!query.trim()) {
      // Popular categories
      const categories = [...new Set(plugins.map(p => p.category))];
      categories.forEach(category => {
        const count = plugins.filter(p => p.category === category).length;
        suggestions.push({
          type: 'category',
          text: category.replace('-', ' '),
          count,
          icon: Globe,
        });
      });
      
      return suggestions.slice(0, 6);
    }

    const queryLower = query.toLowerCase();

    // Query suggestions based on partial matches
    const queryWords = this.tokenize(queryLower);
    if (queryWords.length > 0) {
      const lastWord = queryWords[queryWords.length - 1];
      
      // Tag suggestions
      const matchingTags = [...new Set(plugins.flatMap(p => p.tags))]
        .filter(tag => tag.toLowerCase().includes(lastWord))
        .slice(0, 3);
        
      matchingTags.forEach(tag => {
        const count = plugins.filter(p => p.tags.includes(tag)).length;
        suggestions.push({
          type: 'tag',
          text: tag,
          count,
          icon: Hash,
        });
      });

      // Functionality suggestions
      Object.entries(FUNCTIONALITY_KEYWORDS).forEach(([category, keywords]) => {
        const matchingKeywords = keywords.filter(keyword => 
          keyword.includes(lastWord) || lastWord.includes(keyword)
        );
        
        if (matchingKeywords.length > 0) {
          const count = plugins.filter(p => p.category === category).length;
          suggestions.push({
            type: 'functionality',
            text: `${category} plugins`,
            count,
            icon: Target,
          });
        }
      });
    }

    return suggestions.slice(0, 6);
  }
}

export function SemanticSearchEngine({ plugins, onResults, onSuggestionSelect }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const debouncedQuery = useDebounce(query, 300);
  const searchEngine = useMemo(() => new SemanticSearchEngine(), []);

  // Perform search
  useEffect(() => {
    if (debouncedQuery.trim()) {
      const results = searchEngine.search(debouncedQuery, plugins);
      onResults(results);
      
      // Add to search history
      if (!searchHistory.includes(debouncedQuery)) {
        setSearchHistory(prev => [debouncedQuery, ...prev.slice(0, 4)]);
      }
    } else {
      onResults([]);
    }
  }, [debouncedQuery, plugins, searchEngine, onResults]);

  // Generate suggestions
  useEffect(() => {
    const newSuggestions = searchEngine.generateSuggestions(query, plugins);
    setSuggestions(newSuggestions);
  }, [query, plugins, searchEngine]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setShowSuggestions(true);
    setSelectedSuggestion(-1);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    onSuggestionSelect?.(suggestion.text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestion >= 0) {
          handleSuggestionSelect(suggestions[selectedSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        break;
    }
  };

  const clearQuery = () => {
    setQuery('');
    setShowSuggestions(false);
    onResults([]);
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <Brain className="w-5 h-5 text-purple-500" />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Describe what you're looking for... (e.g., 'monitoring dashboard with alerts')"
          className="w-full pl-10 pr-12 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
        />

        {query && (
          <button
            onClick={clearQuery}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* AI Search Indicator */}
      {debouncedQuery && (
        <div className="absolute left-3 -bottom-6 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
          <Sparkles className="w-3 h-3" />
          <span>AI-powered semantic search active</span>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Search History */}
          {!query && searchHistory.length > 0 && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Recent searches</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleQueryChange(item)}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => {
              const Icon = suggestion.icon;
              const isSelected = index === selectedSuggestion;
              
              return (
                <button
                  key={`${suggestion.type}-${suggestion.text}`}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {suggestion.text}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {suggestion.count} plugin{suggestion.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Search Tips */}
          {!query && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <div className="font-medium mb-1">Search tips:</div>
                  <ul className="space-y-0.5">
                    <li>• Try "monitoring with alerts" or "CI/CD pipeline automation"</li>
                    <li>• Use "similar to [plugin]" to find alternatives</li>
                    <li>• Search by functionality: "helps with authentication"</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SearchResultHighlight({ result }: { result: SearchResult }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
          Match Score: {Math.round(result.score)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {result.matchReasons.length} match{result.matchReasons.length !== 1 ? 'es' : ''}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {result.matchReasons.slice(0, 3).map((reason, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
            title={`${reason.type}: ${reason.matchedText} (${Math.round(reason.confidence * 100)}% confidence)`}
          >
            {reason.type === 'semantic' && <Brain className="w-3 h-3 mr-1" />}
            {reason.type === 'functionality' && <Target className="w-3 h-3 mr-1" />}
            {reason.type === 'title' && <MessageCircle className="w-3 h-3 mr-1" />}
            {reason.type === 'tags' && <Hash className="w-3 h-3 mr-1" />}
            {reason.type}
          </span>
        ))}
        {result.matchReasons.length > 3 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5">
            +{result.matchReasons.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
}