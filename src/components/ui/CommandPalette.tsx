'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Home,
  Package,
  Plus,
  FileCode,
  Settings,
  Users,
  Zap,
  Shield,
  BarChart3,
  Rocket,
  Network,
  DollarSign,
  Activity,
  ClipboardList,
  GitBranch,
  Code2,
  Gauge,
  BookOpen,
  ArrowRight,
  Command,
  Hash,
  Star,
  Clock,
  ExternalLink,
  File,
  Folder
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from '@/hooks/useHotkeys';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  category: 'navigation' | 'action' | 'recent' | 'favorite' | 'file' | 'help';
  action: () => void;
  keywords?: string[];
  shortcut?: string;
  external?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [favoriteCommands, setFavoriteCommands] = useState<string[]>([]);

  // Load recent and favorite commands from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRecent = localStorage.getItem('recentCommands');
      const savedFavorites = localStorage.getItem('favoriteCommands');
      
      if (savedRecent) setRecentCommands(JSON.parse(savedRecent));
      if (savedFavorites) setFavoriteCommands(JSON.parse(savedFavorites));
    }
  }, []);

  // Define all available commands
  const allCommands: CommandItem[] = useMemo(() => [
    // Navigation commands
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      description: 'View platform overview and metrics',
      icon: Home,
      category: 'navigation',
      action: () => router.push('/dashboard'),
      keywords: ['home', 'overview', 'metrics']
    },
    {
      id: 'nav-catalog',
      title: 'Go to Service Catalog',
      description: 'Browse and manage services',
      icon: Package,
      category: 'navigation',
      action: () => router.push('/catalog'),
      keywords: ['services', 'browse']
    },
    {
      id: 'nav-create',
      title: 'Create New Service',
      description: 'Create a new service or entity',
      icon: Plus,
      category: 'navigation',
      action: () => router.push('/create'),
      keywords: ['new', 'add']
    },
    {
      id: 'nav-templates',
      title: 'Browse Templates',
      description: 'View software templates',
      icon: FileCode,
      category: 'navigation',
      action: () => router.push('/templates'),
      keywords: ['software', 'catalog']
    },
    {
      id: 'nav-workflows',
      title: 'View Workflows',
      description: 'Workflow automation and approvals',
      icon: GitBranch,
      category: 'navigation',
      action: () => router.push('/workflows'),
      keywords: ['automation', 'approvals', 'pipelines']
    },
    {
      id: 'nav-deployments',
      title: 'View Deployments',
      description: 'Deployment pipelines and releases',
      icon: Rocket,
      category: 'navigation',
      action: () => router.push('/deployments'),
      keywords: ['releases', 'pipelines', 'deploy']
    },
    {
      id: 'nav-health',
      title: 'Health Monitor',
      description: 'Service health and monitoring',
      icon: Shield,
      category: 'navigation',
      action: () => router.push('/health'),
      keywords: ['monitoring', 'status']
    },
    {
      id: 'nav-analytics',
      title: 'View Analytics',
      description: 'Performance analytics and insights',
      icon: BarChart3,
      category: 'navigation',
      action: () => router.push('/analytics'),
      keywords: ['insights', 'metrics', 'performance']
    },
    {
      id: 'nav-plugins',
      title: 'Plugin Marketplace',
      description: 'Browse and install plugins',
      icon: Zap,
      category: 'navigation',
      action: () => router.push('/plugins'),
      keywords: ['marketplace', 'extensions', 'install']
    },
    {
      id: 'nav-settings',
      title: 'Open Settings',
      description: 'Configure platform settings',
      icon: Settings,
      category: 'navigation',
      action: () => router.push('/settings'),
      keywords: ['preferences', 'configuration']
    },

    // Action commands
    {
      id: 'action-search',
      title: 'Search Everything',
      description: 'Search across all services and resources',
      icon: Search,
      category: 'action',
      action: () => {
        onClose();
        // Trigger global search
        document.dispatchEvent(new CustomEvent('openGlobalSearch'));
      },
      keywords: ['find', 'look'],
      shortcut: '⌘K'
    },
    {
      id: 'action-create-service',
      title: 'Create Service',
      description: 'Start creating a new service',
      icon: Plus,
      category: 'action',
      action: () => router.push('/create?type=service'),
      keywords: ['new', 'add', 'service']
    },
    {
      id: 'action-create-component',
      title: 'Create Component',
      description: 'Start creating a new component',
      icon: Package,
      category: 'action',
      action: () => router.push('/create?type=component'),
      keywords: ['new', 'add', 'component']
    },
    {
      id: 'action-deploy',
      title: 'Start Deployment',
      description: 'Begin a new deployment',
      icon: Rocket,
      category: 'action',
      action: () => router.push('/deployments/new'),
      keywords: ['deploy', 'release', 'ship']
    },
    {
      id: 'action-run-workflow',
      title: 'Run Workflow',
      description: 'Execute a workflow',
      icon: GitBranch,
      category: 'action',
      action: () => router.push('/workflows/run'),
      keywords: ['execute', 'start', 'workflow']
    },

    // Help commands
    {
      id: 'help-docs',
      title: 'View Documentation',
      description: 'Open platform documentation',
      icon: BookOpen,
      category: 'help',
      action: () => router.push('/docs'),
      keywords: ['help', 'guide', 'manual']
    },
    {
      id: 'help-api',
      title: 'API Documentation',
      description: 'View API reference',
      icon: Code2,
      category: 'help',
      action: () => router.push('/api-docs'),
      keywords: ['api', 'reference', 'endpoints']
    },
    {
      id: 'help-support',
      title: 'Contact Support',
      description: 'Get help from support team',
      icon: Users,
      category: 'help',
      action: () => window.open('https://support.example.com', '_blank'),
      keywords: ['help', 'support', 'contact'],
      external: true
    }
  ], [router, onClose]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) {
      // Show recent and favorite commands when no search
      const recents = recentCommands
        .map(id => allCommands.find(cmd => cmd.id === id))
        .filter(Boolean)
        .slice(0, 3) as CommandItem[];
      
      const favorites = favoriteCommands
        .map(id => allCommands.find(cmd => cmd.id === id))
        .filter(Boolean)
        .slice(0, 3) as CommandItem[];

      return [
        ...recents.map(cmd => ({ ...cmd, category: 'recent' as const })),
        ...favorites.map(cmd => ({ ...cmd, category: 'favorite' as const })),
        ...allCommands.slice(0, 5)
      ];
    }

    const searchLower = search.toLowerCase();
    return allCommands.filter(cmd => {
      const titleMatch = cmd.title.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      
      return titleMatch || descMatch || keywordMatch;
    });
  }, [search, allCommands, recentCommands, favoriteCommands]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Execute command and update recent commands
  const executeCommand = useCallback((command: CommandItem) => {
    // Update recent commands
    const newRecents = [
      command.id,
      ...recentCommands.filter(id => id !== command.id)
    ].slice(0, 10);
    
    setRecentCommands(newRecents);
    localStorage.setItem('recentCommands', JSON.stringify(newRecents));
    
    // Execute the command
    command.action();
    onClose();
  }, [recentCommands, onClose]);

  // Toggle favorite command
  const toggleFavorite = useCallback((commandId: string) => {
    const newFavorites = favoriteCommands.includes(commandId)
      ? favoriteCommands.filter(id => id !== commandId)
      : [...favoriteCommands, commandId];
    
    setFavoriteCommands(newFavorites);
    localStorage.setItem('favoriteCommands', JSON.stringify(newFavorites));
  }, [favoriteCommands]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Get category icon
  const getCategoryIcon = (category: CommandItem['category']) => {
    switch (category) {
      case 'recent': return Clock;
      case 'favorite': return Star;
      case 'navigation': return ArrowRight;
      case 'action': return Zap;
      case 'file': return File;
      case 'help': return HelpCircle;
      default: return Hash;
    }
  };

  // Get category label
  const getCategoryLabel = (category: CommandItem['category']) => {
    switch (category) {
      case 'recent': return 'Recent';
      case 'favorite': return 'Favorites';
      case 'navigation': return 'Navigate';
      case 'action': return 'Actions';
      case 'file': return 'Files';
      case 'help': return 'Help';
      default: return 'Other';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-0 top-20 z-50 mx-auto max-w-2xl"
          >
            <div className="mx-4 overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-gray-900/10 dark:ring-gray-100/10">
              {/* Search Input */}
              <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 outline-none"
                  autoFocus
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300">
                  ESC
                </kbd>
              </div>

              {/* Command List */}
              <div className="max-h-96 overflow-y-auto p-2">
                {filteredCommands.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No commands found for "{search}"
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredCommands.map((command, index) => {
                      const Icon = command.icon || getCategoryIcon(command.category);
                      const isSelected = index === selectedIndex;
                      const isFavorite = favoriteCommands.includes(command.id);

                      return (
                        <button
                          key={command.id}
                          onClick={() => executeCommand(command)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{command.title}</span>
                              {command.external && (
                                <ExternalLink className="h-3 w-3 text-gray-400" />
                              )}
                            </div>
                            {command.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {command.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {command.shortcut && (
                              <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                                {command.shortcut}
                              </kbd>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(command.id);
                              }}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  isFavorite
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-400'
                                }`}
                              />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5">↑↓</kbd>
                      Navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5">↵</kbd>
                      Select
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Favorite
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Command className="h-3 w-3" />
                    <span>Command Palette</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Hook to use command palette
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useHotkeys('cmd+k, ctrl+k', (e) => {
    e.preventDefault();
    setIsOpen(true);
  });

  useEffect(() => {
    const handleOpenCommandPalette = () => setIsOpen(true);
    document.addEventListener('openCommandPalette', handleOpenCommandPalette);
    
    return () => {
      document.removeEventListener('openCommandPalette', handleOpenCommandPalette);
    };
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  };
};

// Add missing import
const HelpCircle = Activity;