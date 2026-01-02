'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Package,
  Plus,
  FileCode,
  Settings,
  Users,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  HelpCircle,
  Moon,
  Sun,
  Command,
  BookOpen,
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
  Server,
  Radar
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import NotificationCenter from '@/components/notifications/NotificationCenter';
import GlobalSearch from '@/components/search/GlobalSearch';
import { Logo, LogoIcon } from '@/components/ui/logo';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { wsClient } from '@/lib/websocket/client';
import { useFeatureToggles } from '@/contexts/FeatureTogglesContext';
// Temporarily disabled WebSocket
// import { WebSocketStatusIndicator } from '@/contexts/WebSocketContext';
import { VersionIndicator } from './VersionIndicator';
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette';
import { BreadcrumbBar } from '@/components/ui/Breadcrumbs';

interface User {
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  description?: string;
  children?: NavigationItem[];
}

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isSearchOpen, openSearch, closeSearch } = useGlobalSearch();
  const { toggles } = useFeatureToggles();
  const commandPalette = useCommandPalette();

  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Catalog']);
  const [hydrated, setHydrated] = useState(false);

  // Mock user (would come from auth context)
  const [user, _setUser] = useState<User>({
    name: 'Alex Johnson',
    email: 'alex.johnson@company.com',
    role: 'Platform Engineer',
    avatar: undefined
  });

  // Spotify Portal navigation structure - exact replica
  const navigation: NavigationItem[] = [
    {
      name: 'Home',
      href: '/dashboard',
      icon: Home,
      description: 'Portal overview and dashboard'
    },
    {
      name: 'Software Catalog',
      href: '/catalog',
      icon: Package,
      description: 'Service catalog and entities'
    },
    {
      name: 'Create',
      href: '/create',
      icon: Plus,
      description: 'Create new services from templates'
    },
    {
      name: 'Search',
      href: '/search',
      icon: Search,
      description: 'Ecosystem-wide search'
    },
    {
      name: 'Docs',
      href: '/docs',
      icon: BookOpen,
      description: 'Technical documentation'
    }
  ];

  // Spotify Portal premium plugins section
  const premiumPlugins: NavigationItem[] = [
    {
      name: 'Skill Exchange',
      href: '/skill-exchange',
      icon: Users,
      description: 'Learning and growth marketplace',
      badge: 'Beta'
    },
    {
      name: 'Insights',
      href: '/insights',
      icon: BarChart3,
      description: 'Usage analytics and adoption',
      badge: 'Premium'
    },
    {
      name: 'RBAC',
      href: '/rbac',
      icon: Shield,
      description: 'Role-based access control',
      badge: 'Premium'
    }
  ];

  // Spotify Portal installed plugins section  
  const installedPlugins: NavigationItem[] = [
    {
      name: 'GitHub',
      href: '/github',
      icon: GitBranch,
      description: 'GitHub integration'
    },
    {
      name: 'Kubernetes',
      href: '/kubernetes',
      icon: Server,
      description: 'Kubernetes clusters'
    },
    {
      name: 'Plugins',
      href: '/plugins',
      icon: Zap,
      description: 'Plugin marketplace'
    }
  ];

  const secondaryNavigation: NavigationItem[] = [
    { name: 'Integrations', href: '/admin/integrations', icon: Network }, // Changed from lucide-react Settings or similar
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Help', href: '/help', icon: HelpCircle },
  ];

  // Map navigation items to feature toggle keys
  const navigationFeatureMap: Record<string, keyof typeof toggles> = {
    'Dashboard': 'dashboard',
    'Service Catalog': 'serviceCatalog',
    'Relationships': 'relationships',
    'Create': 'create',
    'Templates': 'templates',
    'Plugins': 'plugins',
    'Workflows': 'workflows',
    'Deployments': 'deployments',
    'Kubernetes': 'kubernetes',
    'Health Monitor': 'healthMonitor',
    'Tech Radar': 'techRadar',
    'Analytics': 'analytics',
    'Cost Tracking': 'costTracking',
    'Monitoring': 'monitoring',
    'Activity': 'activity',
    'Documentation': 'documentation',
    'API Docs': 'apiDocs',
    'Teams': 'teams',
  };

  // Filter navigation based on feature toggles
  const filteredNavigation = navigation.filter(item => {
    const featureKey = navigationFeatureMap[item.name];
    return !featureKey || toggles[featureKey];
  });

  const filteredSecondaryNavigation = secondaryNavigation.filter(item => {
    const featureKey = navigationFeatureMap[item.name];
    return !featureKey || toggles[featureKey];
  });

  // Initialize settings from localStorage after hydration
  useEffect(() => {
    setHydrated(true);

    // Load expanded menus
    const savedExpandedMenus = localStorage.getItem('expandedMenus');
    if (savedExpandedMenus) {
      setExpandedMenus(JSON.parse(savedExpandedMenus));
    }

    // Load dark mode
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    wsClient.connect();

    const handleAlert = () => {
      setNotificationCount(prev => prev + 1);
    };

    wsClient.on('alert', handleAlert);

    return () => {
      wsClient.off('alert', handleAlert);
    };
  }, []);

  // Save expanded menus to localStorage after hydration
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem('expandedMenus', JSON.stringify(expandedMenus));
    }
  }, [expandedMenus, hydrated]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Get page title
  const getPageTitle = () => {
    // Check main navigation items and their children
    for (const item of [...navigation, ...secondaryNavigation]) {
      if (item.href && pathname.startsWith(item.href)) {
        return item.name;
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.href && pathname.startsWith(child.href)) {
            return child.name;
          }
        }
      }
    }
    return 'Platform';
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, item: NavigationItem) => {
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (expandedMenus.includes(item.name)) {
          setExpandedMenus(expandedMenus.filter(name => name !== item.name));
        } else {
          setExpandedMenus([...expandedMenus, item.name]);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!expandedMenus.includes(item.name)) {
          setExpandedMenus([...expandedMenus, item.name]);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (expandedMenus.includes(item.name)) {
          setExpandedMenus(expandedMenus.filter(name => name !== item.name));
        }
      }
    }
  };

  // Apple Portal navigation item renderer
  const renderAppleNavigationItem = (item: NavigationItem, isMobile = false) => {
    const Icon = item.icon;
    const isActive = item.href ? pathname.startsWith(item.href) : false;

    return (
      <motion.div
        key={item.name}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          href={item.href!}
          onClick={isMobile ? () => setSidebarOpen(false) : undefined}
          className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          title={item.description}
        >
          <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} />
          <span className="flex-1">{item.name}</span>
          {item.badge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.badge === 'Premium'
              ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
              : item.badge === 'AI'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
              {item.badge}
            </span>
          )}
        </Link>
      </motion.div>
    );
  };

  const renderNavigationItem = (item: NavigationItem, isMobile = false) => {
    // Redirect to use our new renderer
    if (item.href) return renderAppleNavigationItem(item, isMobile);

    // For expandable menus (kept mostly same but updated colors)
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.name);
    const isActive = item.children?.some(child => child.href && pathname.startsWith(child.href));

    return (
      <div key={item.name}>
        <button
          onClick={() => {
            if (expandedMenus.includes(item.name)) {
              setExpandedMenus(expandedMenus.filter(name => name !== item.name));
            } else {
              setExpandedMenus([...expandedMenus, item.name]);
            }
          }}
          className={`w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{item.name}</span>
          {hasChildren && (
            <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          )}
        </button>

        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-200 dark:border-gray-800 pl-2">
                {item.children?.map(child => renderAppleNavigationItem(child, isMobile))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
            </motion.div>

            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
            >
              <div className="flex h-full flex-col">
                <div className="flex h-14 items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800/50">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">N</div>
                    <span className="font-semibold text-lg tracking-tight">Portal</span>
                  </div>
                  <button onClick={() => setSidebarOpen(false)}>
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
                  <div className="space-y-1">
                    {navigation.map((item) => renderAppleNavigationItem(item, true))}
                  </div>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar - Apple Style */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto bg-gray-50/50 dark:bg-secondary/20 backdrop-blur-xl border-r border-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center px-5 gap-3">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-sm text-white font-bold text-sm">N</div>
            <span className="text-lg font-semibold tracking-tight text-foreground">Portal</span>
          </div>

          <nav className="flex-1 px-3 py-6 space-y-8">
            <div className="space-y-1">
              <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Platform</h3>
              {navigation.map((item) => renderAppleNavigationItem(item))}
            </div>

            <div className="space-y-1">
              <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Features</h3>
              {premiumPlugins.map((item) => renderAppleNavigationItem(item))}
            </div>

            <div className="space-y-1">
              <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Installed</h3>
              {installedPlugins.map((item) => renderAppleNavigationItem(item))}
            </div>
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-border/50">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-sm hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.role}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top header - Clean Glass */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 px-6 glass border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              {getPageTitle()}
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={commandPalette.open}
                className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Search className="h-3.5 w-3.5 text-gray-500" />
                <span className="hidden sm:inline text-gray-500 text-xs font-medium">Search</span>
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-white dark:bg-black px-1.5 text-[10px] font-medium text-gray-500 border border-gray-200 dark:border-gray-700">
                  ⌘K
                </kbd>
              </button>

              <div className="h-4 w-px bg-gray-200 dark:bg-gray-800 mx-2" />

              <button
                onClick={toggleDarkMode}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <button
                onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
                className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8 bg-gray-50/30 dark:bg-black">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />

      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />

      {/* User menu dropdown */}
      <AnimatePresence>
        {userMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-20 left-4 z-50 w-56 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5"
          >
            <div className="py-1">
              <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                <User className="h-4 w-4" />
                Profile
              </button>
              <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                <Shield className="h-4 w-4" />
                Security
              </button>
              <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                <Settings className="h-4 w-4" />
                Preferences
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => {
                  toast.success('Logged out successfully');
                  router.push('/login');
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}