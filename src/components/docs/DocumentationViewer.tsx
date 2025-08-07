'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, BookOpen, Code, FileText, Download, Copy, Check, ExternalLink, ChevronDown, ChevronRight, Filter, Zap, Eye, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ProcessedMarkdown } from '@/lib/docs/MarkdownProcessor';
import { ExtractedDocumentation } from '@/lib/docs/DocumentationExtractor';
import { OpenAPISpec, APIEndpoint } from '@/lib/docs/APIDocGenerator';

interface DocumentationViewerProps {
  documentation: {
    markdown?: ProcessedMarkdown;
    code?: ExtractedDocumentation;
    api?: OpenAPISpec;
    endpoints?: APIEndpoint[];
  };
  title?: string;
  searchable?: boolean;
  exportable?: boolean;
  interactive?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  onVersionChange?: (version: string) => void;
  versions?: Array<{
    id: string;
    name: string;
    createdAt: Date;
  }>;
}

interface TableOfContentsItem {
  title: string;
  level: number;
  anchor: string;
  children?: TableOfContentsItem[];
}

export function DocumentationViewer({
  documentation,
  title = 'Documentation',
  searchable = true,
  exportable = true,
  interactive = true,
  theme = 'auto',
  onVersionChange,
  versions = [],
}: DocumentationViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact'>('comfortable');
  const [showPrivateMembers, setShowPrivateMembers] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

  // Extract available programming languages from code documentation
  const availableLanguages = useMemo(() => {
    if (!documentation.code) return [];
    
    const languages = new Set<string>();
    documentation.code.functions.forEach(func => {
      if (func.documentation.location.file) {
        const ext = func.documentation.location.file.split('.').pop();
        if (ext) languages.add(ext);
      }
    });
    
    return Array.from(languages);
  }, [documentation.code]);

  // Filter documentation based on search and filters
  const filteredDocumentation = useMemo(() => {
    if (!documentation.code || !searchQuery) return documentation.code;

    const query = searchQuery.toLowerCase();
    
    return {
      ...documentation.code,
      functions: documentation.code.functions.filter(func =>
        func.name.toLowerCase().includes(query) ||
        func.documentation.description?.toLowerCase().includes(query)
      ),
      classes: documentation.code.classes.filter(cls =>
        cls.name.toLowerCase().includes(query) ||
        cls.documentation.description?.toLowerCase().includes(query)
      ),
      interfaces: documentation.code.interfaces.filter(iface =>
        iface.name.toLowerCase().includes(query) ||
        iface.documentation.description?.toLowerCase().includes(query)
      ),
    };
  }, [documentation.code, searchQuery]);

  // Filter API endpoints
  const filteredEndpoints = useMemo(() => {
    if (!documentation.endpoints || !searchQuery) return documentation.endpoints;

    const query = searchQuery.toLowerCase();
    return documentation.endpoints.filter(endpoint =>
      endpoint.path.toLowerCase().includes(query) ||
      endpoint.summary?.toLowerCase().includes(query) ||
      endpoint.description?.toLowerCase().includes(query)
    );
  }, [documentation.endpoints, searchQuery]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const exportDocumentation = useCallback(async (format: 'html' | 'json' | 'pdf') => {
    try {
      const response = await fetch('/api/docs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentation,
          format,
          title,
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [documentation, title]);

  const renderTableOfContents = () => {
    if (!documentation.markdown?.toc.length) return null;

    const renderTocLevel = (items: TableOfContentsItem[]) => (
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.anchor}>
            <a
              href={`#${item.anchor}`}
              className={`block text-sm text-muted-foreground hover:text-foreground transition-colors pl-${(item.level - 1) * 2}`}
            >
              {item.title}
            </a>
            {item.children && renderTocLevel(item.children)}
          </li>
        ))}
      </ul>
    );

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Table of Contents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderTocLevel(documentation.markdown.toc)}
        </CardContent>
      </Card>
    );
  };

  const renderCodeDocumentation = () => {
    if (!filteredDocumentation) return null;

    return (
      <div className="space-y-6">
        {/* Functions */}
        {filteredDocumentation.functions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Functions ({filteredDocumentation.functions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredDocumentation.functions.map((func, index) => (
                <Collapsible
                  key={`${func.name}-${index}`}
                  open={!collapsedSections.has(`function-${func.name}-${index}`)}
                  onOpenChange={() => toggleSection(`function-${func.name}-${index}`)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                      <div className="flex items-center gap-3">
                        <Code className="w-4 h-4" />
                        <div className="text-left">
                          <div className="font-mono font-medium">{func.signature}</div>
                          {func.documentation.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {func.documentation.description.split('\n')[0]}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {func.isAsync && <Badge variant="secondary">async</Badge>}
                        {func.isExported && <Badge variant="outline">exported</Badge>}
                        {collapsedSections.has(`function-${func.name}-${index}`) ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {func.documentation.description && (
                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">
                            {func.documentation.description}
                          </p>
                        </div>
                      )}
                      
                      {func.documentation.params && func.documentation.params.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Parameters</h4>
                          <div className="space-y-2">
                            {func.documentation.params.map((param) => (
                              <div key={param.name} className="text-sm">
                                <code className="bg-muted px-1.5 py-0.5 rounded">
                                  {param.name}
                                  {param.optional && '?'}
                                  {param.type && `: ${param.type}`}
                                </code>
                                {param.description && (
                                  <span className="ml-2 text-muted-foreground">
                                    {param.description}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {func.documentation.returns && (
                        <div>
                          <h4 className="font-medium mb-2">Returns</h4>
                          <div className="text-sm">
                            {func.documentation.returns.type && (
                              <code className="bg-muted px-1.5 py-0.5 rounded mr-2">
                                {func.documentation.returns.type}
                              </code>
                            )}
                            <span className="text-muted-foreground">
                              {func.documentation.returns.description}
                            </span>
                          </div>
                        </div>
                      )}

                      {func.documentation.examples && func.documentation.examples.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Examples</h4>
                          {func.documentation.examples.map((example, exampleIndex) => (
                            <div key={exampleIndex} className="relative">
                              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                                <code>{example}</code>
                              </pre>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2"
                                onClick={() => handleCopy(example, `example-${func.name}-${exampleIndex}`)}
                              >
                                {copyStates[`example-${func.name}-${exampleIndex}`] ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        {func.documentation.location.file}:{func.documentation.location.line}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Classes */}
        {filteredDocumentation.classes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Classes ({filteredDocumentation.classes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredDocumentation.classes.map((cls, index) => (
                <Collapsible
                  key={`${cls.name}-${index}`}
                  open={!collapsedSections.has(`class-${cls.name}-${index}`)}
                  onOpenChange={() => toggleSection(`class-${cls.name}-${index}`)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4" />
                        <div className="text-left">
                          <div className="font-mono font-medium">{cls.name}</div>
                          {cls.documentation.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {cls.documentation.description.split('\n')[0]}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cls.isExported && <Badge variant="outline">exported</Badge>}
                        <Badge variant="secondary">
                          {cls.methods.length} methods, {cls.properties.length} properties
                        </Badge>
                        {collapsedSections.has(`class-${cls.name}-${index}`) ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {cls.documentation.description && (
                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">
                            {cls.documentation.description}
                          </p>
                        </div>
                      )}

                      {cls.methods.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Methods</h4>
                          <div className="space-y-2">
                            {cls.methods
                              .filter(method => showPrivateMembers || method.visibility === 'public')
                              .map((method, methodIndex) => (
                                <div key={methodIndex} className="border rounded p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <code className="font-mono text-sm">{method.signature}</code>
                                    {method.isStatic && <Badge variant="secondary" className="text-xs">static</Badge>}
                                    <Badge variant={method.visibility === 'private' ? 'destructive' : 'default'} className="text-xs">
                                      {method.visibility}
                                    </Badge>
                                  </div>
                                  {method.documentation.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {method.documentation.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {cls.properties.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Properties</h4>
                          <div className="space-y-2">
                            {cls.properties
                              .filter(prop => showPrivateMembers || prop.visibility === 'public')
                              .map((prop, propIndex) => (
                                <div key={propIndex} className="border rounded p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <code className="font-mono text-sm">
                                      {prop.name}{prop.type && `: ${prop.type}`}
                                    </code>
                                    {prop.isStatic && <Badge variant="secondary" className="text-xs">static</Badge>}
                                    <Badge variant={prop.visibility === 'private' ? 'destructive' : 'default'} className="text-xs">
                                      {prop.visibility}
                                    </Badge>
                                  </div>
                                  {prop.documentation.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {prop.documentation.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Interfaces */}
        {filteredDocumentation.interfaces.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Interfaces ({filteredDocumentation.interfaces.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredDocumentation.interfaces.map((iface, index) => (
                <div key={`${iface.name}-${index}`} className="border rounded p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-mono font-medium">{iface.name}</h3>
                    {iface.isExported && <Badge variant="outline">exported</Badge>}
                  </div>
                  
                  {iface.documentation.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {iface.documentation.description}
                    </p>
                  )}

                  {iface.properties.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Properties</h4>
                      <div className="space-y-1">
                        {iface.properties.map((prop, propIndex) => (
                          <div key={propIndex} className="text-sm">
                            <code className="bg-muted px-1.5 py-0.5 rounded">
                              {prop.name}{prop.optional ? '?' : ''}{prop.type && `: ${prop.type}`}
                            </code>
                            {prop.documentation.description && (
                              <span className="ml-2 text-muted-foreground">
                                {prop.documentation.description}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderAPIDocumentation = () => {
    if (!filteredEndpoints || filteredEndpoints.length === 0) return null;

    return (
      <div className="space-y-6">
        {filteredEndpoints.map((endpoint, index) => (
          <Card key={`${endpoint.path}-${endpoint.method}-${index}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={
                    endpoint.method === 'get' ? 'secondary' :
                    endpoint.method === 'post' ? 'default' :
                    endpoint.method === 'put' ? 'outline' :
                    endpoint.method === 'delete' ? 'destructive' :
                    'secondary'
                  }>
                    {endpoint.method.toUpperCase()}
                  </Badge>
                  <code className="font-mono text-sm">{endpoint.path}</code>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedEndpoint(endpoint)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Try it
                </Button>
              </div>
              {endpoint.summary && (
                <CardTitle className="text-lg">{endpoint.summary}</CardTitle>
              )}
              {endpoint.description && (
                <CardDescription>{endpoint.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="parameters" className="w-full">
                <TabsList>
                  <TabsTrigger value="parameters">Parameters</TabsTrigger>
                  <TabsTrigger value="responses">Responses</TabsTrigger>
                  {endpoint.examples && <TabsTrigger value="examples">Examples</TabsTrigger>}
                </TabsList>
                
                <TabsContent value="parameters" className="space-y-4">
                  {endpoint.parameters.length > 0 ? (
                    <div className="space-y-3">
                      {endpoint.parameters.map((param, paramIndex) => (
                        <div key={paramIndex} className="border rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">
                              {param.name}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {param.type}
                            </Badge>
                            {param.required && (
                              <Badge variant="destructive" className="text-xs">
                                required
                              </Badge>
                            )}
                          </div>
                          {param.description && (
                            <p className="text-sm text-muted-foreground">
                              {param.description}
                            </p>
                          )}
                          {param.schema && (
                            <pre className="bg-muted p-2 rounded text-xs mt-2 overflow-x-auto">
                              <code>{JSON.stringify(param.schema, null, 2)}</code>
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No parameters</p>
                  )}
                </TabsContent>

                <TabsContent value="responses" className="space-y-4">
                  {Object.entries(endpoint.responses).map(([code, response]) => (
                    <div key={code} className="border rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={
                          code.startsWith('2') ? 'default' :
                          code.startsWith('4') ? 'destructive' :
                          code.startsWith('5') ? 'destructive' :
                          'secondary'
                        }>
                          {code}
                        </Badge>
                        <span className="text-sm font-medium">{response.description}</span>
                      </div>
                      {response.schema && (
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                          <code>{JSON.stringify(response.schema, null, 2)}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </TabsContent>

                {endpoint.examples && (
                  <TabsContent value="examples" className="space-y-4">
                    {endpoint.examples.map((example, exampleIndex) => (
                      <div key={exampleIndex} className="space-y-3">
                        <h4 className="font-medium">{example.name}</h4>
                        {example.request && (
                          <div>
                            <h5 className="text-sm font-medium mb-2">Request</h5>
                            <div className="relative">
                              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                                <code>{JSON.stringify(example.request, null, 2)}</code>
                              </pre>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2"
                                onClick={() => handleCopy(
                                  JSON.stringify(example.request, null, 2),
                                  `request-${index}-${exampleIndex}`
                                )}
                              >
                                {copyStates[`request-${index}-${exampleIndex}`] ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        {example.response && (
                          <div>
                            <h5 className="text-sm font-medium mb-2">Response</h5>
                            <div className="relative">
                              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                                <code>{JSON.stringify(example.response, null, 2)}</code>
                              </pre>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2"
                                onClick={() => handleCopy(
                                  JSON.stringify(example.response, null, 2),
                                  `response-${index}-${exampleIndex}`
                                )}
                              >
                                {copyStates[`response-${index}-${exampleIndex}`] ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderAPIExplorer = () => {
    if (!selectedEndpoint) return null;

    return (
      <Dialog open={!!selectedEndpoint} onOpenChange={() => setSelectedEndpoint(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={
                selectedEndpoint.method === 'get' ? 'secondary' :
                selectedEndpoint.method === 'post' ? 'default' :
                selectedEndpoint.method === 'put' ? 'outline' :
                selectedEndpoint.method === 'delete' ? 'destructive' :
                'secondary'
              }>
                {selectedEndpoint.method.toUpperCase()}
              </Badge>
              {selectedEndpoint.path}
            </DialogTitle>
            <DialogDescription>
              Interactive API Explorer - {selectedEndpoint.summary}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Request URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${selectedEndpoint.path}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${selectedEndpoint.path}`,
                    'api-url'
                  )}
                >
                  {copyStates['api-url'] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {selectedEndpoint.parameters.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Parameters</Label>
                <div className="space-y-2 mt-2">
                  {selectedEndpoint.parameters.map((param, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Label className="min-w-0 w-24 text-xs">{param.name}</Label>
                      <Input
                        placeholder={param.description || `Enter ${param.name}`}
                        className="text-sm"
                      />
                      <Badge variant="outline" className="text-xs">
                        {param.type}
                      </Badge>
                      {param.required && (
                        <Badge variant="destructive" className="text-xs">
                          required
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <Button className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Send Request
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${selectedEndpoint.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in new tab
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            {documentation.markdown && (
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>{documentation.markdown.wordCount} words</span>
                <span>{documentation.markdown.readingTime} min read</span>
                {documentation.markdown.lastModified && (
                  <span>Updated {documentation.markdown.lastModified.toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {versions.length > 0 && (
              <Select onValueChange={onVersionChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Documentation Settings</DialogTitle>
                  <DialogDescription>
                    Customize your documentation viewing experience
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view-mode">View Mode</Label>
                    <Select value={viewMode} onValueChange={(value: 'comfortable' | 'compact') => setViewMode(value)}>
                      <SelectTrigger className="w-32" id="view-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-private">Show Private Members</Label>
                    <Switch
                      id="show-private"
                      checked={showPrivateMembers}
                      onCheckedChange={setShowPrivateMembers}
                    />
                  </div>

                  {availableLanguages.length > 0 && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="language-filter">Language Filter</Label>
                      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                        <SelectTrigger className="w-32" id="language-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {availableLanguages.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {exportable && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportDocumentation('html')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  HTML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportDocumentation('json')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  JSON
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        {searchable && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {renderTableOfContents()}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {documentation.markdown && (
                <Card>
                  <CardContent className="p-6">
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: documentation.markdown.html }}
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="code" className="space-y-6">
              {renderCodeDocumentation()}
            </TabsContent>

            <TabsContent value="api" className="space-y-6">
              {renderAPIDocumentation()}
            </TabsContent>

            <TabsContent value="raw" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Raw Documentation Data</CardTitle>
                  <CardDescription>
                    Raw extracted documentation in JSON format
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded text-xs overflow-x-auto max-h-96">
                      <code>{JSON.stringify(documentation, null, 2)}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => handleCopy(JSON.stringify(documentation, null, 2), 'raw-data')}
                    >
                      {copyStates['raw-data'] ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* API Explorer Modal */}
      {renderAPIExplorer()}
    </div>
  );
}

export default DocumentationViewer;