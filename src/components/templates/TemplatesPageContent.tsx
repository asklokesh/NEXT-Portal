'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Star, 
  Download, 
  GitFork,
  Clock,
  Package,
  Globe,
  Server,
  FileText,
  Plus,
  LayoutGrid,
  List,
  Loader2,
  AlertCircle,
  Sparkles,
  Database,
  Code,
  GitBranch,
  Layers,
  FileCode,
  Building2,
  Wrench,
  Play,
  ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplatesPageContentProps {
  className?: string;
}

// Template card component
const TemplateCard = ({ 
  template, 
  onClick 
}: { 
  template: TemplateEntity; 
  onClick: () => void;
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'service': return Server;
      case 'website': return Globe;
      case 'library': return Package;
      case 'documentation': return FileText;
      case 'resource': return Database;
      default: return Code;
    }
  };

  const Icon = getIcon(template.spec.type);

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <Star className="w-5 h-5" />
        </button>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {template.metadata.title}
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
        {template.metadata.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {template.metadata.tags?.slice(0, 3).map((tag) => (
          <span 
            key={tag}
            className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
          >
            {tag}
          </span>
        ))}
        {template.metadata.tags && template.metadata.tags.length > 3 && (
          <span className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            +{template.metadata.tags.length - 3} more
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            1.2k
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="w-3 h-3" />
            42
          </span>
        </div>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Updated 2d ago
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button 
          className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Play className="w-4 h-4 mr-2" />
          Use Template
        </button>
      </div>
    </div>
  );
};

export function TemplatesPageContent({ className }: TemplatesPageContentProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/backstage/scaffolder/templates');
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        
        const data = await response.json();
        setTemplates(data.items || []);
      } catch (err) {
        console.error('Error loading templates:', err);
        setError('Failed to load templates. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.metadata.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.metadata.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === 'all' || template.spec.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  // Get unique template types
  const templateTypes = Array.from(new Set(templates.map(t => t.spec.type)));

  const handleTemplateClick = (template: TemplateEntity) => {
    router.push(`/templates/execute?template=${encodeURIComponent(template.metadata.name)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-medium">Error loading templates</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Software Templates
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Choose from a variety of pre-built templates to quickly bootstrap your projects
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">All Types</option>
            {templateTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Create Template Button */}
          <button 
            onClick={() => router.push('/templates/builder')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </button>
        </div>
      </div>

      {/* Template Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Templates</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{templates.length}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Popular</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">12</p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recently Added</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">3</p>
            </div>
            <Sparkles className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{templateTypes.length}</p>
            </div>
            <Layers className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Templates Grid/List */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No templates found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
          : "space-y-4"
        }>
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.metadata.uid}
              template={template}
              onClick={() => handleTemplateClick(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}