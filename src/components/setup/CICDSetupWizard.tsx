/**
 * CI/CD Pipeline Setup Wizard
 * Guided setup for automated deployment pipelines and DevOps workflows
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
  GitBranch,
  Workflow,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  ArrowLeft,
  Github,
  Gitlab,
  Zap,
  Server,
  Container,
  Shield,
  Clock,
  Target,
  Rocket,
  Code,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Terminal,
  Cloud,
  Database
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface CICDProvider {
  id: string;
  name: string;
  description: string;
  icon: any;
  features: string[];
  complexity: 'SIMPLE' | 'INTERMEDIATE' | 'ADVANCED';
  requirements: string[];
}

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
  order: number;
}

interface EnvironmentConfig {
  name: string;
  type: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  url?: string;
  autoDeployment: boolean;
  requiresApproval: boolean;
  notifications: string[];
  secrets: string[];
}

interface CICDConfiguration {
  provider: string;
  repositoryUrl: string;
  defaultBranch: string;
  buildTriggers: string[];
  stages: PipelineStage[];
  environments: EnvironmentConfig[];
  notifications: {
    email: string[];
    slack?: string;
    webhooks: string[];
  };
  security: {
    enableSonarQube: boolean;
    enableSecurityScanning: boolean;
    enableDependencyCheck: boolean;
    requireCodeReview: boolean;
  };
  deployment: {
    strategy: 'ROLLING' | 'BLUE_GREEN' | 'CANARY';
    containerRegistry?: string;
    kubernetesCluster?: string;
    healthChecks: boolean;
    rollbackOnFailure: boolean;
  };
}

const CICD_PROVIDERS: CICDProvider[] = [
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    description: 'Native CI/CD with GitHub integration',
    icon: Github,
    features: ['Native GitHub integration', 'Extensive marketplace', 'Matrix builds', 'Secrets management'],
    complexity: 'SIMPLE',
    requirements: ['GitHub repository', 'GitHub Pro/Team (optional)']
  },
  {
    id: 'gitlab-ci',
    name: 'GitLab CI/CD',
    description: 'Integrated DevOps platform',
    icon: Gitlab,
    features: ['Built-in CI/CD', 'Container registry', 'Security scanning', 'Auto DevOps'],
    complexity: 'INTERMEDIATE',
    requirements: ['GitLab repository', 'GitLab Runner']
  },
  {
    id: 'jenkins',
    name: 'Jenkins',
    description: 'Self-hosted automation server',
    icon: Settings,
    features: ['Highly customizable', 'Extensive plugins', 'Self-hosted', 'Pipeline as code'],
    complexity: 'ADVANCED',
    requirements: ['Jenkins server', 'Plugin management', 'Infrastructure setup']
  },
  {
    id: 'azure-devops',
    name: 'Azure DevOps',
    description: 'Microsoft DevOps platform',
    icon: Cloud,
    features: ['Azure integration', 'Boards & repos', 'Test plans', 'Artifacts'],
    complexity: 'INTERMEDIATE',
    requirements: ['Azure subscription', 'Azure DevOps organization']
  }
];

const DEFAULT_STAGES: PipelineStage[] = [
  {
    id: 'checkout',
    name: 'Source Checkout',
    description: 'Check out source code from repository',
    enabled: true,
    config: { shallow: true, fetchDepth: 1 },
    order: 1
  },
  {
    id: 'install',
    name: 'Install Dependencies',
    description: 'Install project dependencies',
    enabled: true,
    config: { cache: true, nodeVersion: '18' },
    order: 2
  },
  {
    id: 'lint',
    name: 'Code Linting',
    description: 'Run linting and code quality checks',
    enabled: true,
    config: { failOnError: true, autoFix: false },
    order: 3
  },
  {
    id: 'test',
    name: 'Run Tests',
    description: 'Execute unit and integration tests',
    enabled: true,
    config: { coverage: true, threshold: 80 },
    order: 4
  },
  {
    id: 'build',
    name: 'Build Application',
    description: 'Build and compile application',
    enabled: true,
    config: { optimization: true, sourceMap: false },
    order: 5
  },
  {
    id: 'security',
    name: 'Security Scanning',
    description: 'Scan for security vulnerabilities',
    enabled: false,
    config: { failOnHigh: true, reportFormat: 'sarif' },
    order: 6
  },
  {
    id: 'docker',
    name: 'Build Container',
    description: 'Build and push Docker container',
    enabled: false,
    config: { registry: '', tag: 'latest', cache: true },
    order: 7
  },
  {
    id: 'deploy',
    name: 'Deploy Application',
    description: 'Deploy to target environment',
    enabled: true,
    config: { strategy: 'rolling', healthCheck: true },
    order: 8
  }
];

export default function CICDSetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [configuration, setConfiguration] = useState<Partial<CICDConfiguration>>({
    stages: DEFAULT_STAGES,
    environments: [
      {
        name: 'production',
        type: 'PRODUCTION',
        autoDeployment: false,
        requiresApproval: true,
        notifications: [],
        secrets: []
      }
    ],
    notifications: {
      email: [],
      webhooks: []
    },
    security: {
      enableSonarQube: false,
      enableSecurityScanning: true,
      enableDependencyCheck: true,
      requireCodeReview: true
    },
    deployment: {
      strategy: 'ROLLING',
      healthChecks: true,
      rollbackOnFailure: true
    }
  });
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!configuration.provider) {
          errors.provider = 'Please select a CI/CD provider';
        }
        break;
      case 2:
        if (!configuration.repositoryUrl) {
          errors.repositoryUrl = 'Repository URL is required';
        }
        if (!configuration.defaultBranch) {
          errors.defaultBranch = 'Default branch is required';
        }
        break;
      case 3:
        // Stages validation is optional as defaults are provided
        break;
      case 4:
        if (!configuration.environments?.length) {
          errors.environments = 'At least one environment is required';
        }
        break;
      case 5:
        // Notifications are optional
        break;
      case 6:
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

  const handleProviderSelect = (providerId: string) => {
    const provider = CICD_PROVIDERS.find(p => p.id === providerId);
    setConfiguration(prev => ({
      ...prev,
      provider: providerId
    }));

    // Update default stages based on provider
    if (providerId === 'github-actions') {
      setConfiguration(prev => ({
        ...prev,
        buildTriggers: ['push', 'pull_request']
      }));
    }
  };

  const handleStageToggle = (stageId: string, enabled: boolean) => {
    setConfiguration(prev => ({
      ...prev,
      stages: prev.stages?.map(stage => 
        stage.id === stageId ? { ...stage, enabled } : stage
      )
    }));
  };

  const handleStageConfigUpdate = (stageId: string, config: Record<string, any>) => {
    setConfiguration(prev => ({
      ...prev,
      stages: prev.stages?.map(stage => 
        stage.id === stageId ? { ...stage, config: { ...stage.config, ...config } } : stage
      )
    }));
  };

  const addEnvironment = () => {
    const newEnvironment: EnvironmentConfig = {
      name: '',
      type: 'DEVELOPMENT',
      autoDeployment: true,
      requiresApproval: false,
      notifications: [],
      secrets: []
    };

    setConfiguration(prev => ({
      ...prev,
      environments: [...(prev.environments || []), newEnvironment]
    }));
  };

  const updateEnvironment = (index: number, updates: Partial<EnvironmentConfig>) => {
    setConfiguration(prev => ({
      ...prev,
      environments: prev.environments?.map((env, i) => 
        i === index ? { ...env, ...updates } : env
      )
    }));
  };

  const removeEnvironment = (index: number) => {
    setConfiguration(prev => ({
      ...prev,
      environments: prev.environments?.filter((_, i) => i !== index)
    }));
  };

  const generatePipelineConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setup/cicd/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configuration)
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'CI/CD pipeline configuration generated successfully'
        });

        // Download the configuration files
        const blob = new Blob([result.data.config], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        a.click();
        URL.revokeObjectURL(url);

      } else {
        throw new Error(result.error || 'Failed to generate configuration');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate CI/CD configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const savePipelineConfiguration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setup/cicd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'save_configuration',
          data: configuration
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'CI/CD configuration saved successfully'
        });
      } else {
        throw new Error(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save CI/CD configuration',
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
              <h3 className="text-lg font-semibold mb-2">Choose CI/CD Provider</h3>
              <p className="text-gray-600 mb-4">
                Select the CI/CD platform that best fits your workflow and infrastructure
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CICD_PROVIDERS.map((provider) => {
                const Icon = provider.icon;
                const isSelected = configuration.provider === provider.id;
                
                return (
                  <Card 
                    key={provider.id}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleProviderSelect(provider.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{provider.name}</h4>
                            <Badge variant={
                              provider.complexity === 'SIMPLE' ? 'default' :
                              provider.complexity === 'INTERMEDIATE' ? 'secondary' : 'destructive'
                            }>
                              {provider.complexity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{provider.description}</p>
                          <div className="space-y-1">
                            {provider.features.slice(0, 2).map((feature, index) => (
                              <div key={index} className="text-xs text-gray-500 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                {feature}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {configuration.provider && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Selected: {CICD_PROVIDERS.find(p => p.id === configuration.provider)?.name}. 
                  This wizard will generate the appropriate configuration files for your chosen platform.
                </AlertDescription>
              </Alert>
            )}

            {validationErrors.provider && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{validationErrors.provider}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Repository Configuration</h3>
              <p className="text-gray-600 mb-4">
                Configure your source code repository and build triggers
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="repositoryUrl">Repository URL</Label>
                <Input
                  id="repositoryUrl"
                  placeholder="https://github.com/organization/repository"
                  value={configuration.repositoryUrl || ''}
                  onChange={(e) => setConfiguration(prev => ({ ...prev, repositoryUrl: e.target.value }))}
                />
                {validationErrors.repositoryUrl && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.repositoryUrl}</p>
                )}
              </div>

              <div>
                <Label htmlFor="defaultBranch">Default Branch</Label>
                <Input
                  id="defaultBranch"
                  placeholder="main"
                  value={configuration.defaultBranch || ''}
                  onChange={(e) => setConfiguration(prev => ({ ...prev, defaultBranch: e.target.value }))}
                />
                {validationErrors.defaultBranch && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.defaultBranch}</p>
                )}
              </div>

              <div>
                <Label>Build Triggers</Label>
                <div className="space-y-2 mt-2">
                  {['push', 'pull_request', 'schedule', 'manual'].map((trigger) => (
                    <div key={trigger} className="flex items-center space-x-2">
                      <Checkbox
                        id={trigger}
                        checked={configuration.buildTriggers?.includes(trigger)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setConfiguration(prev => ({
                              ...prev,
                              buildTriggers: [...(prev.buildTriggers || []), trigger]
                            }));
                          } else {
                            setConfiguration(prev => ({
                              ...prev,
                              buildTriggers: prev.buildTriggers?.filter(t => t !== trigger)
                            }));
                          }
                        }}
                      />
                      <Label htmlFor={trigger} className="capitalize">{trigger.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Pipeline Stages</h3>
              <p className="text-gray-600 mb-4">
                Configure the stages of your CI/CD pipeline
              </p>
            </div>

            <div className="space-y-4">
              {configuration.stages?.map((stage) => (
                <Card key={stage.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={stage.enabled}
                          onCheckedChange={(checked) => handleStageToggle(stage.id, !!checked)}
                        />
                        <div>
                          <h4 className="font-medium">{stage.name}</h4>
                          <p className="text-sm text-gray-600">{stage.description}</p>
                        </div>
                      </div>
                      <Badge variant={stage.enabled ? 'default' : 'secondary'}>
                        {stage.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>

                    {stage.enabled && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {Object.entries(stage.config).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                              <span className="font-medium">{value?.toString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Deployment Environments</h3>
              <p className="text-gray-600 mb-4">
                Configure your deployment environments and approval workflows
              </p>
            </div>

            <div className="space-y-4">
              {configuration.environments?.map((env, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`env-name-${index}`}>Environment Name</Label>
                        <Input
                          id={`env-name-${index}`}
                          value={env.name}
                          onChange={(e) => updateEnvironment(index, { name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`env-type-${index}`}>Type</Label>
                        <Select
                          value={env.type}
                          onValueChange={(value) => updateEnvironment(index, { type: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DEVELOPMENT">Development</SelectItem>
                            <SelectItem value="STAGING">Staging</SelectItem>
                            <SelectItem value="PRODUCTION">Production</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`env-url-${index}`}>URL (Optional)</Label>
                        <Input
                          id={`env-url-${index}`}
                          value={env.url || ''}
                          onChange={(e) => updateEnvironment(index, { url: e.target.value })}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeEnvironment(index)}
                          disabled={configuration.environments?.length === 1}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`auto-deploy-${index}`}
                          checked={env.autoDeployment}
                          onCheckedChange={(checked) => updateEnvironment(index, { autoDeployment: !!checked })}
                        />
                        <Label htmlFor={`auto-deploy-${index}`}>Auto-deployment</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`require-approval-${index}`}
                          checked={env.requiresApproval}
                          onCheckedChange={(checked) => updateEnvironment(index, { requiresApproval: !!checked })}
                        />
                        <Label htmlFor={`require-approval-${index}`}>Requires approval</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button onClick={addEnvironment} variant="outline" className="w-full">
                Add Environment
              </Button>
            </div>

            {validationErrors.environments && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{validationErrors.environments}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Security & Quality</h3>
              <p className="text-gray-600 mb-4">
                Configure security scanning and code quality checks
              </p>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Security Scanning</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="security-scanning"
                      checked={configuration.security?.enableSecurityScanning}
                      onCheckedChange={(checked) => setConfiguration(prev => ({
                        ...prev,
                        security: { ...prev.security!, enableSecurityScanning: !!checked }
                      }))}
                    />
                    <Label htmlFor="security-scanning">Enable security vulnerability scanning</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dependency-check"
                      checked={configuration.security?.enableDependencyCheck}
                      onCheckedChange={(checked) => setConfiguration(prev => ({
                        ...prev,
                        security: { ...prev.security!, enableDependencyCheck: !!checked }
                      }))}
                    />
                    <Label htmlFor="dependency-check">Check for vulnerable dependencies</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="code-review"
                      checked={configuration.security?.requireCodeReview}
                      onCheckedChange={(checked) => setConfiguration(prev => ({
                        ...prev,
                        security: { ...prev.security!, requireCodeReview: !!checked }
                      }))}
                    />
                    <Label htmlFor="code-review">Require code review before merge</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Deployment Strategy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Deployment Strategy</Label>
                    <RadioGroup
                      value={configuration.deployment?.strategy}
                      onValueChange={(value) => setConfiguration(prev => ({
                        ...prev,
                        deployment: { ...prev.deployment!, strategy: value as any }
                      }))}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ROLLING" id="rolling" />
                        <Label htmlFor="rolling">Rolling deployment</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="BLUE_GREEN" id="blue-green" />
                        <Label htmlFor="blue-green">Blue-green deployment</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="CANARY" id="canary" />
                        <Label htmlFor="canary">Canary deployment</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="health-checks"
                      checked={configuration.deployment?.healthChecks}
                      onCheckedChange={(checked) => setConfiguration(prev => ({
                        ...prev,
                        deployment: { ...prev.deployment!, healthChecks: !!checked }
                      }))}
                    />
                    <Label htmlFor="health-checks">Enable health checks</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rollback"
                      checked={configuration.deployment?.rollbackOnFailure}
                      onCheckedChange={(checked) => setConfiguration(prev => ({
                        ...prev,
                        deployment: { ...prev.deployment!, rollbackOnFailure: !!checked }
                      }))}
                    />
                    <Label htmlFor="rollback">Auto-rollback on failure</Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Review Configuration</h3>
              <p className="text-gray-600 mb-4">
                Review your CI/CD pipeline configuration before generation
              </p>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Provider & Repository</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Provider:</span>
                      <span className="ml-2 font-medium">
                        {CICD_PROVIDERS.find(p => p.id === configuration.provider)?.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Repository:</span>
                      <span className="ml-2 font-medium">{configuration.repositoryUrl}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Default Branch:</span>
                      <span className="ml-2 font-medium">{configuration.defaultBranch}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Triggers:</span>
                      <span className="ml-2 font-medium">{configuration.buildTriggers?.join(', ')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pipeline Stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {configuration.stages?.filter(stage => stage.enabled).map((stage) => (
                      <div key={stage.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{stage.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Environments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {configuration.environments?.map((env, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{env.name} ({env.type})</span>
                        <div className="flex gap-2">
                          {env.autoDeployment && <Badge variant="secondary">Auto-deploy</Badge>}
                          {env.requiresApproval && <Badge variant="outline">Approval Required</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <Rocket className="h-4 w-4" />
              <AlertDescription>
                Your CI/CD pipeline configuration is ready. Click "Generate Configuration" to create the necessary files for your chosen platform.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">CI/CD Pipeline Setup</h1>
        <p className="text-gray-600">
          Configure automated deployment pipelines for your developer portal
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
              <>
                <Button
                  onClick={generatePipelineConfig}
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate Configuration
                </Button>
                <Button
                  variant="outline"
                  onClick={savePipelineConfiguration}
                  disabled={loading}
                >
                  Save & Exit
                </Button>
              </>
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