'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  maxItems?: number;
  separator?: React.ReactNode;
  showHome?: boolean;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items: customItems,
  maxItems = 4,
  separator = <ChevronRight className="h-4 w-4 text-gray-400" />,
  showHome = true,
  className = ''
}) => {
  const pathname = usePathname();

  // Generate breadcrumb items from pathname if not provided
  const items = useMemo(() => {
    if (customItems) return customItems;

    const segments = pathname.split('/').filter(Boolean);
    const generatedItems: BreadcrumbItem[] = [];

    // Add each segment as a breadcrumb
    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      generatedItems.push({ label, href });
    });

    return generatedItems;
  }, [pathname, customItems]);

  // Truncate items if there are too many
  const displayItems = useMemo(() => {
    const allItems = showHome 
      ? [{ label: 'Home', href: '/', icon: Home }, ...items]
      : items;

    if (allItems.length <= maxItems) return allItems;

    // Keep first item, last 2 items, and add ellipsis
    return [
      allItems[0],
      { label: '...', href: undefined },
      ...allItems.slice(-2)
    ];
  }, [items, showHome, maxItems]);

  if (displayItems.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 ${className}`}>
      <ol className="flex items-center space-x-2">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const Icon = item.icon;

          return (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center"
            >
              {index > 0 && <span className="mx-2">{separator}</span>}
              
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`flex items-center gap-1.5 text-sm font-medium ${
                    isLast
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                </span>
              )}
            </motion.li>
          );
        })}
      </ol>
    </nav>
  );
};

// Breadcrumb provider for managing breadcrumbs globally
interface BreadcrumbContextValue {
  items: BreadcrumbItem[];
  setItems: (items: BreadcrumbItem[]) => void;
  addItem: (item: BreadcrumbItem) => void;
  removeItem: (index: number) => void;
  clear: () => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | undefined>(undefined);

export const BreadcrumbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = React.useState<BreadcrumbItem[]>([]);

  const addItem = React.useCallback((item: BreadcrumbItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  const removeItem = React.useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clear = React.useCallback(() => {
    setItems([]);
  }, []);

  const value = React.useMemo(
    () => ({ items, setItems, addItem, removeItem, clear }),
    [items, addItem, removeItem, clear]
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

export const useBreadcrumbs = () => {
  const context = React.useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider');
  }
  return context;
};

// Sticky breadcrumb bar component
export const BreadcrumbBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`sticky top-16 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="px-4 sm:px-6 lg:px-8 py-2">
        <Breadcrumbs />
      </div>
    </div>
  );
};