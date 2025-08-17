#!/usr/bin/env node

/**
 * Comprehensive Demo Data Generator for TechCorp
 * Generates realistic data for sales demos and POCs
 */

const fs = require('fs');
const path = require('path');

console.log('🎭 Generating TechCorp Demo Data...\n');

// TechCorp Teams
const TEAMS = [
  { id: 'platform', name: 'Platform Engineering', size: 25, lead: 'Sarah Chen' },
  { id: 'frontend', name: 'Frontend Engineering', size: 40, lead: 'Mike Johnson' },
  { id: 'backend', name: 'Backend Services', size: 55, lead: 'Priya Patel' },
  { id: 'mobile', name: 'Mobile Development', size: 30, lead: 'Alex Kim' },
  { id: 'data', name: 'Data Engineering', size: 35, lead: 'Carlos Rodriguez' },
  { id: 'security', name: 'Security Engineering', size: 20, lead: 'Emma Wilson' },
  { id: 'devops', name: 'DevOps & SRE', size: 28, lead: 'James Liu' },
  { id: 'ml', name: 'Machine Learning', size: 22, lead: 'Fatima Al-Rashid' }
];

// TechCorp Demo Organization Structure
const TECHCORP_DATA = {
  company: {
    name: 'TechCorp',
    employees: 5000,
    revenue: '$500M',
    industry: 'Financial Services',
    locations: ['New York', 'London', 'Singapore', 'Tokyo'],
    techStack: ['Java', 'Python', 'React', 'Kubernetes', 'AWS', 'PostgreSQL']
  },
  
  teams: TEAMS,
  services: generateServices(),
  plugins: generatePlugins(),
  metrics: generateMetrics(),
  costs: generateCostData(),
  compliance: generateComplianceData(),
  incidents: generateIncidents()
};

// Generate 75+ services with realistic data
function generateServices() {
  const services = [];
  const serviceTypes = ['api', 'website', 'library', 'database', 'tool', 'service'];
  const lifecycles = ['production', 'staging', 'experimental', 'deprecated'];
  const healthStates = ['healthy', 'healthy', 'healthy', 'degraded', 'unhealthy']; // 60% healthy
  
  const serviceNames = [
    // Core Services
    'user-service', 'auth-service', 'payment-processor', 'notification-engine',
    'analytics-api', 'reporting-service', 'audit-logger', 'config-service',
    
    // Frontend Services
    'customer-portal', 'admin-dashboard', 'mobile-api-gateway', 'web-app',
    'partner-portal', 'developer-portal', 'marketing-site', 'docs-site',
    
    // Data Services
    'data-pipeline', 'etl-processor', 'stream-processor', 'batch-scheduler',
    'data-warehouse', 'feature-store', 'ml-pipeline', 'recommendation-engine',
    
    // Infrastructure Services
    'api-gateway', 'service-mesh', 'secret-manager', 'certificate-manager',
    'load-balancer', 'cdn-manager', 'dns-service', 'monitoring-aggregator',
    
    // Business Services
    'invoice-generator', 'tax-calculator', 'risk-analyzer', 'fraud-detector',
    'kyc-processor', 'compliance-checker', 'reporting-engine', 'billing-service',
    
    // Integration Services
    'salesforce-connector', 'slack-integration', 'github-sync', 'jira-bridge',
    'aws-cost-analyzer', 'datadog-exporter', 'pagerduty-integration', 'email-service',
    
    // Internal Tools
    'deployment-orchestrator', 'feature-flag-service', 'a-b-testing-platform',
    'performance-profiler', 'log-aggregator', 'metric-collector', 'trace-analyzer',
    
    // Mobile Services
    'ios-app-backend', 'android-app-backend', 'push-notification-service',
    'mobile-analytics', 'app-config-service', 'mobile-auth-service',
    
    // Security Services
    'vulnerability-scanner', 'secret-rotation-service', 'access-control-service',
    'encryption-service', 'key-management-service', 'security-audit-service',
    
    // ML/AI Services
    'ml-model-server', 'training-pipeline', 'inference-engine', 'feature-extraction',
    'nlp-processor', 'computer-vision-api', 'anomaly-detector', 'prediction-service'
  ];
  
  serviceNames.forEach((name, index) => {
    const team = TEAMS[index % TEAMS.length];
    const health = healthStates[Math.floor(Math.random() * healthStates.length)];
    
    services.push({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name,
        title: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: `${name} - Critical service for TechCorp operations`,
        tags: generateTags(name),
        annotations: {
          'backstage.io/kubernetes-id': name,
          'github.com/project-slug': `techcorp/${name}`,
          'backstage.io/techdocs-ref': 'dir:.',
          'pagerduty.com/integration-key': `PD-${name.toUpperCase()}`,
          'datadog.com/dashboard-url': `https://app.datadoghq.com/dashboard/${name}`
        }
      },
      spec: {
        type: serviceTypes[index % serviceTypes.length],
        lifecycle: lifecycles[index % lifecycles.length],
        owner: team.id,
        system: getSystem(name),
        dependsOn: getDependencies(name, serviceNames),
        providesApis: name.includes('api') ? [`${name}-api`] : []
      },
      status: {
        health,
        metrics: {
          responseTime: Math.floor(Math.random() * 500) + 50,
          errorRate: health === 'healthy' ? Math.random() * 2 : Math.random() * 10,
          throughput: Math.floor(Math.random() * 10000) + 1000,
          availability: health === 'healthy' ? 99.9 : health === 'degraded' ? 98.5 : 95.0
        },
        lastDeployment: generateRecentDate(),
        deploymentFrequency: Math.floor(Math.random() * 20) + 1,
        incidents: health === 'unhealthy' ? Math.floor(Math.random() * 5) + 1 : 0
      }
    });
  });
  
  return services;
}

// Generate 50+ plugins with various states
function generatePlugins() {
  const plugins = [];
  const categories = ['monitoring', 'ci-cd', 'security', 'data', 'communication', 'cloud'];
  const installStates = ['installed', 'available', 'installed', 'available', 'updating'];
  
  const pluginList = [
    // Monitoring & Observability
    { name: 'datadog', title: 'Datadog', category: 'monitoring', vendor: 'Datadog' },
    { name: 'prometheus', title: 'Prometheus', category: 'monitoring', vendor: 'CNCF' },
    { name: 'grafana', title: 'Grafana', category: 'monitoring', vendor: 'Grafana Labs' },
    { name: 'new-relic', title: 'New Relic', category: 'monitoring', vendor: 'New Relic' },
    { name: 'elastic-apm', title: 'Elastic APM', category: 'monitoring', vendor: 'Elastic' },
    
    // CI/CD
    { name: 'github-actions', title: 'GitHub Actions', category: 'ci-cd', vendor: 'GitHub' },
    { name: 'jenkins', title: 'Jenkins', category: 'ci-cd', vendor: 'Jenkins' },
    { name: 'circleci', title: 'CircleCI', category: 'ci-cd', vendor: 'CircleCI' },
    { name: 'gitlab-ci', title: 'GitLab CI', category: 'ci-cd', vendor: 'GitLab' },
    { name: 'argocd', title: 'ArgoCD', category: 'ci-cd', vendor: 'CNCF' },
    
    // Security
    { name: 'snyk', title: 'Snyk Security', category: 'security', vendor: 'Snyk' },
    { name: 'sonarqube', title: 'SonarQube', category: 'security', vendor: 'SonarSource' },
    { name: 'vault', title: 'HashiCorp Vault', category: 'security', vendor: 'HashiCorp' },
    { name: 'aqua-security', title: 'Aqua Security', category: 'security', vendor: 'Aqua' },
    { name: 'twistlock', title: 'Twistlock', category: 'security', vendor: 'Palo Alto' },
    
    // Cloud Providers
    { name: 'aws', title: 'AWS Integration', category: 'cloud', vendor: 'Amazon' },
    { name: 'gcp', title: 'Google Cloud', category: 'cloud', vendor: 'Google' },
    { name: 'azure', title: 'Microsoft Azure', category: 'cloud', vendor: 'Microsoft' },
    { name: 'kubernetes', title: 'Kubernetes', category: 'cloud', vendor: 'CNCF' },
    { name: 'terraform', title: 'Terraform', category: 'cloud', vendor: 'HashiCorp' },
    
    // Communication
    { name: 'slack', title: 'Slack', category: 'communication', vendor: 'Slack' },
    { name: 'teams', title: 'Microsoft Teams', category: 'communication', vendor: 'Microsoft' },
    { name: 'pagerduty', title: 'PagerDuty', category: 'communication', vendor: 'PagerDuty' },
    { name: 'opsgenie', title: 'Opsgenie', category: 'communication', vendor: 'Atlassian' },
    { name: 'discord', title: 'Discord', category: 'communication', vendor: 'Discord' },
    
    // Data & Analytics
    { name: 'snowflake', title: 'Snowflake', category: 'data', vendor: 'Snowflake' },
    { name: 'databricks', title: 'Databricks', category: 'data', vendor: 'Databricks' },
    { name: 'bigquery', title: 'BigQuery', category: 'data', vendor: 'Google' },
    { name: 'redshift', title: 'Amazon Redshift', category: 'data', vendor: 'Amazon' },
    { name: 'kafka', title: 'Apache Kafka', category: 'data', vendor: 'Apache' },
    
    // Development Tools
    { name: 'jira', title: 'Jira', category: 'development', vendor: 'Atlassian' },
    { name: 'confluence', title: 'Confluence', category: 'development', vendor: 'Atlassian' },
    { name: 'github', title: 'GitHub', category: 'development', vendor: 'GitHub' },
    { name: 'gitlab', title: 'GitLab', category: 'development', vendor: 'GitLab' },
    { name: 'bitbucket', title: 'Bitbucket', category: 'development', vendor: 'Atlassian' },
    
    // Cost Management
    { name: 'cloudability', title: 'Cloudability', category: 'finops', vendor: 'Apptio' },
    { name: 'cloudzero', title: 'CloudZero', category: 'finops', vendor: 'CloudZero' },
    { name: 'kubecost', title: 'Kubecost', category: 'finops', vendor: 'Kubecost' },
    
    // Feature Management
    { name: 'launchdarkly', title: 'LaunchDarkly', category: 'features', vendor: 'LaunchDarkly' },
    { name: 'split', title: 'Split', category: 'features', vendor: 'Split' },
    { name: 'optimizely', title: 'Optimizely', category: 'features', vendor: 'Optimizely' },
    
    // Testing
    { name: 'selenium', title: 'Selenium', category: 'testing', vendor: 'Selenium' },
    { name: 'cypress', title: 'Cypress', category: 'testing', vendor: 'Cypress' },
    { name: 'postman', title: 'Postman', category: 'testing', vendor: 'Postman' },
    
    // Compliance
    { name: 'vanta', title: 'Vanta', category: 'compliance', vendor: 'Vanta' },
    { name: 'drata', title: 'Drata', category: 'compliance', vendor: 'Drata' },
    { name: 'secureframe', title: 'Secureframe', category: 'compliance', vendor: 'Secureframe' }
  ];
  
  pluginList.forEach((plugin, index) => {
    const state = installStates[index % installStates.length];
    const isInstalled = state === 'installed' || state === 'updating';
    
    plugins.push({
      ...plugin,
      id: plugin.name,
      version: isInstalled ? generateVersion() : 'latest',
      state,
      installedAt: isInstalled ? generateRecentDate() : null,
      configuredBy: isInstalled ? 'platform-team' : null,
      health: isInstalled ? (Math.random() > 0.2 ? 'healthy' : 'warning') : null,
      usage: isInstalled ? {
        activeUsers: Math.floor(Math.random() * 500) + 50,
        apiCalls: Math.floor(Math.random() * 100000) + 10000,
        lastUsed: generateRecentDate()
      } : null,
      cost: {
        monthly: Math.floor(Math.random() * 5000) + 500,
        annual: Math.floor(Math.random() * 50000) + 5000,
        users: Math.floor(Math.random() * 100) + 10
      },
      features: generatePluginFeatures(plugin.category),
      integrations: generateIntegrations(plugin.name),
      benefits: generateBenefits(plugin.category)
    });
  });
  
  return plugins;
}

// Generate realistic metrics
function generateMetrics() {
  return {
    dora: {
      deploymentFrequency: {
        value: 12.5,
        trend: 15,
        target: 20,
        unit: 'per day'
      },
      leadTime: {
        value: 2.3,
        trend: -20,
        target: 1,
        unit: 'hours'
      },
      mttr: {
        value: 45,
        trend: -30,
        target: 30,
        unit: 'minutes'
      },
      changeFailureRate: {
        value: 5.2,
        trend: -40,
        target: 5,
        unit: '%'
      }
    },
    productivity: {
      pullRequests: 1250,
      codeReviews: 980,
      commits: 4500,
      activeContributors: 245,
      cycleTime: 3.2,
      codeQuality: 92
    },
    reliability: {
      uptime: 99.95,
      incidents: 3,
      alerts: 12,
      errorRate: 0.02,
      p99Latency: 250,
      throughput: 1500000
    },
    security: {
      vulnerabilities: {
        critical: 0,
        high: 2,
        medium: 15,
        low: 47
      },
      complianceScore: 94,
      lastScan: generateRecentDate(),
      secretsRotated: 156
    }
  };
}

// Generate cost optimization data
function generateCostData() {
  return {
    current: {
      monthly: 485000,
      annual: 5820000,
      trend: -12.5
    },
    breakdown: {
      compute: 185000,
      storage: 65000,
      network: 45000,
      database: 85000,
      monitoring: 35000,
      security: 25000,
      other: 45000
    },
    optimization: {
      identified: 125000,
      implemented: 85000,
      potential: 40000,
      recommendations: [
        {
          title: 'Right-size EC2 instances',
          savings: 25000,
          effort: 'low',
          impact: 'high'
        },
        {
          title: 'Implement auto-scaling',
          savings: 15000,
          effort: 'medium',
          impact: 'high'
        },
        {
          title: 'Use Reserved Instances',
          savings: 35000,
          effort: 'low',
          impact: 'high'
        },
        {
          title: 'Optimize S3 storage classes',
          savings: 10000,
          effort: 'low',
          impact: 'medium'
        }
      ]
    },
    forecast: {
      nextMonth: 465000,
      nextQuarter: 1350000,
      nextYear: 5200000
    }
  };
}

// Generate compliance data
function generateComplianceData() {
  return {
    frameworks: [
      { name: 'SOC2', status: 'compliant', score: 98, lastAudit: '2024-06-15' },
      { name: 'ISO27001', status: 'compliant', score: 96, lastAudit: '2024-07-20' },
      { name: 'GDPR', status: 'compliant', score: 100, lastAudit: '2024-08-01' },
      { name: 'HIPAA', status: 'partial', score: 85, lastAudit: '2024-05-10' },
      { name: 'PCI-DSS', status: 'compliant', score: 99, lastAudit: '2024-07-30' }
    ],
    violations: [
      {
        id: 'VIO-001',
        severity: 'medium',
        framework: 'SOC2',
        control: 'Access Control',
        description: 'Missing MFA for 3 service accounts',
        remediation: 'Enable MFA for identified accounts',
        deadline: '2024-08-15',
        owner: 'security-team'
      },
      {
        id: 'VIO-002',
        severity: 'low',
        framework: 'ISO27001',
        control: 'Asset Management',
        description: 'Incomplete asset inventory',
        remediation: 'Update CMDB with missing assets',
        deadline: '2024-08-20',
        owner: 'devops-team'
      }
    ],
    upcomingAudits: [
      { framework: 'SOC2', date: '2024-09-15', auditor: 'Ernst & Young' },
      { framework: 'PCI-DSS', date: '2024-10-01', auditor: 'Trustwave' }
    ]
  };
}

// Generate incident data
function generateIncidents() {
  return [
    {
      id: 'INC-2024-001',
      title: 'Database connection pool exhaustion',
      severity: 'high',
      status: 'resolved',
      service: 'payment-processor',
      startTime: '2024-08-05T14:30:00Z',
      endTime: '2024-08-05T15:45:00Z',
      impact: 'Payment processing delayed for 15% of transactions',
      rootCause: 'Connection leak in payment service',
      resolution: 'Deployed hotfix to properly close connections'
    },
    {
      id: 'INC-2024-002',
      title: 'CDN cache invalidation failure',
      severity: 'medium',
      status: 'resolved',
      service: 'customer-portal',
      startTime: '2024-08-04T09:15:00Z',
      endTime: '2024-08-04T10:00:00Z',
      impact: 'Stale content served to 5% of users',
      rootCause: 'AWS CloudFront API rate limiting',
      resolution: 'Implemented exponential backoff for API calls'
    },
    {
      id: 'INC-2024-003',
      title: 'Memory leak in analytics service',
      severity: 'low',
      status: 'investigating',
      service: 'analytics-api',
      startTime: '2024-08-07T11:00:00Z',
      endTime: null,
      impact: 'Gradual performance degradation',
      rootCause: 'Under investigation',
      resolution: 'Temporary mitigation: increased auto-scaling threshold'
    }
  ];
}

// Helper functions
function generateTags(serviceName) {
  const tags = [];
  if (serviceName.includes('api')) tags.push('api');
  if (serviceName.includes('service')) tags.push('backend');
  if (serviceName.includes('portal') || serviceName.includes('app')) tags.push('frontend');
  if (serviceName.includes('data') || serviceName.includes('etl')) tags.push('data');
  if (serviceName.includes('ml') || serviceName.includes('ai')) tags.push('ml');
  tags.push('techcorp');
  return tags;
}

function getSystem(serviceName) {
  if (serviceName.includes('payment') || serviceName.includes('billing')) return 'financial';
  if (serviceName.includes('user') || serviceName.includes('auth')) return 'identity';
  if (serviceName.includes('data') || serviceName.includes('etl')) return 'data-platform';
  if (serviceName.includes('ml') || serviceName.includes('ai')) return 'ml-platform';
  return 'core';
}

function getDependencies(serviceName, allServices) {
  const deps = [];
  if (serviceName !== 'auth-service' && Math.random() > 0.3) {
    deps.push('Component:default/auth-service');
  }
  if (serviceName !== 'config-service' && Math.random() > 0.5) {
    deps.push('Component:default/config-service');
  }
  return deps;
}

function generateVersion() {
  const major = Math.floor(Math.random() * 3) + 1;
  const minor = Math.floor(Math.random() * 20);
  const patch = Math.floor(Math.random() * 10);
  return `${major}.${minor}.${patch}`;
}

function generateRecentDate() {
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function generatePluginFeatures(category) {
  const features = {
    monitoring: ['Real-time metrics', 'Custom dashboards', 'Alert management', 'Log aggregation'],
    'ci-cd': ['Pipeline automation', 'Deployment tracking', 'Rollback support', 'Environment management'],
    security: ['Vulnerability scanning', 'Secret management', 'Compliance reporting', 'Access control'],
    cloud: ['Resource management', 'Cost tracking', 'Auto-scaling', 'Multi-region support'],
    communication: ['Real-time notifications', 'Incident management', 'Team collaboration', 'Status updates'],
    data: ['Data pipeline management', 'ETL orchestration', 'Data quality monitoring', 'Schema management']
  };
  return features[category] || ['Core functionality', 'API access', 'Documentation', 'Support'];
}

function generateIntegrations(pluginName) {
  const integrations = {
    github: ['Pull requests', 'Issues', 'Actions', 'Releases'],
    slack: ['Notifications', 'Commands', 'Workflows', 'Apps'],
    datadog: ['Metrics', 'Logs', 'APM', 'Synthetics'],
    kubernetes: ['Deployments', 'Services', 'Pods', 'ConfigMaps']
  };
  return integrations[pluginName] || [];
}

function generateBenefits(category) {
  const benefits = {
    monitoring: 'Reduce MTTR by 60% with real-time observability',
    'ci-cd': 'Deploy 10x faster with automated pipelines',
    security: 'Achieve 100% compliance with automated scanning',
    cloud: 'Reduce cloud costs by 30% with optimization',
    communication: 'Improve incident response by 50%',
    data: 'Process 100TB+ daily with managed pipelines'
  };
  return benefits[category] || 'Improve developer productivity';
}

// Write data to files
const outputDir = path.join(__dirname, '..', 'demo-data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write main demo data
fs.writeFileSync(
  path.join(outputDir, 'techcorp-demo.json'),
  JSON.stringify(TECHCORP_DATA, null, 2)
);

// Write catalog entities
fs.writeFileSync(
  path.join(outputDir, 'catalog-entities.json'),
  JSON.stringify({ entities: TECHCORP_DATA.services }, null, 2)
);

// Write plugin data
fs.writeFileSync(
  path.join(outputDir, 'plugins.json'),
  JSON.stringify({ plugins: TECHCORP_DATA.plugins }, null, 2)
);

// Generate summary
console.log('✅ Demo Data Generated Successfully!\n');
console.log('📊 Summary:');
console.log(`   • Company: ${TECHCORP_DATA.company.name}`);
console.log(`   • Teams: ${TECHCORP_DATA.teams.length}`);
console.log(`   • Services: ${TECHCORP_DATA.services.length}`);
console.log(`   • Plugins: ${TECHCORP_DATA.plugins.length}`);
console.log(`   • Monthly Cloud Spend: $${TECHCORP_DATA.costs.current.monthly.toLocaleString()}`);
console.log(`   • Potential Savings: $${TECHCORP_DATA.costs.optimization.identified.toLocaleString()}`);
console.log('\n📁 Data saved to: demo-data/');
console.log('\n🎯 Demo scenarios ready for:');
console.log('   • Executive presentations');
console.log('   • Technical deep-dives');
console.log('   • ROI demonstrations');
console.log('   • Competitive comparisons');