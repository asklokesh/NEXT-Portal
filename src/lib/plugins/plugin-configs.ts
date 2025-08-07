/**
 * Plugin Configuration Schemas
 * Comprehensive no-code configuration definitions for all major Backstage plugins
 */

export interface PluginConfigField {
 name: string;
 label: string;
 type: 'text' | 'password' | 'url' | 'number' | 'boolean' | 'select' | 'textarea' | 'json';
 required: boolean;
 description: string;
 placeholder?: string;
 options?: { value: string; label: string }[];
 validation?: {
 pattern?: string;
 min?: number;
 max?: number;
 };
 defaultValue?: any;
 sensitive?: boolean; // For secrets/passwords
}

export interface PluginConfigSection {
 title: string;
 description: string;
 fields: PluginConfigField[];
}

export interface PluginConfigSchema {
 pluginId: string;
 pluginName: string;
 version: string;
 description: string;
 documentationUrl: string;
 sections: PluginConfigSection[];
 requiredIntegrations?: string[]; // e.g., ['github', 'kubernetes']
 environmentVariables?: string[]; // Environment variables that need to be set
}

// Kubernetes Plugin Configuration
export const kubernetesPluginConfig: PluginConfigSchema = {
 pluginId: 'kubernetes',
 pluginName: 'Kubernetes',
 version: '0.18.0',
 description: 'View and manage Kubernetes resources for your services',
 documentationUrl: 'https://backstage.io/docs/features/kubernetes/',
 sections: [
 {
 title: 'Cluster Configuration',
 description: 'Configure your Kubernetes clusters',
 fields: [
 {
 name: 'clusterName',
 label: 'Cluster Name',
 type: 'text',
 required: true,
 description: 'A friendly name for your Kubernetes cluster',
 placeholder: 'production-cluster'
 },
 {
 name: 'apiServerUrl',
 label: 'API Server URL',
 type: 'url',
 required: true,
 description: 'The URL of your Kubernetes API server',
 placeholder: 'https://kubernetes.example.com:6443'
 },
 {
 name: 'authType',
 label: 'Authentication Type',
 type: 'select',
 required: true,
 description: 'How to authenticate with the Kubernetes cluster',
 options: [
 { value: 'serviceAccount', label: 'Service Account Token' },
 { value: 'kubeconfig', label: 'Kubeconfig File' },
 { value: 'oidc', label: 'OIDC' },
 { value: 'aws', label: 'AWS IAM' },
 { value: 'gcp', label: 'Google Cloud' }
 ],
 defaultValue: 'serviceAccount'
 },
 {
 name: 'serviceAccountToken',
 label: 'Service Account Token',
 type: 'password',
 required: false,
 description: 'Bearer token for service account authentication',
 sensitive: true
 },
 {
 name: 'skipTLSVerify',
 label: 'Skip TLS Verification',
 type: 'boolean',
 required: false,
 description: 'Skip TLS certificate verification (not recommended for production)',
 defaultValue: false
 }
 ]
 },
 {
 title: 'Resource Discovery',
 description: 'Configure which resources to display',
 fields: [
 {
 name: 'objectTypes',
 label: 'Object Types',
 type: 'select',
 required: false,
 description: 'Kubernetes object types to display',
 // This would be a multi-select in the UI
 options: [
 { value: 'pods', label: 'Pods' },
 { value: 'services', label: 'Services' },
 { value: 'deployments', label: 'Deployments' },
 { value: 'ingresses', label: 'Ingresses' },
 { value: 'configmaps', label: 'ConfigMaps' },
 { value: 'secrets', label: 'Secrets' }
 ]
 },
 {
 name: 'refreshInterval',
 label: 'Refresh Interval (seconds)',
 type: 'number',
 required: false,
 description: 'How often to refresh cluster data',
 defaultValue: 30,
 validation: { min: 10, max: 300 }
 }
 ]
 }
 ],
 environmentVariables: ['KUBERNETES_SERVICE_ACCOUNT_TOKEN']
};

// GitHub Plugin Configuration
export const githubPluginConfig: PluginConfigSchema = {
 pluginId: 'github-actions',
 pluginName: 'GitHub Actions',
 version: '0.8.0',
 description: 'View and trigger GitHub Actions workflows',
 documentationUrl: 'https://backstage.io/docs/integrations/github/github-actions',
 sections: [
 {
 title: 'GitHub Integration',
 description: 'Configure GitHub API access',
 fields: [
 {
 name: 'token',
 label: 'GitHub Personal Access Token',
 type: 'password',
 required: true,
 description: 'GitHub PAT with repo and workflow scopes',
 sensitive: true
 },
 {
 name: 'baseUrl',
 label: 'GitHub Base URL',
 type: 'url',
 required: false,
 description: 'For GitHub Enterprise Server installations',
 placeholder: 'https://github.com',
 defaultValue: 'https://github.com'
 },
 {
 name: 'apiBaseUrl',
 label: 'GitHub API Base URL',
 type: 'url',
 required: false,
 description: 'GitHub API endpoint',
 placeholder: 'https://api.github.com',
 defaultValue: 'https://api.github.com'
 }
 ]
 },
 {
 title: 'Workflow Settings',
 description: 'Configure workflow behavior',
 fields: [
 {
 name: 'defaultOrg',
 label: 'Default Organization',
 type: 'text',
 required: false,
 description: 'Default GitHub organization to use',
 placeholder: 'my-company'
 },
 {
 name: 'workflowTimeout',
 label: 'Workflow Timeout (minutes)',
 type: 'number',
 required: false,
 description: 'Maximum time to wait for workflow completion',
 defaultValue: 30,
 validation: { min: 1, max: 360 }
 }
 ]
 }
 ],
 requiredIntegrations: ['github'],
 environmentVariables: ['GITHUB_TOKEN']
};

// Jira Plugin Configuration
export const jiraPluginConfig: PluginConfigSchema = {
 pluginId: 'jira',
 pluginName: 'Jira Integration',
 version: '2.5.0',
 description: 'View Jira tickets and project information for your services',
 documentationUrl: 'https://roadie.io/backstage/plugins/jira/',
 sections: [
 {
 title: 'Jira Server Configuration',
 description: 'Configure connection to your Jira instance',
 fields: [
 {
 name: 'baseUrl',
 label: 'Jira Base URL',
 type: 'url',
 required: true,
 description: 'The base URL of your Jira instance',
 placeholder: 'https://mycompany.atlassian.net'
 },
 {
 name: 'email',
 label: 'Email Address',
 type: 'text',
 required: true,
 description: 'Your Jira account email address',
 placeholder: 'user@company.com'
 },
 {
 name: 'apiToken',
 label: 'API Token',
 type: 'password',
 required: true,
 description: 'Jira API token (create from Account Settings > Security)',
 sensitive: true
 }
 ]
 },
 {
 title: 'Project Settings',
 description: 'Configure project filtering and display',
 fields: [
 {
 name: 'defaultProject',
 label: 'Default Project Key',
 type: 'text',
 required: false,
 description: 'Default Jira project to display',
 placeholder: 'PROJ'
 },
 {
 name: 'issueTypes',
 label: 'Issue Types to Display',
 type: 'textarea',
 required: false,
 description: 'Comma-separated list of issue types (leave empty for all)',
 placeholder: 'Bug, Story, Task, Epic'
 },
 {
 name: 'maxResults',
 label: 'Maximum Results',
 type: 'number',
 required: false,
 description: 'Maximum number of issues to fetch',
 defaultValue: 50,
 validation: { min: 1, max: 1000 }
 }
 ]
 }
 ],
 environmentVariables: ['JIRA_API_TOKEN']
};

// Confluence Plugin Configuration
export const confluencePluginConfig: PluginConfigSchema = {
 pluginId: 'confluence',
 pluginName: 'Confluence',
 version: '0.2.0',
 description: 'Browse and search Confluence spaces and pages',
 documentationUrl: 'https://github.com/K-Phoen/backstage-plugin-confluence',
 sections: [
 {
 title: 'Confluence Configuration',
 description: 'Configure connection to Confluence',
 fields: [
 {
 name: 'baseUrl',
 label: 'Confluence Base URL',
 type: 'url',
 required: true,
 description: 'The base URL of your Confluence instance',
 placeholder: 'https://mycompany.atlassian.net/wiki'
 },
 {
 name: 'username',
 label: 'Username',
 type: 'text',
 required: true,
 description: 'Your Confluence username or email',
 placeholder: 'user@company.com'
 },
 {
 name: 'apiToken',
 label: 'API Token',
 type: 'password',
 required: true,
 description: 'Confluence API token',
 sensitive: true
 },
 {
 name: 'spaces',
 label: 'Spaces to Index',
 type: 'textarea',
 required: false,
 description: 'Comma-separated list of space keys (leave empty for all)',
 placeholder: 'DOCS, TECH, TEAM'
 }
 ]
 }
 ],
 environmentVariables: ['CONFLUENCE_API_TOKEN']
};

// ServiceNow Plugin Configuration
export const servicenowPluginConfig: PluginConfigSchema = {
 pluginId: 'servicenow',
 pluginName: 'ServiceNow',
 version: '1.3.0',
 description: 'ServiceNow integration for incident and change management',
 documentationUrl: 'https://github.com/Oriflame/backstage-plugins',
 sections: [
 {
 title: 'ServiceNow Instance',
 description: 'Configure ServiceNow connection',
 fields: [
 {
 name: 'instanceUrl',
 label: 'ServiceNow Instance URL',
 type: 'url',
 required: true,
 description: 'Your ServiceNow instance URL',
 placeholder: 'https://mycompany.service-now.com'
 },
 {
 name: 'username',
 label: 'Username',
 type: 'text',
 required: true,
 description: 'ServiceNow username',
 placeholder: 'api.user'
 },
 {
 name: 'password',
 label: 'Password',
 type: 'password',
 required: true,
 description: 'ServiceNow password',
 sensitive: true
 }
 ]
 },
 {
 title: 'Table Configuration',
 description: 'Configure which ServiceNow tables to access',
 fields: [
 {
 name: 'incidentTable',
 label: 'Incident Table',
 type: 'text',
 required: false,
 description: 'ServiceNow incident table name',
 defaultValue: 'incident',
 placeholder: 'incident'
 },
 {
 name: 'changeTable',
 label: 'Change Request Table',
 type: 'text',
 required: false,
 description: 'ServiceNow change request table name',
 defaultValue: 'change_request',
 placeholder: 'change_request'
 }
 ]
 }
 ],
 environmentVariables: ['SERVICENOW_PASSWORD']
};

// ArgoCD Plugin Configuration
export const argoCDPluginConfig: PluginConfigSchema = {
 pluginId: 'argocd',
 pluginName: 'ArgoCD',
 version: '2.14.0',
 description: 'View ArgoCD applications and deployment status',
 documentationUrl: 'https://roadie.io/backstage/plugins/argo-cd/',
 sections: [
 {
 title: 'ArgoCD Server',
 description: 'Configure ArgoCD server connection',
 fields: [
 {
 name: 'baseUrl',
 label: 'ArgoCD Server URL',
 type: 'url',
 required: true,
 description: 'URL of your ArgoCD server',
 placeholder: 'https://argocd.company.com'
 },
 {
 name: 'authType',
 label: 'Authentication Type',
 type: 'select',
 required: true,
 description: 'How to authenticate with ArgoCD',
 options: [
 { value: 'token', label: 'API Token' },
 { value: 'username', label: 'Username/Password' },
 { value: 'sso', label: 'SSO' }
 ],
 defaultValue: 'token'
 },
 {
 name: 'apiToken',
 label: 'API Token',
 type: 'password',
 required: false,
 description: 'ArgoCD API token',
 sensitive: true
 },
 {
 name: 'username',
 label: 'Username',
 type: 'text',
 required: false,
 description: 'ArgoCD username (if using username/password auth)'
 },
 {
 name: 'password',
 label: 'Password',
 type: 'password',
 required: false,
 description: 'ArgoCD password',
 sensitive: true
 }
 ]
 }
 ],
 environmentVariables: ['ARGOCD_API_TOKEN']
};

// Jenkins Plugin Configuration
export const jenkinsPluginConfig: PluginConfigSchema = {
 pluginId: 'jenkins',
 pluginName: 'Jenkins',
 version: '0.7.0',
 description: 'View Jenkins builds and job information',
 documentationUrl: 'https://backstage.io/docs/integrations/jenkins/',
 sections: [
 {
 title: 'Jenkins Server',
 description: 'Configure Jenkins server connection',
 fields: [
 {
 name: 'baseUrl',
 label: 'Jenkins Base URL',
 type: 'url',
 required: true,
 description: 'The base URL of your Jenkins server',
 placeholder: 'https://jenkins.company.com'
 },
 {
 name: 'username',
 label: 'Username',
 type: 'text',
 required: true,
 description: 'Jenkins username',
 placeholder: 'jenkins-user'
 },
 {
 name: 'apiKey',
 label: 'API Token',
 type: 'password',
 required: true,
 description: 'Jenkins API token (generate from user settings)',
 sensitive: true
 }
 ]
 }
 ],
 environmentVariables: ['JENKINS_API_KEY']
};

// Terraform Plugin Configuration
export const terraformPluginConfig: PluginConfigSchema = {
 pluginId: 'terraform',
 pluginName: 'Terraform',
 version: '1.5.0',
 description: 'View Terraform state and plan information',
 documentationUrl: 'https://roadie.io/backstage/plugins/terraform/',
 sections: [
 {
 title: 'Terraform Configuration',
 description: 'Configure Terraform integration',
 fields: [
 {
 name: 'cloudProvider',
 label: 'Cloud Provider',
 type: 'select',
 required: true,
 description: 'Primary cloud provider for Terraform resources',
 options: [
 { value: 'aws', label: 'Amazon Web Services' },
 { value: 'gcp', label: 'Google Cloud Platform' },
 { value: 'azure', label: 'Microsoft Azure' },
 { value: 'multi', label: 'Multi-Cloud' }
 ]
 },
 {
 name: 'stateBackend',
 label: 'State Backend Type',
 type: 'select',
 required: true,
 description: 'Terraform state backend configuration',
 options: [
 { value: 's3', label: 'AWS S3' },
 { value: 'gcs', label: 'Google Cloud Storage' },
 { value: 'azurerm', label: 'Azure Storage' },
 { value: 'remote', label: 'Terraform Cloud' }
 ]
 },
 {
 name: 'workspacePrefix',
 label: 'Workspace Prefix',
 type: 'text',
 required: false,
 description: 'Prefix for Terraform workspaces',
 placeholder: 'app-'
 }
 ]
 }
 ]
};

// HashiCorp Vault Plugin Configuration
export const vaultPluginConfig: PluginConfigSchema = {
 pluginId: 'vault',
 pluginName: 'HashiCorp Vault',
 version: '2.3.0',
 description: 'Manage secrets and view Vault policies',
 documentationUrl: 'https://roadie.io/backstage/plugins/vault/',
 sections: [
 {
 title: 'Vault Server',
 description: 'Configure Vault server connection',
 fields: [
 {
 name: 'baseUrl',
 label: 'Vault Server URL',
 type: 'url',
 required: true,
 description: 'The URL of your Vault server',
 placeholder: 'https://vault.company.com'
 },
 {
 name: 'token',
 label: 'Vault Token',
 type: 'password',
 required: true,
 description: 'Vault authentication token',
 sensitive: true
 },
 {
 name: 'namespace',
 label: 'Vault Namespace',
 type: 'text',
 required: false,
 description: 'Vault namespace (Enterprise feature)',
 placeholder: 'admin/team'
 }
 ]
 }
 ],
 environmentVariables: ['VAULT_TOKEN']
};

// AWS Plugin Configuration
export const awsPluginConfig: PluginConfigSchema = {
 pluginId: 'aws',
 pluginName: 'AWS Integration',
 version: '2.8.0',
 description: 'View AWS resources and services for your applications',
 documentationUrl: 'https://roadie.io/backstage/plugins/aws/',
 sections: [
 {
 title: 'AWS Configuration',
 description: 'Configure AWS integration',
 fields: [
 {
 name: 'region',
 label: 'Default AWS Region',
 type: 'select',
 required: true,
 description: 'Default AWS region for resources',
 options: [
 { value: 'us-east-1', label: 'US East (N. Virginia)' },
 { value: 'us-west-2', label: 'US West (Oregon)' },
 { value: 'eu-west-1', label: 'Europe (Ireland)' },
 { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
 ],
 defaultValue: 'us-east-1'
 },
 {
 name: 'accessKeyId',
 label: 'Access Key ID',
 type: 'text',
 required: true,
 description: 'AWS Access Key ID',
 sensitive: true
 },
 {
 name: 'secretAccessKey',
 label: 'Secret Access Key',
 type: 'password',
 required: true,
 description: 'AWS Secret Access Key',
 sensitive: true
 },
 {
 name: 'assumeRole',
 label: 'IAM Role ARN (Optional)',
 type: 'text',
 required: false,
 description: 'IAM role to assume for cross-account access',
 placeholder: 'arn:aws:iam::123456789012:role/BackstageRole'
 }
 ]
 }
 ],
 environmentVariables: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
};

// Harness Plugin Configuration
export const harnessPluginConfig: PluginConfigSchema = {
 pluginId: 'harness',
 pluginName: 'Harness CI/CD',
 version: '0.4.0',
 description: 'View Harness pipelines and deployment information',
 documentationUrl: 'https://github.com/harness/backstage-plugins',
 sections: [
 {
 title: 'Harness Configuration',
 description: 'Configure Harness platform integration',
 fields: [
 {
 name: 'baseUrl',
 label: 'Harness Platform URL',
 type: 'url',
 required: true,
 description: 'Harness platform base URL',
 placeholder: 'https://app.harness.io',
 defaultValue: 'https://app.harness.io'
 },
 {
 name: 'apiKey',
 label: 'API Key',
 type: 'password',
 required: true,
 description: 'Harness API key',
 sensitive: true
 },
 {
 name: 'accountId',
 label: 'Account ID',
 type: 'text',
 required: true,
 description: 'Harness account identifier'
 }
 ]
 }
 ],
 environmentVariables: ['HARNESS_API_KEY']
};

// Splunk Plugin Configuration
export const splunkPluginConfig: PluginConfigSchema = {
 pluginId: 'splunk',
 pluginName: 'Splunk On-Call',
 version: '1.2.0',
 description: 'Incident management with Splunk On-Call integration',
 documentationUrl: 'https://github.com/splunk/backstage-plugin-splunk-on-call',
 sections: [
 {
 title: 'Splunk On-Call Configuration',
 description: 'Configure Splunk On-Call integration',
 fields: [
 {
 name: 'apiId',
 label: 'API ID',
 type: 'text',
 required: true,
 description: 'Splunk On-Call API ID'
 },
 {
 name: 'apiKey',
 label: 'API Key',
 type: 'password',
 required: true,
 description: 'Splunk On-Call API key',
 sensitive: true
 },
 {
 name: 'routingKey',
 label: 'Routing Key',
 type: 'text',
 required: true,
 description: 'Default routing key for incidents'
 }
 ]
 }
 ],
 environmentVariables: ['SPLUNK_API_KEY']
};

// Score.dev Plugin Configuration
export const scoreDevPluginConfig: PluginConfigSchema = {
 pluginId: 'score-dev',
 pluginName: 'Score.dev',
 version: '0.3.0',
 description: 'Validate and deploy workloads using Score specifications',
 documentationUrl: 'https://docs.score.dev/',
 sections: [
 {
 title: 'Score CLI Configuration',
 description: 'Configure Score CLI integration',
 fields: [
 {
 name: 'scoreCliPath',
 label: 'Score CLI Path',
 type: 'text',
 required: false,
 description: 'Path to Score CLI binary (leave empty for system PATH)',
 placeholder: '/usr/local/bin/score',
 defaultValue: 'score'
 },
 {
 name: 'defaultPlatform',
 label: 'Default Platform',
 type: 'select',
 required: true,
 description: 'Default platform for Score deployments',
 options: [
 { value: 'docker', label: 'Docker Compose' },
 { value: 'kubernetes', label: 'Kubernetes' },
 { value: 'helm', label: 'Helm' }
 ],
 defaultValue: 'kubernetes'
 }
 ]
 },
 {
 title: 'Workload Validation',
 description: 'Configure workload validation settings',
 fields: [
 {
 name: 'validateOnSave',
 label: 'Validate on Save',
 type: 'boolean',
 required: false,
 description: 'Automatically validate Score files when saving',
 defaultValue: true
 },
 {
 name: 'schemaValidation',
 label: 'Schema Validation',
 type: 'boolean',
 required: false,
 description: 'Enable strict schema validation',
 defaultValue: true
 }
 ]
 }
 ]
};

// Google Cloud Platform Plugin Configuration
export const gcpPluginConfig: PluginConfigSchema = {
 pluginId: 'gcp',
 pluginName: 'Google Cloud Platform',
 version: '1.4.0',
 description: 'View and manage Google Cloud Platform resources',
 documentationUrl: 'https://cloud.google.com/docs',
 sections: [
 {
 title: 'GCP Authentication',
 description: 'Configure Google Cloud Platform access',
 fields: [
 {
 name: 'projectId',
 label: 'Project ID',
 type: 'text',
 required: true,
 description: 'Your Google Cloud Project ID',
 placeholder: 'my-gcp-project'
 },
 {
 name: 'serviceAccountKey',
 label: 'Service Account Key (JSON)',
 type: 'json',
 required: true,
 description: 'Service account key in JSON format',
 sensitive: true
 },
 {
 name: 'region',
 label: 'Default Region',
 type: 'select',
 required: true,
 description: 'Default GCP region for resources',
 options: [
 { value: 'us-central1', label: 'US Central (Iowa)' },
 { value: 'us-east1', label: 'US East (South Carolina)' },
 { value: 'us-west1', label: 'US West (Oregon)' },
 { value: 'europe-west1', label: 'Europe West (Belgium)' },
 { value: 'asia-east1', label: 'Asia East (Taiwan)' }
 ],
 defaultValue: 'us-central1'
 }
 ]
 }
 ],
 environmentVariables: ['GOOGLE_APPLICATION_CREDENTIALS']
};

// Microsoft Azure Plugin Configuration
export const azurePluginConfig: PluginConfigSchema = {
 pluginId: 'azure',
 pluginName: 'Microsoft Azure',
 version: '2.1.0',
 description: 'View and manage Microsoft Azure resources',
 documentationUrl: 'https://docs.microsoft.com/en-us/azure/',
 sections: [
 {
 title: 'Azure Authentication',
 description: 'Configure Microsoft Azure access',
 fields: [
 {
 name: 'subscriptionId',
 label: 'Subscription ID',
 type: 'text',
 required: true,
 description: 'Your Azure subscription ID',
 placeholder: '12345678-1234-1234-1234-123456789012'
 },
 {
 name: 'tenantId',
 label: 'Tenant ID',
 type: 'text',
 required: true,
 description: 'Your Azure Active Directory tenant ID',
 placeholder: '87654321-4321-4321-4321-210987654321'
 },
 {
 name: 'clientId',
 label: 'Client ID',
 type: 'text',
 required: true,
 description: 'Service principal client ID',
 placeholder: 'abcdef12-3456-7890-abcd-ef1234567890'
 },
 {
 name: 'clientSecret',
 label: 'Client Secret',
 type: 'password',
 required: true,
 description: 'Service principal client secret',
 sensitive: true
 },
 {
 name: 'resourceGroup',
 label: 'Default Resource Group',
 type: 'text',
 required: false,
 description: 'Default resource group for operations',
 placeholder: 'my-resource-group'
 }
 ]
 }
 ],
 environmentVariables: ['AZURE_CLIENT_SECRET']
};

// Route53 DNS Plugin Configuration
export const route53PluginConfig: PluginConfigSchema = {
 pluginId: 'route53',
 pluginName: 'Route53 DNS',
 version: '1.2.0',
 description: 'Manage DNS records and hosted zones in AWS Route53',
 documentationUrl: 'https://docs.aws.amazon.com/route53/',
 sections: [
 {
 title: 'AWS Route53 Configuration',
 description: 'Configure Route53 DNS management',
 fields: [
 {
 name: 'accessKeyId',
 label: 'AWS Access Key ID',
 type: 'text',
 required: true,
 description: 'AWS Access Key ID with Route53 permissions',
 sensitive: true
 },
 {
 name: 'secretAccessKey',
 label: 'AWS Secret Access Key',
 type: 'password',
 required: true,
 description: 'AWS Secret Access Key',
 sensitive: true
 },
 {
 name: 'region',
 label: 'AWS Region',
 type: 'select',
 required: true,
 description: 'AWS region for Route53 operations',
 options: [
 { value: 'us-east-1', label: 'US East (N. Virginia)' },
 { value: 'us-west-2', label: 'US West (Oregon)' },
 { value: 'eu-west-1', label: 'Europe (Ireland)' }
 ],
 defaultValue: 'us-east-1'
 },
 {
 name: 'hostedZoneId',
 label: 'Default Hosted Zone ID',
 type: 'text',
 required: false,
 description: 'Default hosted zone for DNS operations',
 placeholder: 'Z1234567890ABC'
 }
 ]
 }
 ],
 environmentVariables: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
};

// AppDynamics Plugin Configuration
export const appDynamicsPluginConfig: PluginConfigSchema = {
 pluginId: 'appdynamics',
 pluginName: 'AppDynamics',
 version: '2.0.0',
 description: 'Application performance monitoring with AppDynamics',
 documentationUrl: 'https://docs.appdynamics.com/',
 sections: [
 {
 title: 'AppDynamics Controller',
 description: 'Configure AppDynamics controller connection',
 fields: [
 {
 name: 'controllerUrl',
 label: 'Controller URL',
 type: 'url',
 required: true,
 description: 'AppDynamics controller URL',
 placeholder: 'https://mycompany.saas.appdynamics.com'
 },
 {
 name: 'accountName',
 label: 'Account Name',
 type: 'text',
 required: true,
 description: 'AppDynamics account name',
 placeholder: 'customer1'
 },
 {
 name: 'username',
 label: 'Username',
 type: 'text',
 required: true,
 description: 'AppDynamics username',
 placeholder: 'user@company.com'
 },
 {
 name: 'password',
 label: 'Password',
 type: 'password',
 required: true,
 description: 'AppDynamics password',
 sensitive: true
 }
 ]
 },
 {
 title: 'Application Settings',
 description: 'Configure application monitoring settings',
 fields: [
 {
 name: 'defaultApplication',
 label: 'Default Application',
 type: 'text',
 required: false,
 description: 'Default application to monitor',
 placeholder: 'MyApp'
 },
 {
 name: 'timeRange',
 label: 'Default Time Range (minutes)',
 type: 'number',
 required: false,
 description: 'Default time range for metrics',
 defaultValue: 60,
 validation: { min: 5, max: 1440 }
 }
 ]
 }
 ],
 environmentVariables: ['APPDYNAMICS_PASSWORD']
};

// Export all plugin configurations
export const pluginConfigs: Record<string, PluginConfigSchema> = {
 'kubernetes': kubernetesPluginConfig,
 'github-actions': githubPluginConfig,
 'jira': jiraPluginConfig,
 'confluence': confluencePluginConfig,
 'servicenow': servicenowPluginConfig,
 'argocd': argoCDPluginConfig,
 'jenkins': jenkinsPluginConfig,
 'terraform': terraformPluginConfig,
 'vault': vaultPluginConfig,
 'aws': awsPluginConfig,
 'harness': harnessPluginConfig,
 'splunk': splunkPluginConfig,
 'score-dev': scoreDevPluginConfig,
 'gcp': gcpPluginConfig,
 'azure': azurePluginConfig,
 'route53': route53PluginConfig,
 'appdynamics': appDynamicsPluginConfig,
};

// Helper function to get plugin configuration
export function getPluginConfig(pluginId: string): PluginConfigSchema | null {
 return pluginConfigs[pluginId] || null;
}

// Helper function to validate plugin configuration
export function validatePluginConfig(pluginId: string, config: Record<string, any>): { isValid: boolean; errors: string[] } {
 const schema = getPluginConfig(pluginId);
 if (!schema) {
 return { isValid: false, errors: ['Plugin configuration schema not found'] };
 }

 const errors: string[] = [];
 
 for (const section of schema.sections) {
 for (const field of section.fields) {
 if (field.required && (!config[field.name] || config[field.name] === '')) {
 errors.push(`${field.label} is required`);
 }
 
 if (field.validation && config[field.name]) {
 const value = config[field.name];
 
 if (field.validation.pattern) {
 const regex = new RegExp(field.validation.pattern);
 if (!regex.test(value)) {
 errors.push(`${field.label} format is invalid`);
 }
 }
 
 if (field.type === 'number') {
 const numValue = Number(value);
 if (field.validation.min && numValue < field.validation.min) {
 errors.push(`${field.label} must be at least ${field.validation.min}`);
 }
 if (field.validation.max && numValue > field.validation.max) {
 errors.push(`${field.label} must be at most ${field.validation.max}`);
 }
 }
 }
 }
 }
 
 return { isValid: errors.length === 0, errors };
}