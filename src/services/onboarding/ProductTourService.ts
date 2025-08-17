/**
 * Product Tour Service
 * Interactive product tours and feature discovery
 */

import { Logger } from 'pino';
import {
  ProductTour,
  TourCategory,
  TourStep,
  TourAction,
  TourValidation
} from './types';

export class ProductTourService {
  private logger: Logger;
  private tours: Map<string, ProductTour>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.tours = new Map();
    this.initializeTours();
  }

  /**
   * Get a specific tour
   */
  async getTour(tourId: string): Promise<ProductTour> {
    const tour = this.tours.get(tourId);
    if (!tour) {
      throw new Error(`Tour ${tourId} not found`);
    }
    return tour;
  }

  /**
   * Get tours for a specific role
   */
  async getToursForRole(role: string): Promise<ProductTour[]> {
    return Array.from(this.tours.values()).filter(
      tour => tour.targetRole.includes(role) || tour.targetRole.includes('all')
    );
  }

  /**
   * Get tours by category
   */
  async getToursByCategory(category: TourCategory): Promise<ProductTour[]> {
    return Array.from(this.tours.values()).filter(
      tour => tour.category === category
    );
  }

  /**
   * Initialize product tours
   */
  private initializeTours(): void {
    // Getting Started Tour
    this.tours.set('getting-started', {
      id: 'getting-started',
      name: 'Getting Started',
      description: 'Learn the basics of the platform',
      targetRole: ['all'],
      estimatedMinutes: 5,
      category: TourCategory.GETTING_STARTED,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to SaaS IDP!',
          content: 'Let\'s take a quick tour to help you get started with the platform.',
          target: '.dashboard-header',
          placement: 'bottom',
          action: {
            type: 'click',
            value: '.tour-start-btn'
          }
        },
        {
          id: 'navigation',
          title: 'Main Navigation',
          content: 'Use the sidebar to navigate between different sections of the platform.',
          target: '.sidebar-nav',
          placement: 'right'
        },
        {
          id: 'service-catalog',
          title: 'Service Catalog',
          content: 'View and manage all your services in one place. Click here to explore.',
          target: '.nav-item-catalog',
          placement: 'right',
          action: {
            type: 'navigate',
            value: '/catalog'
          }
        },
        {
          id: 'create-service',
          title: 'Create Your First Service',
          content: 'Click the "Create" button to add a new service to your catalog.',
          target: '.create-service-btn',
          placement: 'bottom',
          validation: {
            type: 'element_exists',
            value: '.service-form'
          }
        },
        {
          id: 'templates',
          title: 'Use Templates',
          content: 'Speed up development with pre-built templates for common patterns.',
          target: '.nav-item-templates',
          placement: 'right',
          action: {
            type: 'navigate',
            value: '/templates'
          }
        },
        {
          id: 'integrations',
          title: 'Connect Integrations',
          content: 'Connect your existing tools like GitHub, Jenkins, and monitoring systems.',
          target: '.nav-item-integrations',
          placement: 'right'
        },
        {
          id: 'team-management',
          title: 'Invite Your Team',
          content: 'Collaborate with your team by inviting members and setting permissions.',
          target: '.nav-item-teams',
          placement: 'right'
        },
        {
          id: 'dashboard-widgets',
          title: 'Customize Your Dashboard',
          content: 'Add and arrange widgets to create your perfect dashboard view.',
          target: '.dashboard-customize-btn',
          placement: 'left'
        },
        {
          id: 'help-center',
          title: 'Get Help Anytime',
          content: 'Access documentation, tutorials, and support whenever you need it.',
          target: '.help-menu',
          placement: 'left'
        },
        {
          id: 'complete',
          title: 'You\'re All Set!',
          content: 'Great job! You now know the basics. Start building amazing things!',
          target: '.dashboard-header',
          placement: 'bottom'
        }
      ]
    });

    // Developer Tour
    this.tours.set('developer-tour', {
      id: 'developer-tour',
      name: 'Developer Workflow',
      description: 'Learn how to use the platform as a developer',
      targetRole: ['developer'],
      estimatedMinutes: 8,
      category: TourCategory.FEATURE_DISCOVERY,
      steps: [
        {
          id: 'dev-portal',
          title: 'Developer Portal',
          content: 'Your central hub for all development activities.',
          target: '.dev-portal',
          placement: 'bottom'
        },
        {
          id: 'api-docs',
          title: 'API Documentation',
          content: 'Access comprehensive API documentation with interactive examples.',
          target: '.api-docs-link',
          placement: 'right',
          action: {
            type: 'navigate',
            value: '/api-docs'
          }
        },
        {
          id: 'code-templates',
          title: 'Code Templates',
          content: 'Use templates to quickly scaffold new services and applications.',
          target: '.templates-grid',
          placement: 'top'
        },
        {
          id: 'ci-cd-pipeline',
          title: 'CI/CD Pipelines',
          content: 'View and manage your continuous integration and deployment pipelines.',
          target: '.pipelines-view',
          placement: 'bottom'
        },
        {
          id: 'environment-management',
          title: 'Environment Management',
          content: 'Manage different environments (dev, staging, production) from one place.',
          target: '.environments-selector',
          placement: 'bottom'
        },
        {
          id: 'monitoring',
          title: 'Service Monitoring',
          content: 'Monitor your services with real-time metrics and alerts.',
          target: '.monitoring-dashboard',
          placement: 'top'
        },
        {
          id: 'logs-traces',
          title: 'Logs and Traces',
          content: 'Debug issues quickly with centralized logging and distributed tracing.',
          target: '.logs-viewer',
          placement: 'top'
        },
        {
          id: 'dependencies',
          title: 'Dependency Graph',
          content: 'Visualize service dependencies and their relationships.',
          target: '.dependency-graph',
          placement: 'left'
        },
        {
          id: 'tech-docs',
          title: 'Technical Documentation',
          content: 'Create and maintain documentation alongside your code.',
          target: '.techdocs-link',
          placement: 'right'
        },
        {
          id: 'developer-complete',
          title: 'Ready to Code!',
          content: 'You\'re now ready to leverage the full power of the developer portal!',
          target: '.dashboard-header',
          placement: 'bottom'
        }
      ]
    });

    // Platform Engineer Tour
    this.tours.set('platform-tour', {
      id: 'platform-tour',
      name: 'Platform Engineering',
      description: 'Platform administration and configuration',
      targetRole: ['platform_engineer', 'admin'],
      estimatedMinutes: 10,
      category: TourCategory.FEATURE_DISCOVERY,
      steps: [
        {
          id: 'platform-overview',
          title: 'Platform Overview',
          content: 'Monitor the health and status of your entire platform.',
          target: '.platform-overview',
          placement: 'bottom'
        },
        {
          id: 'plugin-management',
          title: 'Plugin Management',
          content: 'Install, configure, and manage platform plugins.',
          target: '.plugins-manager',
          placement: 'right',
          action: {
            type: 'navigate',
            value: '/plugins'
          }
        },
        {
          id: 'rbac',
          title: 'Access Control',
          content: 'Configure role-based access control and permissions.',
          target: '.rbac-settings',
          placement: 'left'
        },
        {
          id: 'sso-config',
          title: 'SSO Configuration',
          content: 'Set up single sign-on with your identity provider.',
          target: '.sso-settings',
          placement: 'top'
        },
        {
          id: 'compliance',
          title: 'Compliance & Security',
          content: 'Manage compliance policies and security settings.',
          target: '.compliance-dashboard',
          placement: 'bottom'
        },
        {
          id: 'cost-management',
          title: 'Cost Management',
          content: 'Track and optimize cloud costs across your organization.',
          target: '.cost-dashboard',
          placement: 'top'
        },
        {
          id: 'backup-recovery',
          title: 'Backup & Recovery',
          content: 'Configure automated backups and disaster recovery.',
          target: '.backup-settings',
          placement: 'right'
        },
        {
          id: 'audit-logs',
          title: 'Audit Logs',
          content: 'Review all platform activities and changes.',
          target: '.audit-logs',
          placement: 'left'
        },
        {
          id: 'platform-apis',
          title: 'Platform APIs',
          content: 'Extend and integrate using our comprehensive APIs.',
          target: '.platform-api-docs',
          placement: 'bottom'
        },
        {
          id: 'platform-complete',
          title: 'Platform Mastery!',
          content: 'You\'re ready to manage and scale your platform effectively!',
          target: '.dashboard-header',
          placement: 'bottom'
        }
      ]
    });

    // Manager Tour
    this.tours.set('manager-tour', {
      id: 'manager-tour',
      name: 'Manager Dashboard',
      description: 'Track team productivity and project metrics',
      targetRole: ['manager', 'lead'],
      estimatedMinutes: 6,
      category: TourCategory.FEATURE_DISCOVERY,
      steps: [
        {
          id: 'team-overview',
          title: 'Team Overview',
          content: 'See your team\'s current status and activities.',
          target: '.team-dashboard',
          placement: 'bottom'
        },
        {
          id: 'project-tracking',
          title: 'Project Tracking',
          content: 'Track progress across all your team\'s projects.',
          target: '.projects-view',
          placement: 'top'
        },
        {
          id: 'velocity-metrics',
          title: 'Team Velocity',
          content: 'Monitor deployment frequency and lead time metrics.',
          target: '.velocity-chart',
          placement: 'left'
        },
        {
          id: 'resource-allocation',
          title: 'Resource Allocation',
          content: 'View how team resources are distributed across projects.',
          target: '.resource-chart',
          placement: 'right'
        },
        {
          id: 'quality-metrics',
          title: 'Quality Metrics',
          content: 'Track code quality, test coverage, and technical debt.',
          target: '.quality-dashboard',
          placement: 'top'
        },
        {
          id: 'reports',
          title: 'Generate Reports',
          content: 'Create custom reports for stakeholders.',
          target: '.reports-generator',
          placement: 'bottom'
        },
        {
          id: 'manager-complete',
          title: 'Management Excellence!',
          content: 'You\'re equipped to lead your team to success!',
          target: '.dashboard-header',
          placement: 'bottom'
        }
      ]
    });

    // Best Practices Tour
    this.tours.set('best-practices', {
      id: 'best-practices',
      name: 'Best Practices',
      description: 'Learn platform best practices and tips',
      targetRole: ['all'],
      estimatedMinutes: 7,
      category: TourCategory.BEST_PRACTICES,
      steps: [
        {
          id: 'naming-conventions',
          title: 'Naming Conventions',
          content: 'Use consistent naming for services: [team]-[service]-[environment]',
          target: '.service-name-input',
          placement: 'bottom'
        },
        {
          id: 'tagging-strategy',
          title: 'Effective Tagging',
          content: 'Tag resources for better discovery and cost allocation.',
          target: '.tags-input',
          placement: 'top'
        },
        {
          id: 'documentation',
          title: 'Document Everything',
          content: 'Keep documentation up-to-date alongside your code.',
          target: '.docs-editor',
          placement: 'right'
        },
        {
          id: 'monitoring-setup',
          title: 'Monitoring First',
          content: 'Set up monitoring before deploying to production.',
          target: '.monitoring-config',
          placement: 'left'
        },
        {
          id: 'security-scanning',
          title: 'Security Scanning',
          content: 'Enable automated security scanning for all services.',
          target: '.security-settings',
          placement: 'bottom'
        },
        {
          id: 'cost-tags',
          title: 'Cost Attribution',
          content: 'Tag resources with cost centers for accurate billing.',
          target: '.cost-tags',
          placement: 'top'
        },
        {
          id: 'automation',
          title: 'Automate Everything',
          content: 'Use templates and automation to reduce manual work.',
          target: '.automation-tools',
          placement: 'right'
        },
        {
          id: 'best-practices-complete',
          title: 'Best Practices Master!',
          content: 'You\'re following industry best practices!',
          target: '.dashboard-header',
          placement: 'bottom'
        }
      ]
    });

    // Advanced Features Tour
    this.tours.set('advanced-features', {
      id: 'advanced-features',
      name: 'Advanced Features',
      description: 'Explore advanced platform capabilities',
      targetRole: ['platform_engineer', 'admin'],
      estimatedMinutes: 12,
      category: TourCategory.ADVANCED,
      steps: [
        {
          id: 'custom-plugins',
          title: 'Custom Plugin Development',
          content: 'Build custom plugins to extend platform functionality.',
          target: '.plugin-sdk',
          placement: 'bottom'
        },
        {
          id: 'workflow-automation',
          title: 'Workflow Automation',
          content: 'Create automated workflows for common tasks.',
          target: '.workflow-builder',
          placement: 'top'
        },
        {
          id: 'api-gateway',
          title: 'API Gateway',
          content: 'Configure API gateway for rate limiting and authentication.',
          target: '.api-gateway-config',
          placement: 'right'
        },
        {
          id: 'service-mesh',
          title: 'Service Mesh',
          content: 'Implement service mesh for advanced traffic management.',
          target: '.service-mesh-config',
          placement: 'left'
        },
        {
          id: 'chaos-engineering',
          title: 'Chaos Engineering',
          content: 'Test resilience with chaos engineering experiments.',
          target: '.chaos-experiments',
          placement: 'bottom'
        },
        {
          id: 'ml-ops',
          title: 'ML Operations',
          content: 'Deploy and manage machine learning models.',
          target: '.mlops-dashboard',
          placement: 'top'
        },
        {
          id: 'gitops',
          title: 'GitOps Workflows',
          content: 'Implement GitOps for declarative infrastructure.',
          target: '.gitops-config',
          placement: 'right'
        },
        {
          id: 'multi-tenancy',
          title: 'Multi-Tenancy',
          content: 'Configure multi-tenant isolation and resource limits.',
          target: '.tenant-management',
          placement: 'left'
        },
        {
          id: 'advanced-complete',
          title: 'Platform Expert!',
          content: 'You\'ve mastered the advanced features!',
          target: '.dashboard-header',
          placement: 'bottom'
        }
      ]
    });

    this.logger.info(`Initialized ${this.tours.size} product tours`);
  }
}