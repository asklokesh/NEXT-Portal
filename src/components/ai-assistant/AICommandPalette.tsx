'use client';

/**
 * AI Command Palette (Cmd+K)
 * Quick access to AI assistant and portal actions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Sparkles, FileText, Box, Users, Settings, ArrowRight, Clock, Star, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  category: 'ai' | 'navigation' | 'action' | 'recent' | 'search';
  action: () => void;
  keywords?: string[];
}

interface AICommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAIQuery?: (query: string) => void;
  recentItems?: Array<{ title: string; url: string; type: string }>;
}

const defaultCommands: CommandItem[] = [
  {
    id: 'ai-ask',
    title: 'Ask Portal AI',
    description: 'Get help with anything in the portal',
    icon: Sparkles,
    category: 'ai',
    action: () => {},
    keywords: ['ai', 'help', 'assistant', 'question'],
  },
  {
    id: 'nav-catalog',
    title: 'Go to Service Catalog',
    description: 'Browse all services and APIs',
    icon: Box,
    category: 'navigation',
    action: () => window.location.href = '/catalog',
    keywords: ['services', 'apis', 'catalog', 'browse'],
  },
  {
    id: 'nav-templates',
    title: 'Go to Templates',
    description: 'Create new services from templates',
    icon: FileText,
    category: 'navigation',
    action: () => window.location.href = '/templates',
    keywords: ['create', 'new', 'scaffold', 'template'],
  },
  {
    id: 'nav-teams',
    title: 'Go to Teams',
    description: 'View team ownership and services',
    icon: Users,
    category: 'navigation',
    action: () => window.location.href = '/teams',
    keywords: ['teams', 'groups', 'ownership'],
  },
  {
    id: 'nav-settings',
    title: 'Go to Settings',
    description: 'Manage your preferences',
    icon: Settings,
    category: 'navigation',
    action: () => window.location.href = '/settings',
    keywords: ['settings', 'preferences', 'config'],
  },
];

export function AICommandPalette({
  isOpen,
  onClose,
  onAIQuery,
  recentItems = [],
}: AICommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAIMode, setIsAIMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCommands = defaultCommands.filter(cmd => {
    if (!query) return true;
    const searchText = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(searchText) ||
      cmd.description?.toLowerCase().includes(searchText) ||
      cmd.keywords?.some(k => k.includes(searchText))
    );
  });

  // Add recent items to commands
  const recentCommands: CommandItem[] = recentItems.slice(0, 5).map((item, i) => ({
    id: `recent-${i}`,
    title: item.title,
    description: item.type,
    icon: Clock,
    category: 'recent',
    action: () => window.location.href = item.url,
  }));

  const allCommands = query
    ? filteredCommands
    : [...recentCommands, ...defaultCommands];

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setIsAIMode(false);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (isAIMode && query.trim()) {
          handleAIQuery();
        } else if (allCommands[selectedIndex]) {
          const cmd = allCommands[selectedIndex];
          if (cmd.id === 'ai-ask') {
            setIsAIMode(true);
            setQuery('');
          } else {
            cmd.action();
            onClose();
          }
        }
        break;
      case 'Escape':
        if (isAIMode) {
          setIsAIMode(false);
          setQuery('');
        } else {
          onClose();
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (query.startsWith('/')) {
          // Handle slash commands
        }
        break;
    }
  }, [allCommands, selectedIndex, isAIMode, query, onClose]);

  const handleAIQuery = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      if (onAIQuery) {
        await onAIQuery(query);
      }
      onClose();
    } catch (error) {
      console.error('AI query failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            {isAIMode ? (
              <Sparkles className="h-5 w-5 text-purple-500" />
            ) : (
              <Search className="h-5 w-5 text-gray-400" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAIMode ? "Ask Portal AI anything..." : "Search commands, services, or ask AI..."}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
            />
            {isLoading && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs rounded">
              ESC
            </kbd>
          </div>

          {/* AI Mode Banner */}
          {isAIMode && (
            <div className="px-4 py-2 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <Sparkles className="h-4 w-4" />
                <span>AI Mode - Ask me anything about your services, APIs, or documentation</span>
              </div>
            </div>
          )}

          {/* Results */}
          {!isAIMode && (
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
              {allCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No commands found. Try asking Portal AI!
                </div>
              ) : (
                <>
                  {/* Group by category */}
                  {['ai', 'recent', 'navigation', 'action', 'search'].map(category => {
                    const categoryCommands = allCommands.filter(c => c.category === category);
                    if (categoryCommands.length === 0) return null;

                    const categoryLabels: Record<string, string> = {
                      ai: 'AI Assistant',
                      recent: 'Recent',
                      navigation: 'Navigation',
                      action: 'Actions',
                      search: 'Search Results',
                    };

                    return (
                      <div key={category}>
                        <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {categoryLabels[category]}
                        </div>
                        {categoryCommands.map((cmd, idx) => {
                          const globalIndex = allCommands.indexOf(cmd);
                          const isSelected = globalIndex === selectedIndex;
                          const Icon = cmd.icon;

                          return (
                            <button
                              key={cmd.id}
                              onClick={() => {
                                if (cmd.id === 'ai-ask') {
                                  setIsAIMode(true);
                                  setQuery('');
                                } else {
                                  cmd.action();
                                  onClose();
                                }
                              }}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                                isSelected
                                  ? "bg-blue-50 dark:bg-blue-900/30"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
                              )}
                            >
                              <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-lg",
                                cmd.category === 'ai'
                                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                              )}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white truncate">
                                  {cmd.title}
                                </div>
                                {cmd.description && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {cmd.description}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <ArrowRight className="h-4 w-4 text-blue-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* AI Input Area */}
          {isAIMode && query.trim() && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleAIQuery}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Ask Portal AI</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↵</kbd>
                  Select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">⌘K</kbd>
                Quick access
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default AICommandPalette;
