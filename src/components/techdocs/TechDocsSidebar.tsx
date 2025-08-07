'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Hash,
  Code,
  Book,
  Home,
  X,
  Search,
  ExternalLink,
  GitBranch,
  Clock,
  User,
  Settings,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  title: string;
  path: string;
  level: number;
  children?: TocItem[];
}

interface TechDocsSidebarProps {
  entity: any;
  onNavigate: (path: string) => void;
  onClose: () => void;
  className?: string;
}

export function TechDocsSidebar({
  entity,
  onNavigate,
  onClose,
  className,
}: TechDocsSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['getting-started', 'api-reference']));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState<string>('');

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleNavigate = (item: TocItem) => {
    setActiveItem(item.id);
    onNavigate(item.path);
  };

  const renderTocItem = (item: TocItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isActive = activeItem === item.id;
    
    // Filter by search
    if (searchQuery) {
      const matches = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const childMatches = item.children?.some(child => 
        child.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (!matches && !childMatches) {
        return null;
      }
    }

    return (
      <div key={item.id}>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors",
            "hover:bg-gray-100 dark:hover:bg-gray-700",
            isActive && "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
            depth > 0 && "ml-4"
          )}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.id);
            }
            handleNavigate(item);
          }}
        >
          {hasChildren ? (
            <button
              className="p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
          
          {item.level === 1 ? (
            <FileText className="h-4 w-4 text-muted-foreground" />
          ) : item.level === 2 ? (
            <Hash className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Code className="h-3 w-3 text-muted-foreground" />
          )}
          
          <span className={cn(
            "flex-1",
            item.level === 1 && "font-medium"
          )}>
            {item.title}
          </span>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {item.children!.map(child => renderTocItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            <h3 className="font-semibold">{entity.name}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Entity info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{entity.kind}</Badge>
            {entity.metadata?.version && (
              <Badge variant="secondary">v{entity.metadata.version}</Badge>
            )}
          </div>
          
          {entity.owner && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{entity.owner}</span>
            </div>
          )}
          
          {entity.metadata?.lastUpdated && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Updated {new Date(entity.metadata.lastUpdated).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-700 mb-2",
              activeItem === 'home' && "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
            )}
            onClick={() => {
              setActiveItem('home');
              onNavigate('index.md');
            }}
          >
            <Home className="h-4 w-4" />
            <span className="font-medium">Home</span>
          </div>
          
          <Separator className="my-2" />
          
          {/* Table of Contents */}
          {entity.docs?.toc ? (
            <div className="space-y-1">
              {entity.docs.toc.map((item: TocItem) => renderTocItem(item))}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Default structure if no TOC provided */}
              {[
                {
                  id: 'getting-started',
                  title: 'Getting Started',
                  path: 'getting-started.md',
                  level: 1,
                  children: [
                    { id: 'installation', title: 'Installation', path: 'installation.md', level: 2 },
                    { id: 'quickstart', title: 'Quick Start', path: 'quickstart.md', level: 2 },
                    { id: 'configuration', title: 'Configuration', path: 'configuration.md', level: 2 },
                  ],
                },
                {
                  id: 'guides',
                  title: 'Guides',
                  path: 'guides.md',
                  level: 1,
                  children: [
                    { id: 'basic-usage', title: 'Basic Usage', path: 'basic-usage.md', level: 2 },
                    { id: 'advanced', title: 'Advanced Topics', path: 'advanced.md', level: 2 },
                    { id: 'best-practices', title: 'Best Practices', path: 'best-practices.md', level: 2 },
                  ],
                },
                {
                  id: 'api-reference',
                  title: 'API Reference',
                  path: 'api-reference.md',
                  level: 1,
                  children: [
                    { id: 'endpoints', title: 'Endpoints', path: 'endpoints.md', level: 2 },
                    { id: 'authentication', title: 'Authentication', path: 'authentication.md', level: 2 },
                    { id: 'errors', title: 'Error Handling', path: 'errors.md', level: 2 },
                  ],
                },
                {
                  id: 'deployment',
                  title: 'Deployment',
                  path: 'deployment.md',
                  level: 1,
                  children: [
                    { id: 'docker', title: 'Docker', path: 'docker.md', level: 2 },
                    { id: 'kubernetes', title: 'Kubernetes', path: 'kubernetes.md', level: 2 },
                    { id: 'monitoring', title: 'Monitoring', path: 'monitoring.md', level: 2 },
                  ],
                },
                {
                  id: 'troubleshooting',
                  title: 'Troubleshooting',
                  path: 'troubleshooting.md',
                  level: 1,
                },
                {
                  id: 'changelog',
                  title: 'Changelog',
                  path: 'changelog.md',
                  level: 1,
                },
              ].map((item) => renderTocItem(item))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t space-y-2">
        <Button variant="outline" className="w-full justify-start" size="sm">
          <GitBranch className="h-4 w-4 mr-2" />
          View Source
        </Button>
        <Button variant="outline" className="w-full justify-start" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        <Button variant="outline" className="w-full justify-start" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}