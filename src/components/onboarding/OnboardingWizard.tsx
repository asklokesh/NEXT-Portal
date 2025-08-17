/**
 * Onboarding Wizard Component
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Globe,
  Link2,
  Loader2,
  Play,
  Rocket,
  Users
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

interface OrganizationData {
  size: string;
  industry: string;
  website: string;
  timezone: string;
}

interface IntegrationData {
  github?: { enabled: boolean; token?: string; org?: string };
  gitlab?: { enabled: boolean; token?: string; url?: string };
  slack?: { enabled: boolean; token?: string; channel?: string };
  aws?: { enabled: boolean; accountId?: string; region?: string; roleArn?: string };
}

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'organization',
      title: 'Organization Setup',
      description: 'Tell us about your company',
      completed: false,
      active: true
    },
    {
      id: 'integrations',
      title: 'Connect Tools',
      description: 'Integrate your development tools',
      completed: false,
      active: false
    },
    {
      id: 'tour',
      title: 'Product Tour',
      description: 'Learn the platform basics',
      completed: false,
      active: false
    },
    {
      id: 'complete',
      title: 'Get Started',
      description: 'You\'re all set!',
      completed: false,
      active: false
    }
  ]);

  const [orgData, setOrgData] = useState<OrganizationData>({
    size: '',
    industry: '',
    website: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [integrations, setIntegrations] = useState<IntegrationData>({
    github: { enabled: false },
    gitlab: { enabled: false },
    slack: { enabled: false },
    aws: { enabled: false }
  });

  useEffect(() => {
    // Get session ID from localStorage or cookie
    const storedSession = localStorage.getItem('onboarding_session');
    if (storedSession) {
      setSessionId(storedSession);
    }
  }, []);

  const handleOrganizationSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-onboarding-session': sessionId
        },
        body: JSON.stringify(orgData)
      });

      if (!response.ok) throw new Error('Failed to save organization data');

      // Update steps
      const newSteps = [...steps];
      newSteps[0].completed = true;
      newSteps[0].active = false;
      newSteps[1].active = true;
      setSteps(newSteps);
      setCurrentStep(1);
    } catch (error) {
      console.error('Failed to save organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIntegrationsSubmit = async () => {
    setLoading(true);
    try {
      // Filter enabled integrations
      const enabledIntegrations: any = {};
      
      if (integrations.github?.enabled && integrations.github.token) {
        enabledIntegrations.github = {
          token: integrations.github.token,
          org: integrations.github.org || ''
        };
      }
      
      if (integrations.slack?.enabled && integrations.slack.token) {
        enabledIntegrations.slack = {
          token: integrations.slack.token,
          channel: integrations.slack.channel || ''
        };
      }

      const response = await fetch('/api/onboarding/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-onboarding-session': sessionId
        },
        body: JSON.stringify(enabledIntegrations)
      });

      if (!response.ok) throw new Error('Failed to setup integrations');

      // Update steps
      const newSteps = [...steps];
      newSteps[1].completed = true;
      newSteps[1].active = false;
      newSteps[2].active = true;
      setSteps(newSteps);
      setCurrentStep(2);
    } catch (error) {
      console.error('Failed to setup integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const startProductTour = () => {
    // Update steps
    const newSteps = [...steps];
    newSteps[2].completed = true;
    newSteps[2].active = false;
    newSteps[3].active = true;
    setSteps(newSteps);
    setCurrentStep(3);

    // In a real app, this would launch an interactive tour
    setTimeout(() => {
      completeOnboarding();
    }, 2000);
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'x-onboarding-session': sessionId
        }
      });

      if (!response.ok) throw new Error('Failed to complete onboarding');

      const data = await response.json();

      // Update final step
      const newSteps = [...steps];
      newSteps[3].completed = true;
      setSteps(newSteps);

      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Tell us about your organization</h2>
            <p className="text-gray-600">This helps us customize your experience</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Size
                </label>
                <select
                  value={orgData.size}
                  onChange={(e) => setOrgData({ ...orgData, size: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select size</option>
                  <option value="1-50">1-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-1000">201-1000 employees</option>
                  <option value="1000+">1000+ employees</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <select
                  value={orgData.industry}
                  onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select industry</option>
                  <option value="technology">Technology</option>
                  <option value="finance">Finance</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="retail">Retail</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="education">Education</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website (optional)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={orgData.website}
                    onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={orgData.timezone}
                    readOnly
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <Clock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            <button
              onClick={handleOrganizationSubmit}
              disabled={!orgData.size || !orgData.industry || loading}
              className="w-full py-3 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Continue
                  <ChevronRight className="ml-2 w-5 h-5" />
                </>
              )}
            </button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Connect your tools</h2>
            <p className="text-gray-600">Integrate with your existing development tools (optional)</p>

            <div className="space-y-4">
              {/* GitHub Integration */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold">GH</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">GitHub</h3>
                      <p className="text-sm text-gray-500">Connect repositories and workflows</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={integrations.github?.enabled}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      github: { ...integrations.github, enabled: e.target.checked }
                    })}
                    className="h-5 w-5 text-purple-600 rounded"
                  />
                </div>
                
                {integrations.github?.enabled && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                    <input
                      type="text"
                      placeholder="Personal Access Token"
                      value={integrations.github?.token || ''}
                      onChange={(e) => setIntegrations({
                        ...integrations,
                        github: { ...integrations.github, token: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Organization Name"
                      value={integrations.github?.org || ''}
                      onChange={(e) => setIntegrations({
                        ...integrations,
                        github: { ...integrations.github, org: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Slack Integration */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white font-bold">S</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Slack</h3>
                      <p className="text-sm text-gray-500">Get notifications and alerts</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={integrations.slack?.enabled}
                    onChange={(e) => setIntegrations({
                      ...integrations,
                      slack: { ...integrations.slack, enabled: e.target.checked }
                    })}
                    className="h-5 w-5 text-purple-600 rounded"
                  />
                </div>

                {integrations.slack?.enabled && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                    <input
                      type="text"
                      placeholder="Bot Token"
                      value={integrations.slack?.token || ''}
                      onChange={(e) => setIntegrations({
                        ...integrations,
                        slack: { ...integrations.slack, token: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Channel ID (e.g., C1234567890)"
                      value={integrations.slack?.channel || ''}
                      onChange={(e) => setIntegrations({
                        ...integrations,
                        slack: { ...integrations.slack, channel: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setCurrentStep(2);
                  const newSteps = [...steps];
                  newSteps[1].completed = true;
                  newSteps[1].active = false;
                  newSteps[2].active = true;
                  setSteps(newSteps);
                }}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Skip for now
              </button>
              <button
                onClick={handleIntegrationsSubmit}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ChevronRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
              <Play className="w-10 h-10 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Ready for a quick tour?</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Take a 5-minute interactive tour to learn the platform basics and discover key features
            </p>

            <div className="bg-gray-50 rounded-lg p-6 text-left max-w-md mx-auto">
              <h3 className="font-medium text-gray-900 mb-3">You'll learn how to:</h3>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Navigate the platform and find features</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Create and manage services</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Use templates to speed up development</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600">Monitor your infrastructure</span>
                </li>
              </ul>
            </div>

            <div className="flex space-x-4 max-w-md mx-auto">
              <button
                onClick={() => completeOnboarding()}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Skip tour
              </button>
              <button
                onClick={startProductTour}
                className="flex-1 py-3 px-4 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 flex items-center justify-center"
              >
                <Play className="mr-2 w-5 h-5" />
                Start Tour
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Rocket className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">You're all set!</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Your platform is ready. Let's start building amazing things together.
            </p>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="font-medium text-gray-900 mb-3">Your next steps:</h3>
              <div className="space-y-3 text-left">
                <a href="/catalog" className="flex items-center p-3 bg-white rounded-lg hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Create your first service</div>
                    <div className="text-sm text-gray-500">Add services to your catalog</div>
                  </div>
                </a>
                
                <a href="/teams" className="flex items-center p-3 bg-white rounded-lg hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Invite your team</div>
                    <div className="text-sm text-gray-500">Collaborate with colleagues</div>
                  </div>
                </a>
                
                <a href="/integrations" className="flex items-center p-3 bg-white rounded-lg hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <Link2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Connect more tools</div>
                    <div className="text-sm text-gray-500">Integrate your tech stack</div>
                  </div>
                </a>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700"
            >
              Go to Dashboard
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.completed
                        ? 'bg-green-500 text-white'
                        : step.active
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-xs font-medium text-gray-900">{step.title}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step.completed ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}