/**
 * Plugin Schema API
 * 
 * Returns the configuration schema for a specific plugin
 * Used by the no-code configuration manager to generate forms
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  Settings,
  Database,
  Shield,
  Globe,
  Zap,
  Monitor,
  GitBranch,
  Code,
  FileText,
  Terminal,
  Users,
  Key,
  Mail,
  Webhook
} from 'lucide-react';

// Plugin configuration schemas for different plugin types
const pluginSchemas: Record<string, any> = {
  '@backstage/plugin-kubernetes': {
    id: '@backstage/plugin-kubernetes',
    name: '@backstage/plugin-kubernetes',
    title: 'Kubernetes Plugin',
    version: '0.18.0',
    sections: [
      {
        id: 'cluster-config',
        title: 'Cluster Configuration',
        description: 'Configure Kubernetes cluster connections',
        icon: 'Database',
        color: 'bg-blue-500',
        fields: [
          {
            key: 'clusters',
            type: 'array',
            label: 'Kubernetes Clusters',
            description: 'List of Kubernetes clusters to connect to',
            required: true,
            placeholder: 'Add cluster configuration'
          },
          {
            key: 'serviceAccountToken',
            type: 'string',
            label: 'Service Account Token',
            description: 'Token for authenticating with Kubernetes API',
            required: true,
            sensitive: true,
            placeholder: 'Enter service account token'
          },
          {
            key: 'skipTLSVerify',
            type: 'boolean',
            label: 'Skip TLS Verification',
            description: 'Skip TLS certificate verification (not recommended for production)',
            default: false
          },
          {
            key: 'dashboardUrl',
            type: 'string',
            label: 'Dashboard URL',
            description: 'URL to Kubernetes dashboard',
            placeholder: 'https://kubernetes-dashboard.example.com'
          }
        ]
      },
      {
        id: 'display-config',
        title: 'Display Settings',
        description: 'Configure how Kubernetes resources are displayed',
        icon: 'Monitor',
        color: 'bg-green-500',
        fields: [
          {
            key: 'objectTypes',
            type: 'multiselect',
            label: 'Resource Types',
            description: 'Kubernetes resource types to display',
            options: [
              { value: 'pods', label: 'Pods' },
              { value: 'services', label: 'Services' },
              { value: 'deployments', label: 'Deployments' },
              { value: 'configmaps', label: 'ConfigMaps' },
              { value: 'secrets', label: 'Secrets' },
              { value: 'ingresses', label: 'Ingresses' }
            ],
            default: ['pods', 'services', 'deployments']
          },
          {
            key: 'refreshInterval',
            type: 'number',
            label: 'Refresh Interval (seconds)',
            description: 'How often to refresh Kubernetes data',
            default: 30,
            min: 10,
            max: 300
          }
        ]
      }
    ],
    examples: {
      'basic': {
        clusters: [
          {
            name: 'production',
            url: 'https://k8s.example.com',
            authProvider: 'serviceAccount'
          }
        ],
        serviceAccountToken: '${K8S_SERVICE_ACCOUNT_TOKEN}',
        objectTypes: ['pods', 'services', 'deployments'],
        refreshInterval: 30
      },
      'multi-cluster': {
        clusters: [
          {
            name: 'production',
            url: 'https://k8s-prod.example.com',
            authProvider: 'serviceAccount'
          },
          {
            name: 'staging',
            url: 'https://k8s-staging.example.com',
            authProvider: 'serviceAccount'
          }
        ],
        serviceAccountToken: '${K8S_SERVICE_ACCOUNT_TOKEN}',
        objectTypes: ['pods', 'services', 'deployments', 'configmaps'],
        refreshInterval: 60
      }
    },
    documentation: 'https://backstage.io/docs/features/kubernetes/',
    requirements: [
      'Kubernetes cluster access',
      'Service account with appropriate permissions',
      'Network connectivity to Kubernetes API'
    ]
  },

  '@backstage/plugin-github-actions': {
    id: '@backstage/plugin-github-actions',
    name: '@backstage/plugin-github-actions',
    title: 'GitHub Actions Plugin',
    version: '0.8.0',
    sections: [
      {
        id: 'github-config',
        title: 'GitHub Configuration',
        description: 'Configure GitHub integration settings',
        icon: 'GitBranch',
        color: 'bg-purple-500',
        fields: [
          {
            key: 'github.token',
            type: 'string',
            label: 'GitHub Token',
            description: 'Personal access token for GitHub API',
            required: true,
            sensitive: true,
            placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx'
          },
          {
            key: 'github.baseUrl',
            type: 'string',
            label: 'GitHub Base URL',
            description: 'Base URL for GitHub API (for GitHub Enterprise)',
            default: 'https://api.github.com',
            placeholder: 'https://api.github.com'
          },
          {
            key: 'github.apiVersion',
            type: 'string',
            label: 'API Version',
            description: 'GitHub API version to use',
            default: '2022-11-28'
          }
        ]
      },
      {
        id: 'workflow-config',
        title: 'Workflow Settings',
        description: 'Configure GitHub Actions workflow behavior',
        icon: 'Zap',
        color: 'bg-orange-500',
        fields: [
          {
            key: 'enableWorkflowTrigger',
            type: 'boolean',
            label: 'Enable Workflow Triggering',
            description: 'Allow triggering workflows from Backstage',
            default: true
          },
          {
            key: 'workflowPickerUrl',
            type: 'string',
            label: 'Workflow Picker URL',
            description: 'URL pattern for workflow picker',
            placeholder: 'https://github.com/{owner}/{repo}/actions'
          },
          {
            key: 'defaultBranch',
            type: 'string',
            label: 'Default Branch',
            description: 'Default branch for workflow operations',
            default: 'main'
          }
        ]
      }
    ],
    examples: {
      'basic': {
        github: {
          token: '${GITHUB_TOKEN}',
          baseUrl: 'https://api.github.com'
        },
        enableWorkflowTrigger: true,
        defaultBranch: 'main'
      },
      'enterprise': {
        github: {
          token: '${GITHUB_ENTERPRISE_TOKEN}',
          baseUrl: 'https://github.company.com/api/v3'
        },
        enableWorkflowTrigger: true,
        workflowPickerUrl: 'https://github.company.com/{owner}/{repo}/actions',
        defaultBranch: 'master'
      }
    },
    documentation: 'https://backstage.io/docs/integrations/github/github-actions',
    requirements: [
      'GitHub account or GitHub Enterprise',
      'Personal access token with appropriate scopes',
      'Repository access permissions'
    ]
  },

  '@roadiehq/backstage-plugin-jira': {
    id: '@roadiehq/backstage-plugin-jira',
    name: '@roadiehq/backstage-plugin-jira',
    title: 'Jira Integration Plugin',
    version: '2.5.0',
    sections: [
      {
        id: 'jira-auth',
        title: 'Jira Authentication',
        description: 'Configure Jira connection and authentication',
        icon: 'Key',
        color: 'bg-blue-600',
        fields: [
          {
            key: 'jira.url',
            type: 'string',
            label: 'Jira URL',
            description: 'Base URL of your Jira instance',
            required: true,
            placeholder: 'https://your-company.atlassian.net'
          },
          {
            key: 'jira.username',
            type: 'string',
            label: 'Username',
            description: 'Jira username or email',
            required: true,
            placeholder: 'user@company.com'
          },
          {
            key: 'jira.password',
            type: 'string',
            label: 'API Token',
            description: 'Jira API token (recommended) or password',
            required: true,
            sensitive: true,
            placeholder: 'Your Jira API token'
          },
          {
            key: 'jira.userEmailSuffix',
            type: 'string',
            label: 'User Email Suffix',
            description: 'Email suffix for user mapping',
            placeholder: '@company.com'
          }
        ]
      },
      {
        id: 'jira-display',
        title: 'Display Configuration',
        description: 'Configure how Jira tickets are displayed',
        icon: 'Monitor',
        color: 'bg-green-600',
        fields: [
          {
            key: 'jira.maxIssues',
            type: 'number',
            label: 'Maximum Issues',
            description: 'Maximum number of issues to display',
            default: 50,
            min: 1,
            max: 200
          },
          {
            key: 'jira.issueStates',
            type: 'multiselect',
            label: 'Issue States',
            description: 'Which issue states to display',
            options: [
              { value: 'To Do', label: 'To Do' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Done', label: 'Done' },
              { value: 'Backlog', label: 'Backlog' }
            ],
            default: ['To Do', 'In Progress']
          },
          {
            key: 'jira.issueTypes',
            type: 'multiselect',
            label: 'Issue Types',
            description: 'Which issue types to display',
            options: [
              { value: 'Bug', label: 'Bug' },
              { value: 'Story', label: 'Story' },
              { value: 'Task', label: 'Task' },
              { value: 'Epic', label: 'Epic' }
            ],
            default: ['Bug', 'Story', 'Task']
          }
        ]
      }
    ],
    examples: {
      'cloud': {
        jira: {
          url: 'https://your-company.atlassian.net',
          username: 'admin@company.com',
          password: '${JIRA_API_TOKEN}',
          userEmailSuffix: '@company.com'
        },
        maxIssues: 50,
        issueStates: ['To Do', 'In Progress'],
        issueTypes: ['Bug', 'Story', 'Task']
      },
      'server': {
        jira: {
          url: 'https://jira.company.com',
          username: 'backstage-service',
          password: '${JIRA_PASSWORD}',
          userEmailSuffix: '@company.com'
        },
        maxIssues: 100,
        issueStates: ['To Do', 'In Progress', 'Done'],
        issueTypes: ['Bug', 'Story', 'Task', 'Epic']
      }
    },
    documentation: 'https://roadie.io/backstage/plugins/jira/',
    requirements: [
      'Jira Cloud or Server instance',
      'Jira API token or username/password',
      'Appropriate Jira permissions'
    ]
  },

  '@roadiehq/backstage-plugin-argo-cd': {
    id: '@roadiehq/backstage-plugin-argo-cd',
    name: '@roadiehq/backstage-plugin-argo-cd',
    title: 'ArgoCD Plugin',
    version: '2.14.0',
    sections: [
      {
        id: 'argocd-config',
        title: 'ArgoCD Configuration',
        description: 'Configure ArgoCD connection settings',
        icon: 'GitBranch',
        color: 'bg-teal-600',
        fields: [
          {
            key: 'argocd.appLocatorMethods',
            type: 'multiselect',
            label: 'App Locator Methods',
            description: 'Methods to locate ArgoCD applications',
            options: [
              { value: 'type', label: 'By Type' },
              { value: 'name', label: 'By Name' },
              { value: 'namespace', label: 'By Namespace' }
            ],
            default: ['type']
          },
          {
            key: 'argocd.baseUrl',
            type: 'string',
            label: 'ArgoCD Base URL',
            description: 'Base URL of your ArgoCD instance',
            required: true,
            placeholder: 'https://argocd.example.com'
          },
          {
            key: 'argocd.apiVersion',
            type: 'select',
            label: 'API Version',
            description: 'ArgoCD API version to use',
            options: [
              { value: 'v1alpha1', label: 'v1alpha1' },
              { value: 'v1beta1', label: 'v1beta1' }
            ],
            default: 'v1alpha1'
          }
        ]
      },
      {
        id: 'auth-config',
        title: 'Authentication',
        description: 'Configure ArgoCD authentication',
        icon: 'Shield',
        color: 'bg-red-600',
        fields: [
          {
            key: 'argocd.username',
            type: 'string',
            label: 'Username',
            description: 'ArgoCD username',
            placeholder: 'admin'
          },
          {
            key: 'argocd.password',
            type: 'string',
            label: 'Password',
            description: 'ArgoCD password or token',
            sensitive: true,
            placeholder: 'Your ArgoCD password'
          },
          {
            key: 'argocd.token',
            type: 'string',
            label: 'API Token',
            description: 'ArgoCD API token (preferred over password)',
            sensitive: true,
            placeholder: 'ArgoCD API token'
          }
        ]
      }
    ],
    examples: {
      'basic': {
        argocd: {
          baseUrl: 'https://argocd.example.com',
          username: 'admin',
          password: '${ARGOCD_PASSWORD}',
          appLocatorMethods: ['type'],
          apiVersion: 'v1alpha1'
        }
      },
      'token-auth': {
        argocd: {
          baseUrl: 'https://argocd.example.com',
          token: '${ARGOCD_TOKEN}',
          appLocatorMethods: ['type', 'name'],
          apiVersion: 'v1beta1'
        }
      }
    },
    documentation: 'https://roadie.io/backstage/plugins/argo-cd/',
    requirements: [
      'ArgoCD instance',
      'ArgoCD credentials or API token',
      'Network access to ArgoCD API'
    ]
  }
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = decodeURIComponent(params.id);
    
    console.log(`Fetching schema for plugin: ${pluginId}`);
    
    // Get schema for the specific plugin
    const schema = pluginSchemas[pluginId];
    
    if (!schema) {
      // Return a generic schema for unknown plugins
      const genericSchema = {
        id: pluginId,
        name: pluginId,
        title: pluginId.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Plugin',
        version: '1.0.0',
        sections: [
          {
            id: 'basic-config',
            title: 'Basic Configuration',
            description: 'Basic plugin configuration settings',
            icon: 'Settings',
            color: 'bg-gray-500',
            fields: [
              {
                key: 'enabled',
                type: 'boolean',
                label: 'Enable Plugin',
                description: 'Enable or disable this plugin',
                default: true
              },
              {
                key: 'title',
                type: 'string',
                label: 'Display Title',
                description: 'Title to display for this plugin',
                placeholder: 'Enter plugin title'
              },
              {
                key: 'description',
                type: 'string',
                label: 'Description',
                description: 'Description of what this plugin does',
                placeholder: 'Enter plugin description'
              }
            ]
          }
        ],
        examples: {
          'default': {
            enabled: true,
            title: 'My Plugin',
            description: 'A useful plugin for our platform'
          }
        },
        documentation: `https://backstage.io/docs/plugins/${pluginId}`,
        requirements: [
          'Basic Backstage setup',
          'Plugin-specific dependencies'
        ]
      };
      
      return NextResponse.json(genericSchema);
    }
    
    return NextResponse.json(schema);
    
  } catch (error) {
    console.error('Failed to fetch plugin schema:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch plugin schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = decodeURIComponent(params.id);
    const body = await req.json();
    const { schema } = body;
    
    console.log(`Updating schema for plugin: ${pluginId}`);
    
    // In a real implementation, this would save the schema to a database
    // For now, we'll just validate it and return success
    
    if (!schema || !schema.sections) {
      return NextResponse.json(
        { error: 'Invalid schema format' },
        { status: 400 }
      );
    }
    
    // Store the schema (in memory for this example)
    pluginSchemas[pluginId] = {
      ...schema,
      id: pluginId,
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json({
      success: true,
      message: `Schema updated for plugin ${pluginId}`,
      schema: pluginSchemas[pluginId]
    });
    
  } catch (error) {
    console.error('Failed to update plugin schema:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update plugin schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}