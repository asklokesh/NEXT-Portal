/**
 * Plugin Marketplace Onboarding Wizard
 * Guided setup for plugin discovery, installation, and configuration
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Package,
  Search,
  Star,
  Download,
  Shield,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  ArrowLeft,
  Github,
  Globe,
  Zap,
  Users,
  Clock,
  Target,
  Rocket,
  Filter,
  BookOpen,
  Code,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  Heart,
  TrendingUp,
  Award
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface PluginCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  popularPlugins: string[];
}

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  author: string;
  repository?: string;
  homepage?: string;
  rating: number;
  downloads: number;
  lastUpdated: Date;
  tags: string[];
  features: string[];
  screenshots?: string[];
  compatibility: {
    backstageVersion: string;
    nodeVersion: string;
    platforms: string[];
  };
  security: {
    verified: boolean;
    trustScore: number;
    lastAudit?: Date;
  };
  configuration?: {
    required: boolean;
    schema?: any;
  };
  dependencies: string[];
  size: number; // in KB
  license: string;
}

interface PluginSelection {
  plugin: Plugin;
  selected: boolean;
  configRequired: boolean;
  config?: Record<string, any>;
}

interface MarketplacePreferences {
  categories: string[];
  useCase: string;
  teamSize: number;
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  priorities: string[];
  budgetConstraints: boolean;
  securityRequirements: 'BASIC' | 'STANDARD' | 'ENTERPRISE';
}

const PLUGIN_CATEGORIES: PluginCategory[] = [
  {
    id: 'catalog',
    name: 'Software Catalog',
    description: 'Manage and discover your software components',
    icon: Package,
    popularPlugins: ['catalog-backend', 'catalog-import', 'catalog-graph']
  },
  {
    id: 'scaffolder',
    name: 'Software Templates',
    description: 'Create new projects from templates',
    icon: Code,
    popularPlugins: ['scaffolder-backend', 'scaffolder-react', 'scaffolder-gitlab']
  },
  {
    id: 'techdocs',
    name: 'Tech Docs',
    description: 'Documentation as code platform',
    icon: BookOpen,
    popularPlugins: ['techdocs-backend', 'techdocs-addons', 'techdocs-module']
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Monitor and manage Kubernetes resources',
    icon: Globe,
    popularPlugins: ['kubernetes', 'kubernetes-backend', 'kubernetes-cluster']
  },
  {
    id: 'cicd',
    name: 'CI/CD',
    description: 'Build and deployment pipeline integration',
    icon: Zap,
    popularPlugins: ['jenkins', 'github-actions', 'gitlab-ci', 'azure-devops']
  },
  {
    id: 'monitoring',
    name: 'Monitoring & Observability',
    description: 'System monitoring and alerting',
    icon: TrendingUp,
    popularPlugins: ['prometheus', 'grafana', 'sentry', 'datadog']
  },
  {
    id: 'security',
    name: 'Security & Compliance',
    description: 'Security scanning and compliance tools',
    icon: Shield,
    popularPlugins: ['security-insights', 'sonarqube', 'snyk', 'vault']
  },
  {
    id: 'collaboration',
    name: 'Team Collaboration',
    description: 'Communication and project management',
    icon: Users,
    popularPlugins: ['pagerduty', 'jira', 'slack', 'microsoft-teams']
  }
];

const FEATURED_PLUGINS: Plugin[] = [
  {
    id: 'catalog-backend',
    name: 'Software Catalog Backend',
    description: 'Core backend services for the software catalog',
    version: '1.12.0',
    category: 'catalog',
    author: 'Backstage Team',
    repository: 'https://github.com/backstage/backstage',
    rating: 4.9,
    downloads: 50000,
    lastUpdated: new Date('2024-01-15'),
    tags: ['core', 'catalog', 'backend'],
    features: ['Entity management', 'API integration', 'Discovery', 'Relations'],
    compatibility: {
      backstageVersion: '^1.20.0',
      nodeVersion: '>=18.0.0',
      platforms: ['linux', 'darwin', 'win32']
    },
    security: {
      verified: true,
      trustScore: 95,
      lastAudit: new Date('2024-01-10')
    },
    configuration: {
      required: true,
      schema: {
        database: { required: true, type: 'string' },
        integrations: { required: false, type: 'array' }
      }
    },
    dependencies: ['@backstage/backend-common', '@backstage/catalog-model'],
    size: 1200,
    license: 'Apache-2.0'
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes Plugin',
    description: 'View and manage Kubernetes resources',
    version: '0.11.5',
    category: 'kubernetes',
    author: 'Backstage Team',
    repository: 'https://github.com/backstage/backstage',
    rating: 4.7,
    downloads: 35000,
    lastUpdated: new Date('2024-01-12'),
    tags: ['kubernetes', 'monitoring', 'devops'],
    features: ['Resource viewing', 'Pod logs', 'Deployment status', 'Cluster overview'],
    compatibility: {
      backstageVersion: '^1.20.0',
      nodeVersion: '>=18.0.0',
      platforms: ['linux', 'darwin']
    },
    security: {
      verified: true,
      trustScore: 88,
      lastAudit: new Date('2024-01-08')
    },
    configuration: {
      required: true,
      schema: {
        clusters: { required: true, type: 'array' },
        authProvider: { required: true, type: 'string' }
      }
    },
    dependencies: ['@kubernetes/client-node'],
    size: 800,
    license: 'Apache-2.0'
  },
  {
    id: 'techdocs-backend',
    name: 'TechDocs Backend',
    description: 'Documentation platform backend services',
    version: '1.8.0',
    category: 'techdocs',
    author: 'Backstage Team',
    rating: 4.6,
    downloads: 28000,
    lastUpdated: new Date('2024-01-10'),
    tags: ['documentation', 'mkdocs', 'publishing'],
    features: ['Doc generation', 'Storage backends', 'Publishing pipeline', 'Search integration'],
    compatibility: {
      backstageVersion: '^1.20.0',
      nodeVersion: '>=18.0.0',
      platforms: ['linux', 'darwin', 'win32']
    },
    security: {
      verified: true,
      trustScore: 92,
      lastAudit: new Date('2024-01-05')
    },
    configuration: {
      required: true,
      schema: {
        generator: { required: true, type: 'string' },
        publisher: { required: true, type: 'string' }
      }
    },
    dependencies: ['@backstage/techdocs-common'],
    size: 950,
    license: 'Apache-2.0'
  }
];

export default function PluginMarketplaceWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [preferences, setPreferences] = useState<Partial<MarketplacePreferences>>({
    categories: [],
    priorities: [],
    securityRequirements: 'STANDARD'
  });
  const [availablePlugins, setAvailablePlugins] = useState<Plugin[]>(FEATURED_PLUGINS);
  const [filteredPlugins, setFilteredPlugins] = useState<Plugin[]>(FEATURED_PLUGINS);
  const [selectedPlugins, setSelectedPlugins] = useState<PluginSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  useEffect(() => {
    filterPlugins();
  }, [preferences, searchQuery, availablePlugins]);

  const filterPlugins = () => {
    let filtered = [...availablePlugins];

    // Filter by categories
    if (preferences.categories?.length) {
      filtered = filtered.filter(plugin => 
        preferences.categories!.includes(plugin.category)
      );
    }

    // Filter by security requirements
    if (preferences.securityRequirements === 'ENTERPRISE') {
      filtered = filtered.filter(plugin => 
        plugin.security.verified && plugin.security.trustScore >= 90
      );
    } else if (preferences.securityRequirements === 'STANDARD') {
      filtered = filtered.filter(plugin => 
        plugin.security.trustScore >= 70
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(plugin =>
        plugin.name.toLowerCase().includes(query) ||
        plugin.description.toLowerCase().includes(query) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by relevance and popularity
    filtered.sort((a, b) => {
      if (preferences.priorities?.includes('popularity')) {
        return b.downloads - a.downloads;
      }
      if (preferences.priorities?.includes('security')) {
        return b.security.trustScore - a.security.trustScore;
      }
      if (preferences.priorities?.includes('maintenance')) {
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      }
      return b.rating - a.rating;
    });

    setFilteredPlugins(filtered);
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!preferences.useCase) {
          errors.useCase = 'Please select your primary use case';
        }
        if (!preferences.teamSize) {
          errors.teamSize = 'Please specify your team size';
        }
        break;
      case 2:
        if (!preferences.categories?.length) {
          errors.categories = 'Please select at least one category of interest';
        }
        break;
      case 3:
        // Plugin selection is optional
        break;
      case 4:
        // Configuration is handled per plugin
        break;
      case 5:
        // Final review - no specific validation
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handlePluginToggle = (plugin: Plugin, selected: boolean) => {
    setSelectedPlugins(prev => {
      const existing = prev.find(p => p.plugin.id === plugin.id);
      if (existing) {
        return prev.map(p => 
          p.plugin.id === plugin.id 
            ? { ...p, selected, configRequired: selected && !!plugin.configuration?.required }
            : p
        );
      } else if (selected) {
        return [...prev, {
          plugin,
          selected: true,
          configRequired: !!plugin.configuration?.required
        }];
      }
      return prev;
    });
  };

  const installSelectedPlugins = async () => {
    setLoading(true);
    try {
      const pluginsToInstall = selectedPlugins.filter(p => p.selected);
      
      const response = await fetch('/api/setup/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plugins: pluginsToInstall.map(p => ({
            id: p.plugin.id,
            version: p.plugin.version,
            config: p.config
          }))
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `${pluginsToInstall.length} plugins installed successfully`
        });
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to install plugins',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Tell us about your team</h3>
              <p className="text-gray-600 mb-4">
                Help us recommend the best plugins for your specific needs
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="useCase">Primary Use Case</Label>
                <Select
                  value={preferences.useCase}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, useCase: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your primary use case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="microservices">Microservices Platform</SelectItem>
                    <SelectItem value="monolith">Monolithic Application</SelectItem>
                    <SelectItem value="data-platform">Data Platform</SelectItem>
                    <SelectItem value="mobile-apps">Mobile Applications</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure Management</SelectItem>
                    <SelectItem value="documentation">Documentation Portal</SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors.useCase && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.useCase}</p>
                )}
              </div>

              <div>
                <Label htmlFor="teamSize">Team Size</Label>
                <Select
                  value={preferences.teamSize?.toString()}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, teamSize: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your team size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Just me (1 person)</SelectItem>
                    <SelectItem value="5">Small team (2-5 people)</SelectItem>
                    <SelectItem value="15">Medium team (6-15 people)</SelectItem>
                    <SelectItem value="50">Large team (16-50 people)</SelectItem>
                    <SelectItem value="100">Enterprise (50+ people)</SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors.teamSize && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.teamSize}</p>
                )}
              </div>

              <div>
                <Label>Experience Level</Label>
                <RadioGroup
                  value={preferences.experienceLevel}
                  onValueChange={(value) => setPreferences(prev => ({ 
                    ...prev, 
                    experienceLevel: value as any 
                  }))}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="BEGINNER" id="beginner" />
                    <Label htmlFor="beginner">Beginner - New to Backstage</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="INTERMEDIATE" id="intermediate" />
                    <Label htmlFor="intermediate">Intermediate - Some experience</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ADVANCED" id="advanced" />
                    <Label htmlFor="advanced">Advanced - Experienced user</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Security Requirements</Label>
                <RadioGroup
                  value={preferences.securityRequirements}
                  onValueChange={(value) => setPreferences(prev => ({ 
                    ...prev, 
                    securityRequirements: value as any 
                  }))}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="BASIC" id="basic" />
                    <Label htmlFor="basic">Basic - Standard security</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="STANDARD" id="standard" />
                    <Label htmlFor="standard">Standard - Enhanced security</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ENTERPRISE" id="enterprise" />
                    <Label htmlFor="enterprise">Enterprise - Maximum security</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Choose Plugin Categories</h3>
              <p className="text-gray-600 mb-4">
                Select the categories that interest you most
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLUGIN_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isSelected = preferences.categories?.includes(category.id);
                
                return (
                  <Card 
                    key={category.id}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'
                    }`}
                    onClick={() => {
                      const categories = preferences.categories || [];
                      if (isSelected) {
                        setPreferences(prev => ({
                          ...prev,
                          categories: categories.filter(c => c !== category.id)
                        }));
                      } else {
                        setPreferences(prev => ({
                          ...prev,
                          categories: [...categories, category.id]
                        }));
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">{category.name}</h4>
                          <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                          <div className="text-xs text-gray-500">
                            Popular: {category.popularPlugins.slice(0, 2).join(', ')}
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {validationErrors.categories && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{validationErrors.categories}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Priorities (Optional)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['popularity', 'security', 'maintenance', 'features'].map((priority) => (
                  <div key={priority} className="flex items-center space-x-2">
                    <Checkbox
                      id={priority}
                      checked={preferences.priorities?.includes(priority)}
                      onCheckedChange={(checked) => {
                        const priorities = preferences.priorities || [];
                        if (checked) {
                          setPreferences(prev => ({
                            ...prev,
                            priorities: [...priorities, priority]
                          }));
                        } else {
                          setPreferences(prev => ({
                            ...prev,
                            priorities: priorities.filter(p => p !== priority)
                          }));
                        }
                      }}
                    />
                    <Label htmlFor={priority} className="capitalize">{priority}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Discover Plugins</h3>
                <p className="text-gray-600">
                  Browse and select plugins that match your needs
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredPlugins.map((plugin) => {
                const isSelected = selectedPlugins.some(p => p.plugin.id === plugin.id && p.selected);
                
                return (
                  <Card key={plugin.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handlePluginToggle(plugin, !!checked)}
                            />
                            <div>
                              <h4 className="font-medium">{plugin.name}</h4>
                              <p className="text-sm text-gray-600">{plugin.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {plugin.rating}
                            </div>
                            <div className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {plugin.downloads.toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {plugin.lastUpdated.toLocaleDateString()}
                            </div>
                            {plugin.security.verified && (
                              <div className="flex items-center gap-1">
                                <Shield className="h-3 w-3 text-green-500" />
                                Verified
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">{plugin.category}</Badge>
                            <Badge variant="outline">v{plugin.version}</Badge>
                            <Badge variant="outline">{plugin.license}</Badge>
                            {plugin.configuration?.required && (
                              <Badge variant="destructive">Config Required</Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {plugin.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right text-sm">
                            <div className="font-medium">Trust Score</div>
                            <div className="text-gray-600">{plugin.security.trustScore}/100</div>
                          </div>
                          {plugin.repository && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={plugin.repository} target="_blank" rel="noopener noreferrer">
                                <Github className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {filteredPlugins.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-2" />
                  <p>No plugins found matching your criteria</p>
                  <Button variant="outline" className="mt-2" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Configure Selected Plugins</h3>
              <p className="text-gray-600 mb-4">
                Configure plugins that require additional setup
              </p>
            </div>

            <div className="space-y-4">
              {selectedPlugins.filter(p => p.selected && p.configRequired).map((selection) => (
                <Card key={selection.plugin.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{selection.plugin.name}</CardTitle>
                    <CardDescription>
                      {selection.plugin.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selection.plugin.configuration?.schema && 
                      Object.entries(selection.plugin.configuration.schema).map(([key, schema]: [string, any]) => (
                        <div key={key}>
                          <Label htmlFor={`${selection.plugin.id}-${key}`}>
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                            {schema.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {schema.type === 'string' ? (
                            <Input
                              id={`${selection.plugin.id}-${key}`}
                              placeholder={`Enter ${key}`}
                              onChange={(e) => {
                                const config = selection.config || {};
                                config[key] = e.target.value;
                                setSelectedPlugins(prev => prev.map(p => 
                                  p.plugin.id === selection.plugin.id ? { ...p, config } : p
                                ));
                              }}
                            />
                          ) : schema.type === 'array' ? (
                            <Textarea
                              id={`${selection.plugin.id}-${key}`}
                              placeholder={`Enter ${key} (one per line)`}
                              rows={3}
                              onChange={(e) => {
                                const config = selection.config || {};
                                config[key] = e.target.value.split('\n').filter(v => v.trim());
                                setSelectedPlugins(prev => prev.map(p => 
                                  p.plugin.id === selection.plugin.id ? { ...p, config } : p
                                ));
                              }}
                            />
                          ) : (
                            <Input
                              id={`${selection.plugin.id}-${key}`}
                              placeholder={`Enter ${key}`}
                              onChange={(e) => {
                                const config = selection.config || {};
                                config[key] = e.target.value;
                                setSelectedPlugins(prev => prev.map(p => 
                                  p.plugin.id === selection.plugin.id ? { ...p, config } : p
                                ));
                              }}
                            />
                          )}
                          {schema.description && (
                            <p className="text-sm text-gray-500 mt-1">{schema.description}</p>
                          )}
                        </div>
                      ))
                    }
                  </CardContent>
                </Card>
              ))}
              
              {selectedPlugins.filter(p => p.selected && p.configRequired).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-2" />
                  <p>No additional configuration required</p>
                  <p className="text-sm">All selected plugins use default settings</p>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Review Installation</h3>
              <p className="text-gray-600 mb-4">
                Review your plugin selection before installation
              </p>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Selected Plugins ({selectedPlugins.filter(p => p.selected).length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedPlugins.filter(p => p.selected).map((selection) => (
                      <div key={selection.plugin.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{selection.plugin.name}</div>
                          <div className="text-sm text-gray-600">v{selection.plugin.version}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{selection.plugin.category}</Badge>
                          {selection.configRequired && (
                            <Badge variant="secondary">Configured</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {selectedPlugins.filter(p => p.selected).length === 0 && (
                      <p className="text-gray-500 text-center py-4">No plugins selected</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Installation Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total plugins:</span>
                      <span className="ml-2 font-medium">{selectedPlugins.filter(p => p.selected).length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Require configuration:</span>
                      <span className="ml-2 font-medium">{selectedPlugins.filter(p => p.selected && p.configRequired).length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total size:</span>
                      <span className="ml-2 font-medium">
                        {Math.round(selectedPlugins.filter(p => p.selected).reduce((acc, p) => acc + p.plugin.size, 0) / 1024 * 100) / 100} MB
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Security verified:</span>
                      <span className="ml-2 font-medium">
                        {selectedPlugins.filter(p => p.selected && p.plugin.security.verified).length}/{selectedPlugins.filter(p => p.selected).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedPlugins.some(p => p.selected) && (
                <Alert>
                  <Rocket className="h-4 w-4" />
                  <AlertDescription>
                    Your selected plugins will be installed and configured automatically. 
                    You can manage them later from the Plugin Management dashboard.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Plugin Marketplace Setup</h1>
        <p className="text-gray-600">
          Discover and install plugins to extend your developer portal
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>Step {currentStep} of {totalSteps}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>

      <Card>
        <CardContent className="p-6">
          {renderStepContent()}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            {currentStep === totalSteps ? (
              <Button
                onClick={installSelectedPlugins}
                disabled={loading || selectedPlugins.filter(p => p.selected).length === 0}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Install Plugins ({selectedPlugins.filter(p => p.selected).length})
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!validateStep(currentStep)}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}