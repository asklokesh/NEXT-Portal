'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock,
  X,
  ExternalLink,
  Star,
  Trash2,
  ChevronRight,
  Package,
  FileCode,
  Zap,
  Shield,
  BarChart3,
  GitBranch,
  Settings,
  Users,
  Home
} from 'lucide-react';

interface VisitedPage {
  id: string;
  title: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  timestamp: number;
  visitCount: number;
  category?: string;
  isFavorite?: boolean;
}

interface RecentlyVisitedProps {
  maxItems?: number;
  showTimestamp?: boolean;
  showVisitCount?: boolean;
  showFavorites?: boolean;
  compact?: boolean;
  className?: string;
}

export const RecentlyVisited: React.FC<RecentlyVisitedProps> = ({
  maxItems = 10,
  showTimestamp = true,
  showVisitCount = false,
  showFavorites = true,
  compact = false,
  className = ''
}) => {
  const pathname = usePathname();
  const [visitedPages, setVisitedPages] = useState<VisitedPage[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Icon mapping for pages
  const getPageIcon = (path: string): React.ComponentType<{ className?: string }> => {
    if (path.includes('/catalog')) return Package;
    if (path.includes('/templates')) return FileCode;
    if (path.includes('/plugins')) return Zap;
    if (path.includes('/health') || path.includes('/monitoring')) return Shield;
    if (path.includes('/analytics')) return BarChart3;
    if (path.includes('/workflows')) return GitBranch;
    if (path.includes('/settings')) return Settings;
    if (path.includes('/teams')) return Users;
    if (path === '/' || path.includes('/dashboard')) return Home;
    return Package;
  };

  // Get page title from path
  const getPageTitle = (path: string): string => {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    
    return segments
      .map(segment => segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      )
      .join(' > ');
  };

  // Load visited pages and favorites from localStorage
  useEffect(() => {
    const loadData = () => {
      const savedPages = localStorage.getItem('recentlyVisitedPages');
      const savedFavorites = localStorage.getItem('favoritePages');
      
      if (savedPages) {
        try {
          const parsed = JSON.parse(savedPages);
          setVisitedPages(parsed);
        } catch (error) {
          console.error('Failed to load recently visited pages:', error);
        }
      }
      
      if (savedFavorites) {
        try {
          setFavorites(JSON.parse(savedFavorites));
        } catch (error) {
          console.error('Failed to load favorite pages:', error);
        }
      }
    };

    loadData();
    
    // Listen for storage changes from other tabs
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  // Track page visits
  useEffect(() => {
    if (pathname === '/') return; // Don't track root

    const pageId = pathname;
    const pageTitle = getPageTitle(pathname);
    const pageIcon = getPageIcon(pathname);

    setVisitedPages(prev => {
      const existing = prev.find(p => p.path === pathname);
      let updated: VisitedPage[];

      if (existing) {
        // Update existing page
        updated = [
          {
            ...existing,
            timestamp: Date.now(),
            visitCount: existing.visitCount + 1
          },
          ...prev.filter(p => p.path !== pathname)
        ];
      } else {
        // Add new page
        updated = [
          {
            id: pageId,
            title: pageTitle,
            path: pathname,
            icon: pageIcon,
            timestamp: Date.now(),
            visitCount: 1,
            isFavorite: favorites.includes(pageId)
          },
          ...prev
        ];
      }

      // Keep only the most recent pages
      updated = updated.slice(0, 50);

      // Save to localStorage
      localStorage.setItem('recentlyVisitedPages', JSON.stringify(updated));

      return updated;
    });
  }, [pathname, favorites]);

  // Toggle favorite
  const toggleFavorite = (pageId: string) => {
    setFavorites(prev => {
      const updated = prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId];
      
      localStorage.setItem('favoritePages', JSON.stringify(updated));
      
      // Update visited pages
      setVisitedPages(pages => pages.map(p => 
        p.id === pageId ? { ...p, isFavorite: updated.includes(pageId) } : p
      ));
      
      return updated;
    });
  };

  // Remove page from history
  const removePage = (pageId: string) => {
    setVisitedPages(prev => {
      const updated = prev.filter(p => p.id !== pageId);
      localStorage.setItem('recentlyVisitedPages', JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all history
  const clearHistory = () => {
    setVisitedPages([]);
    localStorage.removeItem('recentlyVisitedPages');
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  // Filter and sort pages
  const displayPages = visitedPages
    .filter(p => p.path !== pathname) // Don't show current page
    .sort((a, b) => {
      // Favorites first if enabled
      if (showFavorites) {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
      }
      // Then by timestamp
      return b.timestamp - a.timestamp;
    })
    .slice(0, maxItems);

  if (displayPages.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Recently Visited
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({displayPages.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!compact && (
            <button
              onClick={clearHistory}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Clear history"
            >
              <Trash2 className="h-4 w-4 text-gray-400" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`} />
          </button>
        </div>
      </div>

      {/* Pages List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={compact ? 'p-2 space-y-1' : 'p-3 space-y-2'}>
              {displayPages.map((page, index) => {
                const Icon = page.icon || Package;
                
                return (
                  <motion.div
                    key={page.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative"
                  >
                    <Link
                      href={page.path}
                      className={`flex items-center gap-3 rounded-md transition-colors ${
                        compact
                          ? 'px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700'
                          : 'px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className={`flex-shrink-0 text-gray-400 ${
                        compact ? 'h-4 w-4' : 'h-5 w-5'
                      }`} />
                      
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-gray-900 dark:text-gray-100 truncate ${
                          compact ? 'text-xs' : 'text-sm'
                        }`}>
                          {page.title}
                        </p>
                        {!compact && (
                          <div className="flex items-center gap-3 mt-0.5">
                            {showTimestamp && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTimestamp(page.timestamp)}
                              </span>
                            )}
                            {showVisitCount && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {page.visitCount} visit{page.visitCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {showFavorites && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleFavorite(page.id);
                            }}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            <Star className={`h-3.5 w-3.5 ${
                              page.isFavorite
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-400'
                            }`} />
                          </button>
                        )}
                        {!compact && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              removePage(page.id);
                            }}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            <X className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
              
              {displayPages.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No recently visited pages
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Widget version for dashboard
export const RecentlyVisitedWidget: React.FC = () => {
  return (
    <RecentlyVisited
      maxItems={5}
      compact
      showTimestamp={false}
      showVisitCount={false}
      className="h-full"
    />
  );
};