'use client';

import React, { useState } from 'react';
import {
  X, Package, Settings, Container, Cloud, Check,
  AlertTriangle, Info, ExternalLink, Code, Terminal,
  Play, Download, Layers, Shield, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PluginInstaller from './PluginInstaller';
import DependencyResolver from './DependencyResolver';
import PluginCompatibilityChecker from './PluginCompatibilityChecker';

interface Plugin {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  installed: boolean;
  enabled: boolean;
  configurable: boolean;
  downloads?: number;
  stars?: number;
  npm?: string;
  repository?: string;
  homepage?: string;
  premium?: boolean;
  featured?: boolean;
  lastUpdate?: string;
  maintainers?: number;
  license?: string;
}

interface PluginSetupModalProps {
  plugin: Plugin;
  onClose: () => void;
  onComplete: (config: any) => void;
}

export default function PluginSetupModal({ plugin, onClose, onComplete }: PluginSetupModalProps) {
  const [currentStep, setCurrentStep] = useState<'overview' | 'dependencies' | 'compatibility' | 'configure' | 'install'>('overview');
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([plugin.id]);
  const [compatibilityData, setCompatibilityData] = useState<any>(null);
  const [installationConfig, setInstallationConfig] = useState({
    environment: 'local' as 'local' | 'kubernetes',
    namespace: '',
    enableHealthCheck: true,
    autoStart: true,
    resources: {
      cpu: '500m',
      memory: '1Gi',
      storage: '2Gi'
    }
  });

  const steps = [
    { id: 'overview', title: 'Overview', icon: Info },
    { id: 'dependencies', title: 'Dependencies', icon: Layers },
    { id: 'compatibility', title: 'Compatibility', icon: Shield },
    { id: 'configure', title: 'Configure', icon: Settings },
    { id: 'install', title: 'Install', icon: Play }
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep);
  };

  const goToNextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as any);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as any);
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 'overview': return true;
      case 'dependencies': return selectedDependencies.length > 0;
      case 'compatibility': return compatibilityData && compatibilityData.compatibilityResults?.every((r: any) => r.overallCompatibility !== 'incompatible');
      case 'configure': return true;
      case 'install': return false; // Final step
      default: return false;
    }
  };

  const handleInstallComplete = (status: any) => {
    onComplete({
      pluginId: plugin.id,
      installationConfig,
      status,
      dependencies: selectedDependencies
    });
  };

  const handleInstallFailed = (error: string) => {
    console.error('Installation failed:', error);
    // Handle installation failure
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Setup {plugin.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {plugin.id}@{plugin.version}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
                const isCompleted = getCurrentStepIndex() > index;
                const isAccessible = index <= getCurrentStepIndex();

                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => isAccessible && setCurrentStep(step.id as any)}
                      disabled={!isAccessible}
                      className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : isAccessible
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5 mr-2" />
                      ) : (
                        <Icon className="w-5 h-5 mr-2" />
                      )}
                      <span className="text-sm font-medium">{step.title}</span>
                    </button>
                    {index < steps.length - 1 && (
                      <div className={`w-8 h-px mx-2 ${
                        getCurrentStepIndex() > index ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          <AnimatePresence mode="wait">
            {/* Overview Step */}
            {currentStep === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Plugin Overview
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Description</h4>
                        <p className="text-gray-600 dark:text-gray-400">{plugin.description}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Author</h4>
                        <p className="text-gray-600 dark:text-gray-400">{plugin.author}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Category</h4>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm">
                          {plugin.category}
                        </span>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {plugin.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Statistics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Downloads</span>
                            <span className="font-medium">{plugin.downloads?.toLocaleString() || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Stars</span>
                            <span className="font-medium">{plugin.stars?.toLocaleString() || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">License</span>
                            <span className="font-medium">{plugin.license || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Last Update</span>
                            <span className="font-medium">
                              {plugin.lastUpdate ? new Date(plugin.lastUpdate).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {plugin.repository && (
                          <a
                            href={plugin.repository}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Code className="w-4 h-4 mr-2" />
                            View Repository
                          </a>
                        )}
                        {plugin.npm && (
                          <a
                            href={plugin.npm}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Package className="w-4 h-4 mr-2" />
                            View on NPM
                          </a>
                        )}
                        {plugin.homepage && (
                          <a
                            href={plugin.homepage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Documentation
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        What happens during installation?
                      </h4>
                      <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• Download plugin package from NPM registry</li>
                        <li>• Analyze and resolve all dependencies</li>
                        <li>• Check compatibility with your Backstage version</li>
                        <li>• Build containerized environment with plugin integrated</li>
                        <li>• Deploy to your chosen environment (local Docker or Kubernetes)</li>
                        <li>• Set up health monitoring and management endpoints</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Dependencies Step */}
            {currentStep === 'dependencies' && (
              <motion.div
                key="dependencies"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Dependency Analysis
                </h3>
                <DependencyResolver
                  selectedPlugins={selectedDependencies}
                  onPluginAdd={(pluginId) => {
                    setSelectedDependencies(prev => [...prev, pluginId]);
                  }}
                  onPluginRemove={(pluginId) => {
                    setSelectedDependencies(prev => prev.filter(id => id !== pluginId));
                  }}
                />
              </motion.div>
            )}

            {/* Compatibility Step */}
            {currentStep === 'compatibility' && (
              <motion.div
                key="compatibility"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Compatibility Check
                </h3>
                <PluginCompatibilityChecker
                  selectedPlugins={selectedDependencies}
                  onCompatibilityChange={setCompatibilityData}
                />
              </motion.div>
            )}

            {/* Configuration Step */}
            {currentStep === 'configure' && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Installation Configuration
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Deployment Environment
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setInstallationConfig(prev => ({ ...prev, environment: 'local' }))}
                          className={`p-4 border-2 rounded-lg transition-colors ${
                            installationConfig.environment === 'local'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <Container className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                          <div className="text-sm font-medium">Local Docker</div>
                        </button>
                        <button
                          onClick={() => setInstallationConfig(prev => ({ ...prev, environment: 'kubernetes' }))}
                          className={`p-4 border-2 rounded-lg transition-colors ${
                            installationConfig.environment === 'kubernetes'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <Cloud className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                          <div className="text-sm font-medium">Kubernetes</div>
                        </button>
                      </div>
                    </div>

                    {installationConfig.environment === 'kubernetes' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Kubernetes Namespace
                        </label>
                        <input
                          type="text"
                          value={installationConfig.namespace}
                          onChange={(e) => setInstallationConfig(prev => ({ ...prev, namespace: e.target.value }))}
                          placeholder={`backstage-plugin-${plugin.id.replace(/[@\/]/g, '-').toLowerCase()}`}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={installationConfig.enableHealthCheck}
                          onChange={(e) => setInstallationConfig(prev => ({ ...prev, enableHealthCheck: e.target.checked }))}
                          className="rounded border-gray-300 dark:border-gray-600 mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Enable health monitoring</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={installationConfig.autoStart}
                          onChange={(e) => setInstallationConfig(prev => ({ ...prev, autoStart: e.target.checked }))}
                          className="rounded border-gray-300 dark:border-gray-600 mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Auto-start after installation</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Resource Limits
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">CPU</label>
                          <select
                            value={installationConfig.resources.cpu}
                            onChange={(e) => setInstallationConfig(prev => ({
                              ...prev,
                              resources: { ...prev.resources, cpu: e.target.value }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
                          >
                            <option value="250m">250m (0.25 cores)</option>
                            <option value="500m">500m (0.5 cores)</option>
                            <option value="1">1 core</option>
                            <option value="2">2 cores</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Memory</label>
                          <select
                            value={installationConfig.resources.memory}
                            onChange={(e) => setInstallationConfig(prev => ({
                              ...prev,
                              resources: { ...prev.resources, memory: e.target.value }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
                          >
                            <option value="512Mi">512Mi</option>
                            <option value="1Gi">1Gi</option>
                            <option value="2Gi">2Gi</option>
                            <option value="4Gi">4Gi</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Storage</label>
                          <select
                            value={installationConfig.resources.storage}
                            onChange={(e) => setInstallationConfig(prev => ({
                              ...prev,
                              resources: { ...prev.resources, storage: e.target.value }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
                          >
                            <option value="1Gi">1Gi</option>
                            <option value="2Gi">2Gi</option>
                            <option value="5Gi">5Gi</option>
                            <option value="10Gi">10Gi</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                      <div className="flex items-start">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
                        <div className="text-xs text-yellow-700 dark:text-yellow-300">
                          <strong>Note:</strong> Resource requirements depend on plugin complexity and usage patterns. 
                          You can adjust these settings after installation.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Installation Step */}
            {currentStep === 'install' && (
              <motion.div
                key="install"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Install Plugin
                </h3>
                <PluginInstaller
                  pluginId={plugin.id}
                  pluginName={plugin.title}
                  version={plugin.version}
                  onInstallComplete={handleInstallComplete}
                  onInstallFailed={handleInstallFailed}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={goToPreviousStep}
            disabled={getCurrentStepIndex() === 0}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            
            {currentStep !== 'install' && (
              <button
                onClick={goToNextStep}
                disabled={!canProceedToNext()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentStep === 'configure' ? 'Start Installation' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}