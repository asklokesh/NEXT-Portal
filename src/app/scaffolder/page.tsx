'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wand2,
  Search,
  FileText,
  Package,
  Cloud,
  Database,
  GitBranch,
  Zap,
  Shield,
  Clock,
  Star,
  TrendingUp,
  Filter,
  Grid,
  List,
  ChevronRight,
  Play,
  Settings,
  Code,
  Layers,
  Globe,
  Terminal,
  BookOpen,
  Users,
  Plus,
  Check,
  X,
  AlertTriangle,
  Info,
  Loader2,
  Download,
  ExternalLink,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
  ArrowRight,
  Sparkles,
  Rocket,
  Target,
  Cpu,
  HardDrive,
  Activity,
  Lock,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  title: string;
  description: string;
  type: 'service' | 'website' | 'library' | 'documentation' | 'infrastructure';
  tags: string[];
  owner: string;
  icon?: string;
  spec: {
    owner: string;
    type: string;
    parameters: TemplateParameter[];
    steps: TemplateStep[];
  };
  metadata: {
    version: string;
    lastUpdated: string;
    downloads: number;
    rating: number;
    reviews: number;
  };
  featured?: boolean;
  verified?: boolean;
}

interface TemplateParameter {
  title: string;
  required?: string[];
  properties: Record<string, {
    title: string;
    type: string;
    description?: string;
    default?: any;
    enum?: string[];
    enumNames?: string[];
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    'ui:widget'?: string;
    'ui:options'?: any;
    'ui:help'?: string;
    'ui:placeholder'?: string;
    'ui:autofocus'?: boolean;
  }>;
}

interface TemplateStep {
  id: string;
  name: string;
  action: string;
  input?: Record<string, any>;
  if?: string;
}

interface ExecutionTask {
  id: string;
  template: Template;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  logs: string[];
  output?: {
    entityRef?: string;
    remoteUrl?: string;
    catalogInfoUrl?: string;
  };
  createdAt: string;
  completedAt?: string;
}

const TEMPLATE_ICONS: Record<string, any> = {
  service: Package,
  website: Globe,
  library: BookOpen,
  documentation: FileText,
  infrastructure: Shield,
};

export default function ScaffolderPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [executionTasks, setExecutionTasks] = useState<ExecutionTask[]>([]);
  const [activeTask, setActiveTask] = useState<ExecutionTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'templates' | 'tasks' | 'custom'>('templates');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTemplates();
    loadExecutionTasks();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockTemplates: Template[] = [
      {
        id: 'react-app',
        name: 'react-app',
        title: 'React Application',
        description: 'Create a new React application with TypeScript, testing, and CI/CD',
        type: 'website',
        tags: ['react', 'typescript', 'frontend', 'spa'],
        owner: 'team:frontend',
        featured: true,
        verified: true,
        spec: {
          owner: 'team:frontend',
          type: 'website',
          parameters: [
            {
              title: 'Basic Information',
              required: ['name', 'description'],
              properties: {
                name: {
                  title: 'Name',
                  type: 'string',
                  description: 'Unique name for the application',
                  pattern: '^([a-z][a-z0-9-]*)$',
                  minLength: 3,
                  maxLength: 50,
                  'ui:autofocus': true,
                  'ui:help': 'Must be lowercase letters, numbers, and hyphens only',
                },
                description: {
                  title: 'Description',
                  type: 'string',
                  description: 'What does this application do?',
                },
                owner: {
                  title: 'Owner',
                  type: 'string',
                  description: 'Owner of the repository',
                  default: 'team:frontend',
                  'ui:widget': 'OwnerPicker',
                },
              },
            },
            {
              title: 'Choose Features',
              properties: {
                features: {
                  title: 'Features',
                  type: 'array',
                  description: 'Select features to include',
                  default: ['router', 'stateManagement'],
                  'ui:widget': 'checkboxes',
                  enum: ['router', 'stateManagement', 'testing', 'storybook', 'docker'],
                  enumNames: ['React Router', 'State Management', 'Testing Setup', 'Storybook', 'Docker'],
                },
                stateManagement: {
                  title: 'State Management',
                  type: 'string',
                  description: 'Choose state management library',
                  default: 'redux',
                  enum: ['redux', 'mobx', 'zustand', 'context'],
                  enumNames: ['Redux Toolkit', 'MobX', 'Zustand', 'Context API'],
                },
              },
            },
            {
              title: 'Infrastructure',
              properties: {
                repoUrl: {
                  title: 'Repository Location',
                  type: 'string',
                  'ui:widget': 'RepoUrlPicker',
                  'ui:options': {
                    requestUserCredentials: {
                      secretsKey: 'USER_OAUTH_TOKEN',
                    },
                  },
                },
                ci: {
                  title: 'CI/CD Pipeline',
                  type: 'string',
                  default: 'github-actions',
                  enum: ['github-actions', 'gitlab-ci', 'jenkins', 'none'],
                  enumNames: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'None'],
                },
              },
            },
          ],
          steps: [
            {
              id: 'fetch',
              name: 'Fetch Base',
              action: 'fetch:template',
              input: {
                url: './template',
                values: {
                  name: '{{ parameters.name }}',
                  description: '{{ parameters.description }}',
                  owner: '{{ parameters.owner }}',
                },
              },
            },
            {
              id: 'publish',
              name: 'Publish to GitHub',
              action: 'publish:github',
              input: {
                repoUrl: '{{ parameters.repoUrl }}',
                description: 'This is {{ parameters.name }}',
                defaultBranch: 'main',
                gitCommitMessage: 'Initial commit',
              },
            },
            {
              id: 'register',
              name: 'Register in Catalog',
              action: 'catalog:register',
              input: {
                repoContentsUrl: '{{ steps.publish.output.repoContentsUrl }}',
                catalogInfoPath: '/catalog-info.yaml',
              },
            },
          ],
        },
        metadata: {
          version: '1.2.0',
          lastUpdated: new Date(Date.now() - 86400000).toISOString(),
          downloads: 1543,
          rating: 4.8,
          reviews: 67,
        },
      },
      {
        id: 'nodejs-service',
        name: 'nodejs-service',
        title: 'Node.js Service',
        description: 'Create a production-ready Node.js microservice with Express',
        type: 'service',
        tags: ['nodejs', 'express', 'backend', 'api'],
        owner: 'team:backend',
        featured: true,
        verified: true,
        spec: {
          owner: 'team:backend',
          type: 'service',
          parameters: [
            {
              title: 'Service Details',
              required: ['name', 'description', 'port'],
              properties: {
                name: {
                  title: 'Service Name',
                  type: 'string',
                  pattern: '^([a-z][a-z0-9-]*)$',
                },
                description: {
                  title: 'Description',
                  type: 'string',
                },
                port: {
                  title: 'Port',
                  type: 'number',
                  default: 3000,
                },
                database: {
                  title: 'Database',
                  type: 'string',
                  default: 'postgresql',
                  enum: ['postgresql', 'mongodb', 'mysql', 'none'],
                },
              },
            },
          ],
          steps: [],
        },
        metadata: {
          version: '2.0.0',
          lastUpdated: new Date(Date.now() - 172800000).toISOString(),
          downloads: 2156,
          rating: 4.9,
          reviews: 89,
        },
      },
      {
        id: 'python-ml',
        name: 'python-ml',
        title: 'Python ML Service',
        description: 'Machine learning service template with FastAPI and scikit-learn',
        type: 'service',
        tags: ['python', 'ml', 'fastapi', 'ai'],
        owner: 'team:data',
        verified: true,
        spec: {
          owner: 'team:data',
          type: 'service',
          parameters: [],
          steps: [],
        },
        metadata: {
          version: '1.0.0',
          lastUpdated: new Date(Date.now() - 259200000).toISOString(),
          downloads: 876,
          rating: 4.7,
          reviews: 34,
        },
      },
      {
        id: 'terraform-module',
        name: 'terraform-module',
        title: 'Terraform Module',
        description: 'Create a reusable Terraform module for infrastructure',
        type: 'infrastructure',
        tags: ['terraform', 'iac', 'aws', 'cloud'],
        owner: 'team:platform',
        spec: {
          owner: 'team:platform',
          type: 'infrastructure',
          parameters: [],
          steps: [],
        },
        metadata: {
          version: '1.1.0',
          lastUpdated: new Date(Date.now() - 345600000).toISOString(),
          downloads: 543,
          rating: 4.6,
          reviews: 23,
        },
      },
      {
        id: 'docs-site',
        name: 'docs-site',
        title: 'Documentation Site',
        description: 'Create a documentation site with Docusaurus',
        type: 'documentation',
        tags: ['docs', 'docusaurus', 'markdown'],
        owner: 'team:docs',
        spec: {
          owner: 'team:docs',
          type: 'documentation',
          parameters: [],
          steps: [],
        },
        metadata: {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          downloads: 321,
          rating: 4.5,
          reviews: 12,
        },
      },
    ];
    
    setTemplates(mockTemplates);
    setLoading(false);
  };

  const loadExecutionTasks = () => {
    // Load from localStorage
    const saved = localStorage.getItem('scaffolder-tasks');
    if (saved) {
      setExecutionTasks(JSON.parse(saved));
    }
  };

  const saveExecutionTasks = (tasks: ExecutionTask[]) => {
    localStorage.setItem('scaffolder-tasks', JSON.stringify(tasks));
    setExecutionTasks(tasks);
  };

  const executeTemplate = async (template: Template, parameters: Record<string, any>) => {
    const task: ExecutionTask = {
      id: `task-${Date.now()}`,
      template,
      parameters,
      status: 'running',
      progress: 0,
      logs: [`Starting execution of template: ${template.title}`],
      createdAt: new Date().toISOString(),
    };
    
    setActiveTask(task);
    const updatedTasks = [task, ...executionTasks];
    saveExecutionTasks(updatedTasks);
    
    // Simulate template execution
    for (let i = 0; i < template.spec.steps.length; i++) {
      const step = template.spec.steps[i];
      task.currentStep = step.name;
      task.progress = ((i + 1) / template.spec.steps.length) * 100;
      task.logs.push(`Executing step: ${step.name}`);
      
      // Update task
      const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
      updatedTasks[taskIndex] = { ...task };
      saveExecutionTasks(updatedTasks);
      
      // Simulate step execution
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Complete task
    task.status = 'completed';
    task.progress = 100;
    task.completedAt = new Date().toISOString();
    task.logs.push('Template execution completed successfully!');
    task.output = {
      entityRef: `component:default/${parameters.name}`,
      remoteUrl: `https://github.com/example/${parameters.name}`,
      catalogInfoUrl: `https://github.com/example/${parameters.name}/blob/main/catalog-info.yaml`,
    };
    
    const finalIndex = updatedTasks.findIndex(t => t.id === task.id);
    updatedTasks[finalIndex] = { ...task };
    saveExecutionTasks(updatedTasks);
    
    return task;
  };

  const validateForm = (parameter: TemplateParameter): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;
    
    parameter.required?.forEach(field => {
      if (!formData[field]) {
        errors[field] = `${parameter.properties[field].title} is required`;
        isValid = false;
      }
    });
    
    Object.entries(parameter.properties).forEach(([key, prop]) => {
      const value = formData[key];
      
      if (value && prop.pattern) {
        const regex = new RegExp(prop.pattern);
        if (!regex.test(value)) {
          errors[key] = prop['ui:help'] || 'Invalid format';
          isValid = false;
        }
      }
      
      if (value && prop.minLength && value.length < prop.minLength) {
        errors[key] = `Must be at least ${prop.minLength} characters`;
        isValid = false;
      }
      
      if (value && prop.maxLength && value.length > prop.maxLength) {
        errors[key] = `Must be at most ${prop.maxLength} characters`;
        isValid = false;
      }
    });
    
    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    
    setShowCreateDialog(false);
    const task = await executeTemplate(selectedTemplate, formData);
    setActiveTab('tasks');
    router.push('#tasks');
  };

  const filteredTemplates = templates.filter(template => {
    if (searchQuery && !template.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !template.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return false;
    }
    if (filterType !== 'all' && template.type !== filterType) {
      return false;
    }
    if (filterOwner !== 'all' && template.owner !== filterOwner) {
      return false;
    }
    return true;
  });

  const uniqueOwners = Array.from(new Set(templates.map(t => t.owner)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Wand2 className="w-16 h-16 animate-pulse text-purple-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Templates
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching software templates...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Wand2 className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Software Templates</h1>
              <Badge className="ml-3 bg-white/20 text-white">
                {templates.length} Templates
              </Badge>
            </div>
            <p className="text-xl text-purple-100">
              Create new projects and components from pre-built templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="bg-white text-purple-600 hover:bg-purple-50"
              onClick={() => setActiveTab('custom')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Sparkles className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {templates.filter(t => t.featured).length}
                </div>
                <div className="text-sm text-purple-100">Featured</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Check className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {templates.filter(t => t.verified).length}
                </div>
                <div className="text-sm text-purple-100">Verified</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Download className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {templates.reduce((sum, t) => sum + t.metadata.downloads, 0)}
                </div>
                <div className="text-sm text-purple-100">Total Uses</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Activity className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{executionTasks.length}</div>
                <div className="text-sm text-purple-100">Tasks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
          
          {activeTab === 'templates' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="library">Library</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex rounded-lg border">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <TabsContent value="templates">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => {
                const Icon = TEMPLATE_ICONS[template.type] || Package;
                return (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setFormData({});
                      setCurrentStep(0);
                      setShowCreateDialog(true);
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <Icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{template.title}</CardTitle>
                            {template.featured && (
                              <Badge variant="secondary" className="mt-1">Featured</Badge>
                            )}
                          </div>
                        </div>
                        {template.verified && (
                          <Badge variant="outline" className="bg-green-50">
                            <Check className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-2">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Owner</span>
                          <Badge variant="outline">{template.owner}</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Version</span>
                          <span>{template.metadata.version}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {template.metadata.downloads}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {template.metadata.rating}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {template.metadata.reviews}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map(template => {
                const Icon = TEMPLATE_ICONS[template.type] || Package;
                return (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setFormData({});
                      setCurrentStep(0);
                      setShowCreateDialog(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <Icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{template.title}</h3>
                              {template.featured && (
                                <Badge variant="secondary">Featured</Badge>
                              )}
                              {template.verified && (
                                <Badge variant="outline" className="bg-green-50">
                                  <Check className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{template.owner}</span>
                              <span>•</span>
                              <span>v{template.metadata.version}</span>
                              <span>•</span>
                              <span>{template.metadata.downloads} uses</span>
                              <span>•</span>
                              <span>★ {template.metadata.rating}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {executionTasks.length > 0 ? (
            <div className="space-y-4">
              {executionTasks.map(task => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          task.status === 'completed' ? "bg-green-100 dark:bg-green-900" :
                          task.status === 'failed' ? "bg-red-100 dark:bg-red-900" :
                          task.status === 'running' ? "bg-blue-100 dark:bg-blue-900" :
                          "bg-gray-100 dark:bg-gray-700"
                        )}>
                          {task.status === 'completed' ? <Check className="h-5 w-5 text-green-600" /> :
                           task.status === 'failed' ? <X className="h-5 w-5 text-red-600" /> :
                           task.status === 'running' ? <Loader2 className="h-5 w-5 text-blue-600 animate-spin" /> :
                           <Clock className="h-5 w-5 text-gray-600" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{task.template.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {task.parameters.name || 'Unnamed'} • {new Date(task.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTask(task)}
                      >
                        View Details
                      </Button>
                    </div>
                    
                    {task.status === 'running' && (
                      <>
                        <Progress value={task.progress} className="h-2 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {task.currentStep || 'Initializing...'}
                        </p>
                      </>
                    )}
                    
                    {task.status === 'completed' && task.output && (
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" asChild>
                          <a href={task.output.remoteUrl} target="_blank" rel="noopener noreferrer">
                            <GitBranch className="h-4 w-4 mr-2" />
                            View Repository
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={task.output.catalogInfoUrl} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4 mr-2" />
                            View Catalog
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Tasks Yet</h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Create your first project from a template
                </p>
                <Button onClick={() => setActiveTab('templates')}>
                  Browse Templates
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom">
          <Card>
            <CardHeader>
              <CardTitle>Create Custom Template</CardTitle>
              <CardDescription>
                Build your own software template for others to use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Template Editor</AlertTitle>
                <AlertDescription>
                  The template editor allows you to create custom software templates with parameters, steps, and actions.
                  Templates are defined using YAML and can integrate with various tools and services.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 text-center">
                <Button>
                  <Edit className="h-4 w-4 mr-2" />
                  Open Template Editor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create from Template Dialog */}
      {selectedTemplate && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.title}</DialogTitle>
              <DialogDescription>
                {selectedTemplate.description}
              </DialogDescription>
            </DialogHeader>
            
            {selectedTemplate.spec.parameters.length > 0 && (
              <div className="space-y-6">
                {/* Progress indicator */}
                <div className="flex items-center justify-between mb-4">
                  {selectedTemplate.spec.parameters.map((param, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center",
                        idx < selectedTemplate.spec.parameters.length - 1 && "flex-1"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        idx <= currentStep
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 text-gray-500"
                      )}>
                        {idx + 1}
                      </div>
                      {idx < selectedTemplate.spec.parameters.length - 1 && (
                        <div className={cn(
                          "flex-1 h-0.5 mx-2",
                          idx < currentStep ? "bg-purple-600" : "bg-gray-200"
                        )} />
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Current step form */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    {selectedTemplate.spec.parameters[currentStep].title}
                  </h3>
                  
                  <div className="space-y-4">
                    {Object.entries(selectedTemplate.spec.parameters[currentStep].properties).map(([key, prop]) => (
                      <div key={key}>
                        <Label htmlFor={key}>
                          {prop.title}
                          {selectedTemplate.spec.parameters[currentStep].required?.includes(key) && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </Label>
                        {prop.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {prop.description}
                          </p>
                        )}
                        
                        {prop.type === 'string' && prop.enum ? (
                          <Select
                            value={formData[key] || prop.default || ''}
                            onValueChange={(value) => setFormData({ ...formData, [key]: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${prop.title.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {prop.enum.map((option, idx) => (
                                <SelectItem key={option} value={option}>
                                  {prop.enumNames?.[idx] || option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : prop.type === 'array' ? (
                          <div className="space-y-2">
                            {prop.enum?.map((option, idx) => (
                              <div key={option} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`${key}-${option}`}
                                  checked={(formData[key] || prop.default || []).includes(option)}
                                  onChange={(e) => {
                                    const current = formData[key] || prop.default || [];
                                    if (e.target.checked) {
                                      setFormData({ ...formData, [key]: [...current, option] });
                                    } else {
                                      setFormData({ ...formData, [key]: current.filter((v: string) => v !== option) });
                                    }
                                  }}
                                  className="rounded"
                                />
                                <Label htmlFor={`${key}-${option}`}>
                                  {prop.enumNames?.[idx] || option}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : prop.type === 'number' ? (
                          <Input
                            id={key}
                            type="number"
                            value={formData[key] || prop.default || ''}
                            onChange={(e) => setFormData({ ...formData, [key]: parseInt(e.target.value) })}
                            placeholder={prop['ui:placeholder']}
                          />
                        ) : (
                          <Input
                            id={key}
                            value={formData[key] || prop.default || ''}
                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            placeholder={prop['ui:placeholder']}
                            autoFocus={prop['ui:autofocus']}
                          />
                        )}
                        
                        {prop['ui:help'] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {prop['ui:help']}
                          </p>
                        )}
                        
                        {validationErrors[key] && (
                          <p className="text-xs text-red-500 mt-1">
                            {validationErrors[key]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Previous
                </Button>
              )}
              {currentStep < selectedTemplate.spec.parameters.length - 1 ? (
                <Button
                  onClick={() => {
                    if (validateForm(selectedTemplate.spec.parameters[currentStep])) {
                      setCurrentStep(currentStep + 1);
                    }
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (validateForm(selectedTemplate.spec.parameters[currentStep])) {
                      handleSubmit();
                    }
                  }}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Create
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Task Details Dialog */}
      {activeTask && (
        <Dialog open={!!activeTask} onOpenChange={() => setActiveTask(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Task Details</DialogTitle>
              <DialogDescription>
                {activeTask.template.title} - {activeTask.parameters.name || 'Unnamed'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    activeTask.status === 'completed' ? "bg-green-100 dark:bg-green-900" :
                    activeTask.status === 'failed' ? "bg-red-100 dark:bg-red-900" :
                    activeTask.status === 'running' ? "bg-blue-100 dark:bg-blue-900" :
                    "bg-gray-100 dark:bg-gray-700"
                  )}>
                    {activeTask.status === 'completed' ? <Check className="h-5 w-5 text-green-600" /> :
                     activeTask.status === 'failed' ? <X className="h-5 w-5 text-red-600" /> :
                     activeTask.status === 'running' ? <Loader2 className="h-5 w-5 text-blue-600 animate-spin" /> :
                     <Clock className="h-5 w-5 text-gray-600" />}
                  </div>
                  <div>
                    <p className="font-medium">Status: {activeTask.status}</p>
                    <p className="text-sm text-muted-foreground">
                      Started: {new Date(activeTask.createdAt).toLocaleString()}
                    </p>
                    {activeTask.completedAt && (
                      <p className="text-sm text-muted-foreground">
                        Completed: {new Date(activeTask.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                
                {activeTask.status === 'running' && (
                  <div className="text-right">
                    <p className="text-sm font-medium mb-1">{activeTask.progress}%</p>
                    <Progress value={activeTask.progress} className="w-32 h-2" />
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Parameters</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify(activeTask.parameters, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Execution Logs</h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {activeTask.logs.map((log, idx) => (
                    <div key={idx} className="font-mono text-xs mb-1">
                      [{new Date().toISOString()}] {log}
                    </div>
                  ))}
                </div>
              </div>
              
              {activeTask.output && (
                <div>
                  <h4 className="font-medium mb-2">Output</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href={activeTask.output.remoteUrl} target="_blank" rel="noopener noreferrer">
                        <GitBranch className="h-4 w-4 mr-2" />
                        Repository: {activeTask.output.remoteUrl}
                        <ExternalLink className="h-4 w-4 ml-auto" />
                      </a>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href={activeTask.output.catalogInfoUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        Catalog Info: {activeTask.output.catalogInfoUrl}
                        <ExternalLink className="h-4 w-4 ml-auto" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}