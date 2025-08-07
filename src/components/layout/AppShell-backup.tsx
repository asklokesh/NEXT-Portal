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
 Gauge
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
 
 // State
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [userMenuOpen, setUserMenuOpen] = useState(false);
 const [notificationCount, setNotificationCount] = useState(0);
 const [darkMode, setDarkMode] = useState(false);
 const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
 const [expandedMenus, setExpandedMenus] = useState<string[]>(['Catalog']); // Default expand Catalog
 
 // Mock user (would come from auth context)
 const [user, _setUser] = useState<User>({
 name: 'Alex Johnson',
 email: 'alex.johnson@company.com',
 role: 'Platform Engineer',
 avatar: undefined
 });

 // Navigation items with collapsible submenus
 const navigation: NavigationItem[] = [
 {
 name: 'Dashboard',
 href: '/dashboard',
 icon: Home,
 description: 'Platform overview and metrics'
 },
 {
 name: 'Catalog',
 icon: Package,
 description: 'Service management',
 children: [
 {
 name: 'Service Catalog',
 href: '/catalog',
 icon: Package,
 description: 'Browse and manage services'
 },
 {
 name: 'Relationships',
 href: '/catalog/relationships',
 icon: Network,
 description: 'Service dependency map'
 },
 {
 name: 'Templates',
 href: '/templates',
 icon: FileCode,
 description: 'Templates & Software Catalog'
 }
 ]
 },
 {
 name: 'Create',
 href: '/create',
 icon: Plus,
 description: 'Create new services and entities'
 },
 {
 name: 'Operations',
 icon: Rocket,
 description: 'Deployment and automation',
 children: [
 {
 name: 'Workflows',
 href: '/workflows',
 icon: GitBranch,
 description: 'Workflow automation and approvals'
 },
 {
 name: 'Deployments',
 href: '/deployments',
 icon: Rocket,
 description: 'Deployment pipelines and releases'
 }
 ]
 },
 {
 name: 'Monitoring',
 icon: Gauge,
 description: 'Health and monitoring',
 children: [
 {
 name: 'Health Monitor',
 href: '/health',
 icon: Shield,
 description: 'Service health and monitoring'
 },
 {
 name: 'System Monitoring',
 href: '/monitoring',
 icon: Activity,
 description: 'System monitoring and observability'
 },
 {
 name: 'Soundcheck',
 href: '/soundcheck',
 icon: Activity,
 description: 'Quality assurance and compliance'
 }
 ]
 },
 {
 name: 'Insights',
 icon: BarChart3,
 description: 'Analytics and reporting',
 children: [
 {
 name: 'Analytics',
 href: '/analytics',
 icon: BarChart3,
 description: 'Performance analytics and insights'
 },
 {
 name: 'Cost Tracking',
 href: '/cost',
 icon: DollarSign,
 description: 'Service cost optimization'
 },
 {
 name: 'Activity Logs',
 href: '/activity',
 icon: ClipboardList,
 description: 'Audit logs and activity tracking'
 }
 ]
 },
 {
 name: 'Plugins',
 icon: Zap,
 description: 'Extensions and plugins',
 children: [
 {
 name: 'Marketplace',
 href: '/plugins',
 icon: Zap,
 description: 'Plugin marketplace'
 },
 {
 name: 'Management',
 href: '/plugin-management',
 icon: Settings,
 description: 'Monitor and manage plugin instances'
 }
 ]
 },
 {
 name: 'Docs',
 icon: BookOpen,
 description: 'Documentation',
 children: [
 {
 name: 'Documentation',
 href: '/docs',
 icon: BookOpen,
 description: 'Platform documentation'
 },
 {
 name: 'API Docs',
 href: '/api-docs',
 icon: Code2,
 description: 'Interactive API documentation'
 }
 ]
 }
 ];

 const secondaryNavigation: NavigationItem[] = [
 { name: 'Teams', href: '/teams', icon: Users },
 { name: 'Settings', href: '/settings', icon: Settings },
 { name: 'Admin', href: '/admin', icon: Shield },
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
 'Health Monitor': 'healthMonitor',
 'Soundcheck': 'soundcheck',
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

 // Initialize dark mode from localStorage
 useEffect(() => {
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
 const currentNav = [...navigation, ...secondaryNavigation].find(
 item => pathname.startsWith(item.href)
 );
 return currentNav?.name || 'Platform';
 };

 return (
 <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
 
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
 <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
 </motion.div>
 
 <motion.div
 data-testid="mobile-menu"
 initial={{ x: -300 }}
 animate={{ x: 0 }}
 exit={{ x: -300 }}
 className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 lg:hidden"
 >
 <div className="flex h-full flex-col">
 <div className="flex h-16 items-center justify-between px-4">
 <Link href="/" className="flex items-center gap-2">
 <LogoIcon size="md" />
 <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
 NEXT Portal
 </span>
 </Link>
 <button
 onClick={() => setSidebarOpen(false)}
 className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 >
 <X className="h-6 w-6" />
 </button>
 </div>
 <nav className="flex-1 space-y-1 px-2 py-4">
 {filteredNavigation.map((item) => {
 const Icon = item.icon;
 const isActive = pathname.startsWith(item.href);
 return (
 <Link
 key={item.name}
 href={item.href}
 onClick={() => setSidebarOpen(false)}
 className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
 isActive
 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
 : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
 }`}
 >
 <Icon className="h-5 w-5" />
 {item.name}
 {item.badge && (
 <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
 {item.badge}
 </span>
 )}
 </Link>
 );
 })}
 </nav>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>

 {/* Desktop sidebar */}
 <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto lg:bg-white lg:dark:bg-gray-800 lg:border-r lg:border-gray-200 lg:dark:border-gray-700">
 <div className="flex h-full flex-col">
 <div className="flex h-16 items-center px-6">
 <Link href="/" className="flex items-center gap-2">
 <LogoIcon size="md" />
 <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
 NEXT Portal
 </span>
 </Link>
 </div>
 
 <nav className="flex-1 space-y-1 px-3 py-4">
 {filteredNavigation.map((item, index) => {
 const Icon = item.icon;
 const isActive = pathname.startsWith(item.href);
 const prevItem = index > 0 ? filteredNavigation[index - 1] : null;
 
 // Add section separators based on grouping
 const shouldAddSeparator = prevItem && (
 (prevItem.name === 'Dashboard' && item.name === 'Service Catalog') ||
 (prevItem.name === 'Templates' && item.name === 'Workflows') ||
 (prevItem.name === 'Deployments' && item.name === 'Health Monitor') ||
 (prevItem.name === 'Soundcheck' && item.name === 'Analytics') ||
 (prevItem.name === 'Activity' && item.name === 'Plugins') ||
 (prevItem.name === 'Plugin Management' && item.name === 'Documentation')
 );
 
 return (
 <React.Fragment key={item.name}>
 {shouldAddSeparator && (
 <div className="my-3 border-t border-gray-200 dark:border-gray-700" />
 )}
 <Link
 href={item.href}
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
 </React.Fragment>
 );
 })}
 
 <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
 
 {filteredSecondaryNavigation.map((item) => {
 const Icon = item.icon;
 const isActive = pathname.startsWith(item.href);
 return (
 <Link
 key={item.name}
 href={item.href}
 className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
 isActive
 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
 : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
 }`}
 >
 <Icon className="h-5 w-5" />
 {item.name}
 </Link>
 );
 })}
 </nav>
 
 {/* User section */}
 <div className="border-t border-gray-200 dark:border-gray-700 p-4">
 <button
 onClick={() => setUserMenuOpen(!userMenuOpen)}
 className="flex w-full items-center gap-3 rounded-md p-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
 >
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
 {user.name.charAt(0)}
 </div>
 <div className="flex-1 text-left">
 <p className="font-medium">{user.name}</p>
 <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
 </div>
 <ChevronDown className="h-4 w-4" />
 </button>
 </div>
 </div>
 </div>

 {/* Main content */}
 <div className="lg:pl-64">
 {/* Top navigation bar */}
 <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 px-4 sm:px-6">
 <button
 onClick={() => setSidebarOpen(true)}
 className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 >
 <Menu className="h-6 w-6" />
 </button>
 
 <div className="flex flex-1 items-center justify-between">
 <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {getPageTitle()}
 </h1>
 
 <div className="flex items-center gap-4">
 {/* Version Indicator */}
 <VersionIndicator />
 
 {/* WebSocket Status - Temporarily disabled */}
 {/* <WebSocketStatusIndicator /> */}
 
 {/* Search button */}
 <button
 onClick={openSearch}
 className="flex items-center gap-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
 >
 <Search className="h-4 w-4" />
 <span className="hidden sm:inline">Search</span>
 <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-300">
 <Command className="h-3 w-3" />K
 </kbd>
 </button>
 
 {/* Dark mode toggle */}
 <button
 onClick={toggleDarkMode}
 className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
 >
 {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
 </button>
 
 {/* Notifications */}
 <button
 onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
 className="relative rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
 >
 <Bell className="h-5 w-5" />
 {notificationCount > 0 && (
 <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
 {notificationCount > 9 ? '9+' : notificationCount}
 </span>
 )}
 </button>
 
 {/* Help */}
 <button
 onClick={() => router.push('/help')}
 className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
 >
 <HelpCircle className="h-5 w-5" />
 </button>
 </div>
 </div>
 </header>
 
 {/* Page content */}
 <main className="flex-1 p-4 sm:p-6 lg:p-8">
 {children}
 </main>
 </div>

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