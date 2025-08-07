'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Info,
  Settings,
  Shield,
  Zap,
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Play,
  Pause,
  Terminal,
  FileText,
  Database,
  Globe,
  Key,
  Lock,
  Unlock,
  Server,
  Network,
  Package,
  GitBranch,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface InstallationWizardProps {
  plugin: BackstagePlugin;
  onClose: () => void;
}

interface InstallationStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  component: React.ComponentType<any>;
  validation?: z.ZodSchema<any>;
  optional?: boolean;
}

interface ConfigField {
  key: string;
  type: 'string' | 'password' | 'number' | 'boolean' | 'select' | 'textarea' | 'url' | 'email';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: { value: string; label: string }[];
  placeholder?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

interface InstallationState {
  currentStep: number;
  stepData: Record<string, any>;
  isInstalling: boolean;
  installationProgress: number;
  installationMessage: string;
  installationStatus: 'idle' | 'installing' | 'success' | 'error';
  error?: string;
  logs: string[];
}

// Mock configuration schema for demo purposes
function getPluginConfigSchema(plugin: BackstagePlugin): ConfigField[] {
  const baseFields: ConfigField[] = [
    {
      key: 'enabled',
      type: 'boolean',
      label: 'Enable Plugin',
      description: 'Enable this plugin immediately after installation',
      default: true,
    },
  ];

  // Category-specific configuration fields
  const categoryConfigs: Record<string, ConfigField[]> = {
    'kubernetes': [
      {
        key: 'apiUrl',
        type: 'url',
        label: 'Kubernetes API URL',
        description: 'The URL of your Kubernetes API server',
        required: true,
        placeholder: 'https://kubernetes.example.com:6443',
      },
      {
        key: 'token',
        type: 'password',
        label: 'Service Account Token',
        description: 'Token for authenticating with the Kubernetes API',
        required: true,
      },
      {
        key: 'namespace',
        type: 'string',
        label: 'Default Namespace',
        description: 'Default namespace to use for operations',
        default: 'default',
      },
      {
        key: 'skipTLSVerify',
        type: 'boolean',
        label: 'Skip TLS Verification',
        description: 'Skip TLS certificate verification (not recommended for production)',
        default: false,
      },
    ],
    'github-actions': [
      {
        key: 'token',
        type: 'password',
        label: 'GitHub Token',
        description: 'Personal access token or app token for GitHub API',
        required: true,
      },
      {
        key: 'baseUrl',
        type: 'url',
        label: 'GitHub API URL',
        description: 'Base URL for GitHub API (use for GitHub Enterprise)',
        default: 'https://api.github.com',
      },
      {
        key: 'organization',
        type: 'string',
        label: 'Organization',
        description: 'GitHub organization to focus on (optional)',
      },
    ],
    'sonarqube': [
      {
        key: 'baseUrl',
        type: 'url',
        label: 'SonarQube URL',
        description: 'Base URL of your SonarQube instance',
        required: true,
        placeholder: 'https://sonar.example.com',
      },
      {
        key: 'token',
        type: 'password',
        label: 'API Token',
        description: 'SonarQube user token for API access',
        required: true,
      },
    ],
    'ci-cd': [
      {
        key: 'webhookUrl',
        type: 'url',
        label: 'Webhook URL',
        description: 'URL to receive webhook notifications',
      },
      {
        key: 'triggers',
        type: 'select',
        label: 'Trigger Events',
        description: 'Which events should trigger this plugin',
        options: [
          { value: 'push', label: 'Code Push' },
          { value: 'pull_request', label: 'Pull Request' },
          { value: 'release', label: 'Release' },
          { value: 'all', label: 'All Events' },
        ],
        default: 'all',
      },
    ],
    'monitoring': [
      {
        key: 'metricsUrl',
        type: 'url',
        label: 'Metrics Endpoint',
        description: 'URL where metrics are exposed',
        required: true,
      },
      {
        key: 'alertingEnabled',
        type: 'boolean',
        label: 'Enable Alerting',
        description: 'Enable alert notifications',
        default: true,
      },
      {
        key: 'refreshInterval',
        type: 'number',
        label: 'Refresh Interval (seconds)',
        description: 'How often to refresh metrics',
        default: 30,
        validation: { min: 10, max: 3600 },
      },
    ],
  };

  return [
    ...baseFields,
    ...(categoryConfigs[plugin.category] || categoryConfigs[plugin.id] || []),
  ];
}

function ConfigurationStep({ plugin, data, onChange }: any) {
  const configFields = getPluginConfigSchema(plugin);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderField = (field: ConfigField) => {
    const value = data[field.key] ?? field.default;

    switch (field.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={field.key}
              checked={value || false}
              onChange={(e) => onChange(field.key, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor={field.key} className="text-sm text-gray-700 dark:text-gray-300">
              {field.label}
            </label>
          </div>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select an option</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          />
        );

      case 'password':
        return (
          <div className="relative">
            <input
              type={showPasswords[field.key] ? 'text' : 'password'}
              value={value || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility(field.key)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPasswords[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );

      default:
        return (
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Settings className="w-12 h-12 text-blue-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Configure {plugin.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Set up the plugin configuration. Fields marked with * are required.
        </p>
      </div>

      <div className="space-y-4">
        {configFields.map((field) => (
          <div key={field.key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {renderField(field)}
            
            {field.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {field.description}
              </p>
            )}
          </div>
        ))}
      </div>

      {configFields.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            No additional configuration required for this plugin.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ plugin, data }: any) {
  const configFields = getPluginConfigSchema(plugin);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Review Installation
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please review your configuration before installing the plugin.
        </p>
      </div>

      {/* Plugin Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Plugin Details</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Name:</span>
            <span className="ml-2 font-medium">{plugin.title}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Version:</span>
            <span className="ml-2 font-medium">v{plugin.version}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Category:</span>
            <span className="ml-2 font-medium capitalize">{plugin.category.replace('-', ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Author:</span>
            <span className="ml-2 font-medium">{plugin.author}</span>
          </div>
        </div>
      </div>

      {/* Configuration Summary */}
      {configFields.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Configuration</h4>
          <div className="space-y-3">
            {configFields.map((field) => {
              const value = data[field.key];
              const displayValue = field.type === 'password' 
                ? value ? '••••••••' : 'Not set'
                : field.type === 'boolean'
                ? value ? 'Enabled' : 'Disabled'
                : value || 'Not set';

              return (
                <div key={field.key} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{field.label}:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{displayValue}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Installation Preview */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" />
          What will happen during installation
        </h4>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-center gap-2">
            <Download className="w-3 h-3" />
            Download and install the plugin package
          </li>
          <li className="flex items-center gap-2">
            <Settings className="w-3 h-3" />
            Apply your configuration settings
          </li>
          <li className="flex items-center gap-2">
            <Shield className="w-3 h-3" />
            Set up security permissions
          </li>
          <li className="flex items-center gap-2">
            <Network className="w-3 h-3" />
            Register API routes and endpoints
          </li>
          <li className="flex items-center gap-2">
            <Zap className="w-3 h-3" />
            Enable the plugin in your portal
          </li>
        </ul>
      </div>
    </div>
  );
}

function InstallationProgress({ progress, message, logs, status }: any) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        {status === 'installing' && (
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-3 animate-spin" />
        )}
        {status === 'success' && (
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
        )}
        {status === 'error' && (
          <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
        )}
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {status === 'installing' && 'Installing Plugin...'}
          {status === 'success' && 'Installation Complete!'}
          {status === 'error' && 'Installation Failed'}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {message}
        </p>
      </div>

      {/* Progress Bar */}
      {status === 'installing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Progress</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success Actions */}
      {status === 'success' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-100">Plugin Ready!</h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                The plugin has been installed and is ready to use.
              </p>
            </div>
            <button className="inline-flex items-center px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Play className="w-4 h-4 mr-2" />
              Open Plugin
            </button>
          </div>
        </div>
      )}

      {/* Installation Logs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Installation Logs</h4>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Terminal className="w-4 h-4" />
            {showLogs ? 'Hide' : 'Show'} Logs
          </button>
        </div>
        
        {showLogs && (
          <div className="bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
            <div className="font-mono text-sm space-y-1">
              {logs.map((log: string, index: number) => (
                <div key={index} className="text-green-400">
                  <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                </div>
              ))}
              {status === 'installing' && (
                <div className="flex items-center gap-2 text-yellow-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Installing...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function InstallationWizard({ plugin, onClose }: InstallationWizardProps) {
  const [state, setState] = useState<InstallationState>({
    currentStep: 0,
    stepData: {},
    isInstalling: false,
    installationProgress: 0,
    installationMessage: '',
    installationStatus: 'idle',
    logs: [],
  });

  const steps: InstallationStep[] = [
    {
      id: 'configuration',
      title: 'Configuration',
      description: 'Configure plugin settings',
      icon: Settings,
      component: ConfigurationStep,
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Review installation details',
      icon: CheckCircle,
      component: ReviewStep,
    },
    {
      id: 'installation',
      title: 'Installation',
      description: 'Installing plugin',
      icon: Download,
      component: InstallationProgress,
    },
  ];

  const currentStep = steps[state.currentStep];

  const updateStepData = (key: string, value: any) => {
    setState(prev => ({
      ...prev,
      stepData: { ...prev.stepData, [key]: value },
    }));
  };

  const nextStep = () => {
    if (state.currentStep < steps.length - 1) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const prevStep = () => {
    if (state.currentStep > 0) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const startInstallation = async () => {
    setState(prev => ({
      ...prev,
      isInstalling: true,
      installationStatus: 'installing',
      installationProgress: 0,
      installationMessage: 'Preparing installation...',
      logs: ['Starting plugin installation process...'],
    }));

    // Simulate installation process
    const steps = [
      { progress: 20, message: 'Downloading plugin package...', log: 'Fetching plugin from npm registry' },
      { progress: 40, message: 'Validating dependencies...', log: 'Checking plugin dependencies' },
      { progress: 60, message: 'Installing plugin files...', log: 'Extracting plugin files' },
      { progress: 80, message: 'Applying configuration...', log: 'Setting up plugin configuration' },
      { progress: 90, message: 'Registering plugin routes...', log: 'Registering API endpoints' },
      { progress: 100, message: 'Installation complete!', log: 'Plugin installed successfully' },
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setState(prev => ({
        ...prev,
        installationProgress: step.progress,
        installationMessage: step.message,
        logs: [...prev.logs, step.log],
      }));
    }

    setState(prev => ({
      ...prev,
      installationStatus: 'success',
      isInstalling: false,
    }));

    // Auto-close after success
    setTimeout(() => {
      toast.success(`${plugin.title} installed successfully!`);
      onClose();
    }, 3000);
  };

  const isLastStep = state.currentStep === steps.length - 1;
  const isInstallationStep = currentStep.id === 'installation';

  // Auto-start installation when reaching the installation step
  useEffect(() => {
    if (currentStep.id === 'installation' && state.installationStatus === 'idle') {
      startInstallation();
    }
  }, [currentStep.id, state.installationStatus]);

  const StepComponent = currentStep.component;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={state.isInstalling ? undefined : onClose} />
      
      <div className="relative flex items-center justify-center h-full p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Install {plugin.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Step {state.currentStep + 1} of {steps.length}: {currentStep.title}
              </p>
            </div>
            {!state.isInstalling && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === state.currentStep;
                const isCompleted = index < state.currentStep;
                const isAccessible = index <= state.currentStep;

                return (
                  <React.Fragment key={step.id}>
                    <div className="flex items-center">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                          isCompleted
                            ? 'bg-green-600 border-green-600 text-white'
                            : isActive
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : isAccessible
                            ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="ml-2">
                        <div className={`text-sm font-medium ${
                          isActive 
                            ? 'text-blue-600' 
                            : isCompleted 
                            ? 'text-green-600' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {step.title}
                        </div>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-px mx-4 ${
                        index < state.currentStep 
                          ? 'bg-green-600' 
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="p-6 max-h-96 overflow-y-auto">
            <StepComponent
              plugin={plugin}
              data={state.stepData}
              onChange={updateStepData}
              progress={state.installationProgress}
              message={state.installationMessage}
              logs={state.logs}
              status={state.installationStatus}
            />
          </div>

          {/* Footer */}
          {!isInstallationStep && (
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={prevStep}
                disabled={state.currentStep === 0}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={nextStep}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {isLastStep ? 'Install' : 'Next'}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}