/**
 * Visual Template Designer - No-Code Template Creation & Code Generation
 * Advanced template designer with live preview and intelligent code generation
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Code2, 
  Palette, 
  Eye, 
  Download, 
  Upload, 
  Save, 
  Play, 
  Settings, 
  Sparkles,
  FileText,
  Database,
  Server,
  Globe,
  GitBranch,
  Layers,
  Box,
  Zap,
  Shield,
  Monitor,
  Package,
  Terminal
} from 'lucide-react';

// Template configuration interfaces
interface TemplateField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'object' | 'array';
  label: string;
  description: string;
  required: boolean;
  default?: any;
  options?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  ui: {
    widget: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'slider' | 'file' | 'code' | 'color' | 'date';
    placeholder?: string;
    help?: string;
    group?: string;
    order?: number;
    conditional?: {
      field: string;
      value: any;
    };
  };
}

interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  technology: string;
  framework?: string;
  language: string;
  files: Array<{
    path: string;
    template: string;
    type: 'text' | 'binary';
    executable?: boolean;
  }>;
  dependencies?: string[];
  scripts?: Record<string, string>;
  environment?: Record<string, string>;
  metadata: {
    author: string;
    version: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  };
}

interface GeneratedProject {
  name: string;
  files: Array<{
    path: string;
    content: string;
    type: string;
  }>;
  dependencies: string[];
  scripts: Record<string, string>;
  environment: Record<string, string>;
  commands: string[];
}

// Predefined template categories
const templateCategories = [
  {
    id: 'web-services',
    name: 'Web Services',
    icon: Globe,
    templates: ['express-api', 'nestjs-api', 'fastify-api', 'graphql-api', 'nextjs-app']
  },
  {
    id: 'microservices',
    name: 'Microservices',
    icon: Box,
    templates: ['grpc-service', 'event-driven-service', 'saga-orchestrator', 'cqrs-service']
  },
  {
    id: 'data-services',
    name: 'Data Services',
    icon: Database,
    templates: ['postgres-service', 'mongodb-service', 'redis-cache', 'elasticsearch-search']
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    icon: Server,
    templates: ['kubernetes-deployment', 'docker-compose', 'terraform-aws', 'helm-chart']
  },
  {
    id: 'serverless',
    name: 'Serverless',
    icon: Zap,
    templates: ['lambda-function', 'azure-function', 'vercel-function', 'cloudflare-worker']
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    icon: Monitor,
    templates: ['prometheus-config', 'grafana-dashboard', 'jaeger-tracing', 'elk-stack']
  }
];

// Built-in templates
const builtInTemplates: Record<string, CodeTemplate> = {
  'express-api': {
    id: 'express-api',
    name: 'Express.js API',
    description: 'RESTful API with Express.js and TypeScript',
    category: 'web-services',
    technology: 'Node.js',
    framework: 'Express',
    language: 'typescript',
    files: [
      {
        path: 'package.json',
        template: `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0"
    {{#if database}},
    "{{database}}": "latest"{{/if}}
    {{#if auth}},
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3"{{/if}}
  },
  "devDependencies": {
    "@types/node": "^20.4.0",
    "@types/express": "^4.17.17",
    "typescript": "^5.1.6",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.6.1"
  }
}`,
        type: 'text'
      },
      {
        path: 'src/index.ts',
        template: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || {{port}};

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: '{{name}}',
    timestamp: new Date().toISOString()
  });
});

{{#if crud}}
// CRUD Routes
app.get('/api/{{resource}}', (req, res) => {
  // Get all {{resource}}
  res.json({ message: 'Get all {{resource}}' });
});

app.get('/api/{{resource}}/:id', (req, res) => {
  // Get single {{resource}}
  res.json({ message: \`Get {{resource}} \${req.params.id}\` });
});

app.post('/api/{{resource}}', (req, res) => {
  // Create {{resource}}
  res.json({ message: 'Create {{resource}}', data: req.body });
});

app.put('/api/{{resource}}/:id', (req, res) => {
  // Update {{resource}}
  res.json({ message: \`Update {{resource}} \${req.params.id}\`, data: req.body });
});

app.delete('/api/{{resource}}/:id', (req, res) => {
  // Delete {{resource}}
  res.json({ message: \`Delete {{resource}} \${req.params.id}\` });
});
{{/if}}

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
});`,
        type: 'text'
      },
      {
        path: 'tsconfig.json',
        template: `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,
        type: 'text'
      },
      {
        path: 'Dockerfile',
        template: `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE {{port}}

USER node

CMD ["npm", "start"]`,
        type: 'text'
      },
      {
        path: '.gitignore',
        template: `node_modules/
dist/
.env
.env.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store`,
        type: 'text'
      }
    ],
    dependencies: ['express', 'cors', 'helmet', 'morgan'],
    scripts: {
      'dev': 'ts-node-dev --respawn --transpile-only src/index.ts',
      'build': 'tsc',
      'start': 'node dist/index.js'
    },
    environment: {
      'PORT': '3000',
      'NODE_ENV': 'development'
    },
    metadata: {
      author: 'System',
      version: '1.0.0',
      tags: ['api', 'express', 'typescript', 'rest'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },
  'kubernetes-deployment': {
    id: 'kubernetes-deployment',
    name: 'Kubernetes Deployment',
    description: 'Complete Kubernetes deployment with service and ingress',
    category: 'infrastructure',
    technology: 'Kubernetes',
    language: 'yaml',
    files: [
      {
        path: 'deployment.yaml',
        template: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{name}}
  labels:
    app: {{name}}
    version: "{{version}}"
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{name}}
  template:
    metadata:
      labels:
        app: {{name}}
        version: "{{version}}"
    spec:
      containers:
      - name: {{name}}
        image: {{image}}:{{imageTag}}
        ports:
        - containerPort: {{port}}
        env:
        - name: PORT
          value: "{{port}}"
        {{#if secrets}}
        envFrom:
        - secretRef:
            name: {{name}}-secrets
        {{/if}}
        resources:
          requests:
            memory: "{{memoryRequest}}"
            cpu: "{{cpuRequest}}"
          limits:
            memory: "{{memoryLimit}}"
            cpu: "{{cpuLimit}}"
        {{#if healthCheck}}
        livenessProbe:
          httpGet:
            path: /health
            port: {{port}}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: {{port}}
          initialDelaySeconds: 5
          periodSeconds: 5
        {{/if}}`,
        type: 'text'
      },
      {
        path: 'service.yaml',
        template: `apiVersion: v1
kind: Service
metadata:
  name: {{name}}-service
  labels:
    app: {{name}}
spec:
  selector:
    app: {{name}}
  ports:
  - port: 80
    targetPort: {{port}}
    protocol: TCP
  type: {{serviceType}}`,
        type: 'text'
      }
    ],
    dependencies: [],
    scripts: {
      'deploy': 'kubectl apply -f .',
      'delete': 'kubectl delete -f .'
    },
    environment: {},
    metadata: {
      author: 'System',
      version: '1.0.0',
      tags: ['kubernetes', 'deployment', 'infrastructure'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
};

export function VisualTemplateDesigner() {
  const [selectedCategory, setSelectedCategory] = useState('web-services');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);
  const [activeTab, setActiveTab] = useState('design');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Initialize template fields based on selected template
  useEffect(() => {
    if (selectedTemplate && builtInTemplates[selectedTemplate]) {
      const template = builtInTemplates[selectedTemplate];
      const fields = generateFieldsFromTemplate(template);
      setTemplateFields(fields);
      setFieldValues(getDefaultValues(fields));
    }
  }, [selectedTemplate]);

  const generateFieldsFromTemplate = (template: CodeTemplate): TemplateField[] => {
    const commonFields: TemplateField[] = [
      {
        id: 'name',
        name: 'name',
        type: 'string',
        label: 'Project Name',
        description: 'Name of the project/service',
        required: true,
        default: template.name.toLowerCase().replace(/\s+/g, '-'),
        validation: { pattern: '^[a-z0-9-]+$' },
        ui: {
          widget: 'input',
          placeholder: 'my-awesome-project',
          help: 'Use lowercase letters, numbers, and hyphens only',
          group: 'basic',
          order: 1
        }
      },
      {
        id: 'description',
        name: 'description',
        type: 'string',
        label: 'Description',
        description: 'Brief description of the project',
        required: true,
        default: template.description,
        ui: {
          widget: 'textarea',
          placeholder: 'Describe your project...',
          group: 'basic',
          order: 2
        }
      },
      {
        id: 'version',
        name: 'version',
        type: 'string',
        label: 'Version',
        description: 'Project version',
        required: false,
        default: '1.0.0',
        ui: {
          widget: 'input',
          placeholder: '1.0.0',
          group: 'basic',
          order: 3
        }
      }
    ];

    // Add template-specific fields based on category and technology
    const specificFields: TemplateField[] = [];

    if (template.category === 'web-services') {
      specificFields.push(
        {
          id: 'port',
          name: 'port',
          type: 'number',
          label: 'Port',
          description: 'Server port number',
          required: true,
          default: 3000,
          validation: { min: 1024, max: 65535 },
          ui: {
            widget: 'input',
            help: 'Port number between 1024 and 65535',
            group: 'server',
            order: 10
          }
        },
        {
          id: 'database',
          name: 'database',
          type: 'select',
          label: 'Database',
          description: 'Database to include',
          required: false,
          options: ['none', 'postgresql', 'mysql', 'mongodb', 'redis'],
          default: 'none',
          ui: {
            widget: 'select',
            group: 'features',
            order: 20
          }
        },
        {
          id: 'auth',
          name: 'auth',
          type: 'boolean',
          label: 'Authentication',
          description: 'Include JWT authentication',
          required: false,
          default: false,
          ui: {
            widget: 'checkbox',
            group: 'features',
            order: 21
          }
        },
        {
          id: 'crud',
          name: 'crud',
          type: 'boolean',
          label: 'CRUD Operations',
          description: 'Generate basic CRUD endpoints',
          required: false,
          default: false,
          ui: {
            widget: 'checkbox',
            group: 'features',
            order: 22
          }
        }
      );

      // Add resource field if CRUD is enabled
      specificFields.push({
        id: 'resource',
        name: 'resource',
        type: 'string',
        label: 'Resource Name',
        description: 'Name of the resource for CRUD operations',
        required: false,
        default: 'users',
        ui: {
          widget: 'input',
          placeholder: 'users',
          group: 'features',
          order: 23,
          conditional: { field: 'crud', value: true }
        }
      });
    }

    if (template.category === 'infrastructure') {
      specificFields.push(
        {
          id: 'image',
          name: 'image',
          type: 'string',
          label: 'Container Image',
          description: 'Docker image name',
          required: true,
          default: 'nginx',
          ui: {
            widget: 'input',
            placeholder: 'my-app',
            group: 'container',
            order: 10
          }
        },
        {
          id: 'imageTag',
          name: 'imageTag',
          type: 'string',
          label: 'Image Tag',
          description: 'Docker image tag',
          required: true,
          default: 'latest',
          ui: {
            widget: 'input',
            group: 'container',
            order: 11
          }
        },
        {
          id: 'replicas',
          name: 'replicas',
          type: 'number',
          label: 'Replicas',
          description: 'Number of pod replicas',
          required: true,
          default: 3,
          validation: { min: 1, max: 10 },
          ui: {
            widget: 'slider',
            group: 'scaling',
            order: 20
          }
        },
        {
          id: 'serviceType',
          name: 'serviceType',
          type: 'select',
          label: 'Service Type',
          description: 'Kubernetes service type',
          required: true,
          options: ['ClusterIP', 'NodePort', 'LoadBalancer'],
          default: 'ClusterIP',
          ui: {
            widget: 'select',
            group: 'networking',
            order: 30
          }
        },
        {
          id: 'memoryRequest',
          name: 'memoryRequest',
          type: 'string',
          label: 'Memory Request',
          description: 'Memory resource request',
          required: true,
          default: '128Mi',
          ui: {
            widget: 'input',
            group: 'resources',
            order: 40
          }
        },
        {
          id: 'memoryLimit',
          name: 'memoryLimit',
          type: 'string',
          label: 'Memory Limit',
          description: 'Memory resource limit',
          required: true,
          default: '256Mi',
          ui: {
            widget: 'input',
            group: 'resources',
            order: 41
          }
        },
        {
          id: 'cpuRequest',
          name: 'cpuRequest',
          type: 'string',
          label: 'CPU Request',
          description: 'CPU resource request',
          required: true,
          default: '100m',
          ui: {
            widget: 'input',
            group: 'resources',
            order: 42
          }
        },
        {
          id: 'cpuLimit',
          name: 'cpuLimit',
          type: 'string',
          label: 'CPU Limit',
          description: 'CPU resource limit',
          required: true,
          default: '200m',
          ui: {
            widget: 'input',
            group: 'resources',
            order: 43
          }
        },
        {
          id: 'healthCheck',
          name: 'healthCheck',
          type: 'boolean',
          label: 'Health Checks',
          description: 'Enable liveness and readiness probes',
          required: false,
          default: true,
          ui: {
            widget: 'checkbox',
            group: 'features',
            order: 50
          }
        }
      );
    }

    return [...commonFields, ...specificFields];
  };

  const getDefaultValues = (fields: TemplateField[]): Record<string, any> => {
    const defaults: Record<string, any> = {};
    fields.forEach(field => {
      defaults[field.name] = field.default;
    });
    return defaults;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const generateProject = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    
    try {
      const template = builtInTemplates[selectedTemplate];
      const project = await processTemplate(template, fieldValues);
      setGeneratedProject(project);
      setActiveTab('preview');
    } catch (error) {
      console.error('Failed to generate project:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const processTemplate = async (template: CodeTemplate, values: Record<string, any>): Promise<GeneratedProject> => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    const processedFiles = template.files.map(file => ({
      path: file.path,
      content: renderTemplate(file.template, values),
      type: file.type
    }));

    return {
      name: values.name || template.name,
      files: processedFiles,
      dependencies: template.dependencies || [],
      scripts: template.scripts || {},
      environment: template.environment || {},
      commands: generateSetupCommands(template, values)
    };
  };

  const renderTemplate = (template: string, values: Record<string, any>): string => {
    // Simple Handlebars-like template processing
    let result = template;

    // Replace simple variables
    Object.entries(values).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    });

    // Process conditionals
    result = result.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
      return values[condition] ? content : '';
    });

    return result;
  };

  const generateSetupCommands = (template: CodeTemplate, values: Record<string, any>): string[] => {
    const commands: string[] = [];

    if (template.language === 'typescript' || template.technology === 'Node.js') {
      commands.push('npm install');
      if (template.scripts?.dev) {
        commands.push('npm run dev');
      }
    }

    if (template.category === 'infrastructure') {
      if (template.technology === 'Kubernetes') {
        commands.push('kubectl apply -f .');
      }
      if (template.files.some(f => f.path === 'docker-compose.yml')) {
        commands.push('docker-compose up -d');
      }
    }

    return commands;
  };

  const downloadProject = () => {
    if (!generatedProject) return;

    // In a real implementation, this would create a ZIP file
    console.log('Downloading project:', generatedProject.name);
    alert('Project download would start here (ZIP file creation)');
  };

  const groupFields = (fields: TemplateField[]): Record<string, TemplateField[]> => {
    const groups: Record<string, TemplateField[]> = {};
    
    fields.forEach(field => {
      const group = field.ui.group || 'general';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(field);
    });

    // Sort fields within groups by order
    Object.keys(groups).forEach(group => {
      groups[group].sort((a, b) => (a.ui.order || 0) - (b.ui.order || 0));
    });

    return groups;
  };

  const shouldShowField = (field: TemplateField): boolean => {
    if (!field.ui.conditional) return true;
    
    const conditionValue = fieldValues[field.ui.conditional.field];
    return conditionValue === field.ui.conditional.value;
  };

  const renderField = (field: TemplateField) => {
    if (!shouldShowField(field)) return null;

    const value = fieldValues[field.name];

    switch (field.ui.widget) {
      case 'input':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type === 'number' ? 'number' : 'text'}
              value={value || ''}
              onChange={(e) => handleFieldChange(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
              placeholder={field.ui.placeholder}
            />
            {field.ui.help && (
              <p className="text-xs text-gray-500">{field.ui.help}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={value || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.ui.placeholder}
              rows={3}
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value || ''} onValueChange={(newValue) => handleFieldChange(field.name, newValue)}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Switch
              id={field.id}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        );

      case 'slider':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}: {value}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Slider
              id={field.id}
              min={field.validation?.min || 0}
              max={field.validation?.max || 100}
              step={1}
              value={[value || field.default || 0]}
              onValueChange={(values) => handleFieldChange(field.name, values[0])}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Template Selection */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-2">Template Designer</h2>
          <p className="text-sm text-gray-600">Create and customize project templates</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <h3 className="font-medium mb-3">Categories</h3>
            <div className="space-y-2 mb-6">
              {templateCategories.map(category => (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-colors ${
                    selectedCategory === category.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <category.icon className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="text-sm font-medium">{category.name}</div>
                        <div className="text-xs text-gray-500">{category.templates.length} templates</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <h3 className="font-medium mb-3">Templates</h3>
            <div className="space-y-2">
              {templateCategories
                .find(c => c.id === selectedCategory)
                ?.templates.filter(templateId => builtInTemplates[templateId])
                .map(templateId => {
                  const template = builtInTemplates[templateId];
                  return (
                    <Card
                      key={templateId}
                      className={`cursor-pointer transition-colors ${
                        selectedTemplate === templateId ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedTemplate(templateId)}
                    >
                      <CardContent className="p-3">
                        <div className="text-sm font-medium">{template.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                        <div className="flex gap-1 mt-2">
                          <Badge variant="secondary" className="text-xs">{template.technology}</Badge>
                          {template.framework && (
                            <Badge variant="outline" className="text-xs">{template.framework}</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              }
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">
              {selectedTemplate ? builtInTemplates[selectedTemplate]?.name : 'Select a Template'}
            </h1>
            {selectedTemplate && (
              <Badge variant="outline">
                {builtInTemplates[selectedTemplate]?.technology}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="w-4 h-4 mr-1" />
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
            <Button
              size="sm"
              onClick={generateProject}
              disabled={!selectedTemplate || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Code2 className="w-4 h-4 mr-1" />
                  Generate Project
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4 w-fit">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Generated Code</TabsTrigger>
          </TabsList>

          <TabsContent value="design" className="flex-1 p-4">
            {selectedTemplate && templateFields.length > 0 ? (
              <div className="max-w-2xl">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Template Configuration
                    </CardTitle>
                    <CardDescription>
                      Customize your {builtInTemplates[selectedTemplate]?.name} template
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {Object.entries(groupFields(templateFields)).map(([groupName, fields]) => (
                        <div key={groupName}>
                          <h4 className="font-medium text-sm uppercase tracking-wide text-gray-500 mb-3">
                            {groupName.replace(/([A-Z])/g, ' $1').trim()}
                          </h4>
                          <div className="space-y-4">
                            {fields.map(renderField)}
                          </div>
                          {groupName !== 'general' && <Separator className="mt-6" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <Palette className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Template</h3>
                <p className="text-gray-600">Choose a template from the sidebar to start customizing</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="flex-1">
            {generatedProject ? (
              <div className="flex h-full">
                {/* File Tree */}
                <div className="w-64 bg-white border-r border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Project Files</h3>
                    <Button size="sm" variant="outline" onClick={downloadProject}>
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                  <ScrollArea className="h-full">
                    <div className="space-y-1">
                      {generatedProject.files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          {file.path}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* File Content */}
                <div className="flex-1 p-4">
                  <Tabs defaultValue="files">
                    <TabsList>
                      <TabsTrigger value="files">Files</TabsTrigger>
                      <TabsTrigger value="scripts">Scripts</TabsTrigger>
                      <TabsTrigger value="setup">Setup</TabsTrigger>
                    </TabsList>

                    <TabsContent value="files" className="mt-4">
                      <ScrollArea className="h-96 w-full border rounded-md p-4">
                        {generatedProject.files.map((file, index) => (
                          <div key={index} className="mb-6">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4" />
                              <span className="font-mono text-sm">{file.path}</span>
                            </div>
                            <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                              <code>{file.content}</code>
                            </pre>
                          </div>
                        ))}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="scripts" className="mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Available Scripts</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {Object.entries(generatedProject.scripts).map(([script, command]) => (
                              <div key={script} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                                <div>
                                  <span className="font-mono text-sm">npm run {script}</span>
                                  <p className="text-xs text-gray-600 mt-1">{command}</p>
                                </div>
                                <Button size="sm" variant="outline">
                                  <Terminal className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="setup" className="mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Setup Instructions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-medium mb-2">Prerequisites</h4>
                              <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Node.js 18+ (for Node.js projects)</li>
                                <li>• Docker (for containerized deployments)</li>
                                <li>• kubectl (for Kubernetes deployments)</li>
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-medium mb-2">Setup Commands</h4>
                              <div className="space-y-2">
                                {generatedProject.commands.map((command, index) => (
                                  <div key={index} className="font-mono text-sm bg-gray-100 p-2 rounded">
                                    $ {command}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Code2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Generated</h3>
                <p className="text-gray-600">Configure your template and click "Generate Project" to see the preview</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="flex-1 p-4">
            {generatedProject ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Generated Code Files</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Copy className="w-4 h-4 mr-1" />
                      Copy All
                    </Button>
                    <Button size="sm" onClick={downloadProject}>
                      <Download className="w-4 h-4 mr-1" />
                      Download ZIP
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-96 w-full">
                  {generatedProject.files.map((file, index) => (
                    <Card key={index} className="mb-4">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono">{file.path}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                          <code>{file.content}</code>
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Code Generated</h3>
                <p className="text-gray-600">Generate a project to see the code files</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}