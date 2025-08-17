'use client';

import React, { useState, useEffect } from 'react';
import {
  Wand2, ChevronRight, ChevronLeft, CheckCircle, Clock, 
  Settings, Database, Shield, Zap, FileCheck2, PlayCircle,
  AlertCircle, Info, ExternalLink, Copy, Sparkles,
  ArrowRight, Target, Globe, Users, Terminal, Code,
  Rocket, Award, Package, GitBranch, RefreshCw, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  estimatedTime: string;
  requirements: string[];
  actions: SetupAction[];
}

interface SetupAction {
  id: string;
  type: 'auto-detect' | 'user-input' | 'selection' | 'configuration' | 'validation';
  label: string;
  description?: string;
  completed: boolean;
  data?: any;
}

interface PluginTemplate {
  id: string;
  name: string;
  category: 'core' | 'documentation' | 'monitoring' | 'ci-cd' | 'security' | 'custom';
  description: string;
  icon: React.ComponentType<any>;
  estimatedSetupTime: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  requiredServices: string[];
  popularityScore: number;
}

const PLUGIN_TEMPLATES: PluginTemplate[] = [
  {
    id: 'backstage-catalog',
    name: 'Software Catalog',
    category: 'core',
    description: 'Central service catalog for your software architecture',
    icon: Database,
    estimatedSetupTime: '5 minutes',
    complexity: 'beginner',
    requiredServices: ['PostgreSQL'],
    popularityScore: 95
  },
  {
    id: 'backstage-techdocs',
    name: 'TechDocs',
    category: 'documentation',
    description: 'Technical documentation platform with MkDocs integration',
    icon: FileCheck2,
    estimatedSetupTime: '8 minutes',
    complexity: 'intermediate',
    requiredServices: ['S3 Storage', 'MkDocs'],
    popularityScore: 88
  },
  {
    id: 'backstage-kubernetes',
    name: 'Kubernetes',
    category: 'monitoring',
    description: 'Monitor and manage your Kubernetes clusters',
    icon: Globe,
    estimatedSetupTime: '12 minutes',
    complexity: 'intermediate',
    requiredServices: ['Kubernetes API', 'Prometheus'],
    popularityScore: 82
  },
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    category: 'ci-cd',
    description: 'CI/CD pipeline integration with GitHub Actions',
    icon: Zap,
    estimatedSetupTime: '6 minutes',
    complexity: 'beginner',
    requiredServices: ['GitHub API'],
    popularityScore: 91
  },
  {
    id: 'sonarqube',
    name: 'SonarQube',
    category: 'security',
    description: 'Code quality and security analysis',
    icon: Shield,
    estimatedSetupTime: '10 minutes',
    complexity: 'intermediate',
    requiredServices: ['SonarQube Server'],
    popularityScore: 78
  },
  {
    id: 'custom-plugin',
    name: 'Custom Plugin',
    category: 'custom',
    description: 'Build a custom plugin from scratch with scaffolding',
    icon: Code,
    estimatedSetupTime: '20 minutes',
    complexity: 'advanced',
    requiredServices: ['Node.js', 'TypeScript'],
    popularityScore: 65
  }
];

export default function PluginSetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<PluginTemplate | null>(null);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoDetectionResults, setAutoDetectionResults] = useState<Record<string, any>>({});

  const wizardSteps = [
    'Choose Template',
    'Auto-Detection',
    'Configuration',
    'Validation',
    'Deployment'
  ];

  useEffect(() => {
    if (selectedTemplate) {
      generateSetupSteps(selectedTemplate);
    }
  }, [selectedTemplate]);

  const generateSetupSteps = async (template: PluginTemplate) => {
    setIsGenerating(true);
    
    // Simulate step generation based on template
    const steps: SetupStep[] = [
      {
        id: 'environment-detection',
        title: 'Environment Detection',
        description: 'Automatically detect your environment and dependencies',
        icon: Target,
        status: 'pending',
        estimatedTime: '2 minutes',
        requirements: ['Database connection', 'API endpoints', 'Authentication'],
        actions: [
          {
            id: 'detect-database',
            type: 'auto-detect',
            label: 'Detect database configuration',
            completed: false
          },
          {
            id: 'detect-auth',
            type: 'auto-detect',
            label: 'Detect authentication provider',
            completed: false
          },
          {
            id: 'check-dependencies',
            type: 'auto-detect',
            label: 'Check plugin dependencies',
            completed: false
          }
        ]
      },
      {
        id: 'configuration',
        title: 'Plugin Configuration',
        description: 'Configure plugin settings and integrations',
        icon: Settings,
        status: 'pending',
        estimatedTime: '3 minutes',
        requirements: ['Service credentials', 'Endpoints', 'Feature flags'],
        actions: [
          {
            id: 'basic-config',
            type: 'configuration',
            label: 'Basic plugin configuration',
            completed: false
          },
          {
            id: 'integration-config',
            type: 'configuration',
            label: 'External service integration',
            completed: false
          },
          {
            id: 'security-config',
            type: 'configuration',
            label: 'Security and permissions',
            completed: false
          }
        ]
      },
      {
        id: 'validation',
        title: 'Validation & Testing',
        description: 'Validate configuration and run health checks',
        icon: CheckCircle,
        status: 'pending',
        estimatedTime: '2 minutes',
        requirements: ['API connectivity', 'Permissions', 'Health endpoints'],
        actions: [
          {
            id: 'connectivity-test',
            type: 'validation',
            label: 'Test external service connectivity',
            completed: false
          },
          {
            id: 'permission-check',
            type: 'validation',
            label: 'Validate permissions and access',
            completed: false
          },
          {
            id: 'health-check',
            type: 'validation',
            label: 'Run plugin health checks',
            completed: false
          }
        ]
      },
      {
        id: 'deployment',
        title: 'Deployment',
        description: 'Deploy plugin to your Backstage instance',
        icon: Rocket,
        status: 'pending',
        estimatedTime: '1 minute',
        requirements: ['Plugin build', 'Configuration files', 'Environment variables'],
        actions: [
          {
            id: 'build-plugin',
            type: 'auto-detect',
            label: 'Build plugin package',
            completed: false
          },
          {
            id: 'update-config',
            type: 'auto-detect',
            label: 'Update app configuration',
            completed: false
          },
          {
            id: 'restart-app',
            type: 'auto-detect',
            label: 'Restart Backstage application',
            completed: false
          }
        ]
      }
    ];

    setSetupSteps(steps);
    setIsGenerating(false);
  };

  const runAutoDetection = async () => {
    setIsGenerating(true);
    
    // Simulate auto-detection
    setTimeout(() => {
      const results = {
        database: {
          type: 'PostgreSQL',
          host: 'localhost:5432',
          detected: true
        },
        authentication: {
          provider: 'GitHub OAuth',
          configured: true
        },
        services: {
          kubernetes: { available: true, clusters: 3 },
          github: { connected: true, repositories: 247 },
          prometheus: { available: false }
        }
      };
      
      setAutoDetectionResults(results);
      setIsGenerating(false);
      setCurrentStep(2);
    }, 3000);
  };

  const renderTemplateSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Choose Your Plugin Template
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Select a template to get started with guided setup in minutes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLUGIN_TEMPLATES.map((template) => {
          const IconComponent = template.icon;
          const isSelected = selectedTemplate?.id === template.id;
          
          return (
            <motion.button
              key={template.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTemplate(template)}
              className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                </div>
              )}
              
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-lg ${
                  template.category === 'core' ? 'bg-blue-100 text-blue-600' :
                  template.category === 'documentation' ? 'bg-green-100 text-green-600' :
                  template.category === 'monitoring' ? 'bg-yellow-100 text-yellow-600' :
                  template.category === 'ci-cd' ? 'bg-purple-100 text-purple-600' :
                  template.category === 'security' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  <IconComponent className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Setup time:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {template.estimatedSetupTime}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Complexity:</span>
                  <span className={`font-medium ${
                    template.complexity === 'beginner' ? 'text-green-600' :
                    template.complexity === 'intermediate' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {template.complexity}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Popularity:</span>
                  <div className="flex items-center gap-1">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < Math.floor(template.popularityScore / 20)
                              ? 'bg-blue-500'
                              : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {template.popularityScore}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 mb-2">Required services:</div>
                <div className="flex flex-wrap gap-1">
                  {template.requiredServices.map((service) => (
                    <span
                      key={service}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {selectedTemplate && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mt-8"
        >
          <button
            onClick={() => setCurrentStep(1)}
            disabled={isGenerating}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Generating Setup Steps...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Start Setup Wizard
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );

  const renderAutoDetection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Environment Auto-Detection
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Scanning your environment to automatically configure {selectedTemplate?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto-detection Progress */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Detection Progress</h3>
          {[
            { label: 'Database Configuration', status: 'completed', details: 'PostgreSQL detected' },
            { label: 'Authentication Provider', status: 'completed', details: 'GitHub OAuth configured' },
            { label: 'External Services', status: 'in-progress', details: 'Scanning available services...' },
            { label: 'Network Configuration', status: 'pending', details: 'Waiting for service scan...' }
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2 }}
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border"
            >
              {item.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {item.status === 'in-progress' && <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />}
              {item.status === 'pending' && <Clock className="h-5 w-5 text-gray-400" />}
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{item.details}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Detection Results */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Detected Configuration</h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Database</span>
                <span className="font-medium text-green-600">PostgreSQL ✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Authentication</span>
                <span className="font-medium text-green-600">GitHub OAuth ✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Kubernetes</span>
                <span className="font-medium text-green-600">3 clusters ✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">GitHub API</span>
                <span className="font-medium text-green-600">247 repos ✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Prometheus</span>
                <span className="font-medium text-red-600">Not detected ✗</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(0)}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Templates
        </button>
        <button
          onClick={runAutoDetection}
          disabled={isGenerating}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              Detecting...
            </>
          ) : (
            <>
              Continue Setup
              <ChevronRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderTemplateSelection();
      case 1:
        return renderAutoDetection();
      default:
        return (
          <div className="text-center py-12">
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Setup in Progress
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Step {currentStep + 1} of {wizardSteps.length}
            </p>
            <div className="flex justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
            <Wand2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Plugin Setup Wizard
          </h1>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Set up plugins in minutes with our intelligent wizard. Auto-detection, configuration, and deployment made simple.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {wizardSteps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center ${index < wizardSteps.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  index <= currentStep
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  index <= currentStep
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500'
                }`}
              >
                {step}
              </span>
              {index < wizardSteps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 ml-4 ${
                    index < currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export { PluginSetupWizard };