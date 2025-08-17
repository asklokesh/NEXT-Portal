'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Shield,
  GitBranch,
  Users,
  Layers,
  Palette,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
  SkipForward,
  AlertTriangle,
  BookOpen,
  Zap,
  Target,
  Award,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// Types
interface WizardCategory {
  category: string;
  wizards: WizardSummary[];
  count: number;
}

interface WizardSummary {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  popularity: number;
  stepCount: number;
}

interface WizardSession {
  id: string;
  wizardId: string;
  wizardName: string;
  status: string;
  currentStep: number;
  currentStepData: WizardStep;
  progress: {
    completedSteps: string[];
    currentStepProgress: number;
    totalProgress: number;
    timeSpent: number;
    estimatedTimeRemaining: number;
  };
  data: Record<string, any>;
}

interface WizardStep {
  id: string;
  name: string;
  description: string;
  type: string;
  required: boolean;
  data: {
    fields: WizardField[];
    defaultValues: Record<string, any>;
    templates: StepTemplate[];
  };
  ui: {
    layout: string;
    showProgress: boolean;
    allowSkip: boolean;
    nextButtonText?: string;
    helpUrl?: string;
    estimatedTime?: number;
  };
}

interface WizardField {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation: any;
  conditional?: any;
}

interface FieldOption {
  value: any;
  label: string;
  description?: string;
  icon?: string;
  recommended?: boolean;
}

interface StepTemplate {
  id: string;
  name: string;
  description: string;
  values: Record<string, any>;
  recommended?: boolean;
}

const CATEGORY_ICONS = {
  authentication: Shield,
  cicd: GitBranch,
  plugins: Layers,
  permissions: Users,
  integrations: Settings,
  customization: Palette
};

const CATEGORY_COLORS = {
  authentication: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  cicd: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  plugins: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  permissions: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  integrations: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  customization: 'bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400'
};

const DIFFICULTY_COLORS = {
  beginner: 'text-green-600 bg-green-100 dark:bg-green-900/20',
  intermediate: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20',
  advanced: 'text-red-600 bg-red-100 dark:bg-red-900/20'
};

export default function WizardInterface() {
  const queryClient = useQueryClient();
  const [selectedWizard, setSelectedWizard] = useState<WizardSummary | null>(null);
  const [currentSession, setCurrentSession] = useState<WizardSession | null>(null);
  const [currentStepData, setCurrentStepData] = useState<Record<string, any>>({});
  const [showWizardDetails, setShowWizardDetails] = useState(false);

  // Fetch available wizards
  const { data: wizardsData, isLoading: wizardsLoading } = useQuery({
    queryKey: ['wizards'],
    queryFn: async () => {
      const response = await fetch('/api/onboarding/wizards');
      if (!response.ok) throw new Error('Failed to fetch wizards');
      return response.json();
    },
  });

  // Start wizard mutation
  const startWizardMutation = useMutation({
    mutationFn: async ({ wizardId, userId, organizationId }: any) => {
      const response = await fetch('/api/onboarding/wizards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          wizardId,
          userId: userId || 'demo-user',
          organizationId
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to start wizard');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSession(data.session);
      setCurrentStepData(data.session.currentStepData?.data?.defaultValues || {});
      toast.success('Wizard started successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to start wizard: ${error.message}`);
    },
  });

  // Wizard navigation mutations
  const nextStepMutation = useMutation({
    mutationFn: async ({ sessionId, stepData }: any) => {
      const response = await fetch('/api/onboarding/wizards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'next',
          sessionId,
          stepData
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to proceed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSession(data.session);
      if (data.session.completed) {
        toast.success('Wizard completed successfully!');
        setCurrentSession(null);
        setSelectedWizard(null);
      } else {
        setCurrentStepData(data.session.currentStepData?.data?.defaultValues || {});
        toast.success('Step completed');
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to proceed: ${error.message}`);
    },
  });

  const previousStepMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch('/api/onboarding/wizards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'previous',
          sessionId
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to go back');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSession(data.session);
      setCurrentStepData(data.session.currentStepData?.data?.defaultValues || {});
      toast.success('Returned to previous step');
    },
    onError: (error: any) => {
      toast.error(`Failed to go back: ${error.message}`);
    },
  });

  const skipStepMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch('/api/onboarding/wizards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'skip',
          sessionId,
          stepData: { reason: 'User skipped step' }
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to skip step');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSession(data.session);
      setCurrentStepData(data.session.currentStepData?.data?.defaultValues || {});
      toast.success('Step skipped');
    },
    onError: (error: any) => {
      toast.error(`Failed to skip step: ${error.message}`);
    },
  });

  const handleStartWizard = (wizard: WizardSummary) => {
    setSelectedWizard(wizard);
    startWizardMutation.mutate({ wizardId: wizard.id });
  };

  const handleNextStep = () => {
    if (!currentSession) return;
    nextStepMutation.mutate({
      sessionId: currentSession.id,
      stepData: currentStepData
    });
  };

  const handlePreviousStep = () => {
    if (!currentSession) return;
    previousStepMutation.mutate(currentSession.id);
  };

  const handleSkipStep = () => {
    if (!currentSession) return;
    skipStepMutation.mutate(currentSession.id);
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setCurrentStepData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleApplyTemplate = (template: StepTemplate) => {
    setCurrentStepData(prev => ({
      ...prev,
      ...template.values
    }));
    toast.success(`Applied template: ${template.name}`);
  };

  if (wizardsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Settings className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading setup wizards...</p>
        </div>
      </div>
    );
  }

  // Render active wizard session
  if (currentSession) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setCurrentSession(null);
                setSelectedWizard(null);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentSession.wizardName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Step {currentSession.currentStep + 1} of {selectedWizard?.stepCount || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(currentSession.progress.totalProgress)}% complete
            </div>
            <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentSession.progress.totalProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {currentSession.currentStepData?.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {currentSession.currentStepData?.description}
            </p>
          </div>

          {/* Step Templates */}
          {currentSession.currentStepData?.data.templates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Quick Start Templates
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentSession.currentStepData.data.templates.map((template: StepTemplate) => (
                  <button
                    key={template.id}
                    onClick={() => handleApplyTemplate(template)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      template.recommended
                        ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {template.recommended && <Zap className="w-3 h-3 inline mr-1" />}
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step Fields */}
          <div className="space-y-6">
            {currentSession.currentStepData?.data.fields.map((field: WizardField) => (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                )}

                {field.type === 'password' && (
                  <input
                    type="password"
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                )}

                {field.type === 'email' && (
                  <input
                    type="email"
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                )}

                {field.type === 'url' && (
                  <input
                    type="url"
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                )}

                {field.type === 'select' && (
                  <select
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option: FieldOption) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        {option.recommended && ' (Recommended)'}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'radio' && (
                  <div className="space-y-3">
                    {field.options?.map((option: FieldOption) => (
                      <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name={field.id}
                          value={option.value}
                          checked={currentStepData[field.id] === option.value}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="mt-1 text-blue-600"
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {option.label}
                            {option.recommended && (
                              <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                Recommended
                              </span>
                            )}
                          </div>
                          {option.description && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {option.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentStepData[field.id] || false}
                      onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                      className="text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{field.label}</span>
                  </label>
                )}

                {field.type === 'json' && (
                  <textarea
                    value={currentStepData[field.id] || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder || '{}'}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 font-mono text-sm"
                  />
                )}

                {field.helpText && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {field.helpText}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreviousStep}
              disabled={currentSession.currentStep === 0 || previousStepMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {currentSession.currentStepData?.ui.allowSkip && (
              <button
                onClick={handleSkipStep}
                disabled={skipStepMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            )}
          </div>

          <button
            onClick={handleNextStep}
            disabled={nextStepMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {nextStepMutation.isPending ? (
              <>
                <Settings className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {currentSession.currentStepData?.ui.nextButtonText || 'Continue'}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Render wizard selection
  const wizardCategories: WizardCategory[] = wizardsData?.categories || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Setup Wizards
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Guided configuration for your developer portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Award className="w-4 h-4" />
            {wizardCategories.length} categories
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            {wizardCategories.reduce((total, cat) => total + cat.count, 0)} wizards
          </div>
        </div>
      </div>

      {/* Wizard Categories */}
      <div className="space-y-8">
        {wizardCategories.map((category) => {
          const IconComponent = CATEGORY_ICONS[category.category as keyof typeof CATEGORY_ICONS] || Settings;
          const colorClass = CATEGORY_COLORS[category.category as keyof typeof CATEGORY_COLORS];

          return (
            <div key={category.category} className="space-y-4">
              {/* Category Header */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
                    {category.category}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {category.count} wizard{category.count !== 1 ? 's' : ''} available
                  </p>
                </div>
              </div>

              {/* Wizards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {category.wizards.map((wizard) => (
                  <motion.div
                    key={wizard.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                    onClick={() => handleStartWizard(wizard)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          DIFFICULTY_COLORS[wizard.difficulty]
                        }`}>
                          {wizard.difficulty}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <TrendingUp className="w-3 h-3" />
                          {wizard.popularity}%
                        </div>
                      </div>
                    </div>

                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {wizard.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {wizard.description}
                    </p>

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        ~{wizard.estimatedDuration} min
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {wizard.stepCount} steps
                      </div>
                    </div>

                    <button
                      className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      disabled={startWizardMutation.isPending}
                    >
                      {startWizardMutation.isPending && selectedWizard?.id === wizard.id ? (
                        <>
                          <Settings className="w-4 h-4 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Start Setup
                        </>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {wizardCategories.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No setup wizards available
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Setup wizards are being loaded. Please check back in a moment.
          </p>
        </div>
      )}
    </div>
  );
}