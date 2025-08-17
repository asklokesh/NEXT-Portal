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
      name: 'Soundcheck',
      href: '/soundcheck',
      icon: Shield,
      description: 'Tech health and standards',
      badge: 'Premium'
    },
    {
      name: 'AiKA',
      href: '/aika',
      icon: Zap,
      description: 'AI Knowledge Assistant',
      badge: 'AI'
    },
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
    'Soundcheck': 'soundcheck',
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

  // Spotify Portal navigation item renderer
  const renderSpotifyNavigationItem = (item: NavigationItem, isMobile = false) => {
    const Icon = item.icon;
    const isActive = item.href ? pathname.startsWith(item.href) : false;

    return (
      <motion.div
        key={item.name}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="spotify-fade-in"
      >
        <Link
          href={item.href!}
          onClick={isMobile ? () => setSidebarOpen(false) : undefined}
          className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 relative overflow-hidden ${
            isActive
              ? 'spotify-tab-active shadow-lg'
              : 'spotify-tab-inactive'
          }`}
          title={item.description}
        >
          <Icon className="h-5 w-5 relative z-10" />
          <span className="flex-1 relative z-10">{item.name}</span>
          {item.badge && (
            <span className={`rounded-full px-2 py-1 text-xs font-semibold relative z-10 ${
              item.badge === 'Premium' 
                ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground'
                : item.badge === 'AI'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : item.badge === 'Beta'
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                : 'bg-muted text-muted-foreground'
            }`}>
              {item.badge}
            </span>
          )}
          
          {/* Hover effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </Link>
      </motion.div>
    );
  };

  const renderNavigationItem = (item: NavigationItem, isMobile = false) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.name);
    const isActive = item.href ? pathname.startsWith(item.href) : 
      item.children?.some(child => child.href && pathname.startsWith(child.href));

    return (
      <div key={item.name}>
        {/* Parent item */}
        {item.href ? (
          <Link
            href={item.href}
            onClick={isMobile ? () => setSidebarOpen(false) : undefined}
            className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            title={item.description}
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1">{item.name}</span>
            {item.badge && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                {item.badge}
              </span>
            )}
          </Link>
        ) : (
          <button
            onClick={() => {
              if (expandedMenus.includes(item.name)) {
                setExpandedMenus(expandedMenus.filter(name => name !== item.name));
              } else {
                setExpandedMenus([...expandedMenus, item.name]);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, item)}
            className={`w-full group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            title={item.description}
            aria-expanded={hydrated ? isExpanded : undefined}
            aria-haspopup={hasChildren}
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1 text-left">{item.name}</span>
            {hasChildren && (
              <ChevronRight className={`h-4 w-4 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`} />
            )}
          </button>
        )}
        
        {/* Children items */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-1 space-y-1">
                {item.children?.map(child => {
                  const ChildIcon = child.icon;
                  const isChildActive = child.href && pathname.startsWith(child.href);
                  
                  return (
                    <motion.div
                      key={child.name}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link
                        href={child.href!}
                        onClick={isMobile ? () => setSidebarOpen(false) : undefined}
                        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          isChildActive
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
                        title={child.description}
                      >
                        <ChildIcon className="h-4 w-4" />
                        <span className="flex-1">{child.name}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="spotify-layout">
      
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
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            </motion.div>
            
            <motion.div
              data-testid="mobile-menu"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 spotify-sidebar lg:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="flex h-16 items-center justify-between px-6">
                  <Link href="/" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-lg">N</span>
                    </div>
                    <span className="text-xl font-bold spotify-gradient-text">
                      Next Portal
                    </span>
                  </Link>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-8">
                  {/* Core Navigation */}
                  <div className="space-y-2">
                    {navigation.map((item) => renderSpotifyNavigationItem(item, true))}
                  </div>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar - Spotify Portal Style */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-72 lg:overflow-y-auto spotify-sidebar">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center px-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                <span className="text-primary-foreground font-bold text-xl">N</span>
              </div>
              <span className="text-2xl font-bold spotify-gradient-text">
                Next Portal
              </span>
            </Link>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-8">
            {/* Core Navigation */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
                Portal
              </h3>
              {navigation.map((item) => renderSpotifyNavigationItem(item))}
            </div>
            
            {/* Spotify Premium Plugins */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
                Spotify Premium
              </h3>
              {premiumPlugins.map((item) => renderSpotifyNavigationItem(item))}
            </div>
            
            {/* Installed Plugins */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
                Installed
              </h3>
              {installedPlugins.map((item) => renderSpotifyNavigationItem(item))}
            </div>
          </nav>
          
          {/* User section - Spotify style */}
          <div className="border-t border-border/50 p-4">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top header - Spotify Portal style */}
        <header className="spotify-header sticky top-0 z-40 flex h-16 items-center gap-4 px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                {getPageTitle()}
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search button - Spotify Portal style */}
              <button
                onClick={commandPalette.open}
                className="flex items-center gap-2 rounded-xl spotify-input px-4 py-2 text-sm transition-all hover:border-primary/30"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline text-muted-foreground">Search Portal...</span>
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
              
              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              
              {/* Notifications */}
              <button
                onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
                className="relative rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-semibold">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>
              
              {/* User avatar */}
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-xl p-2 hover:bg-muted/50 transition-all"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                  {user.name.charAt(0)}
                </div>
              </button>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <main className="spotify-main-content">
          {children}
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