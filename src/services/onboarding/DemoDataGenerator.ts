/**
 * Demo Data Generator for Trial Accounts
 * Generates realistic demo data to help users explore the platform
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';
import { faker } from '@faker-js/faker';

export class DemoDataGenerator {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient, logger: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Generate complete demo data for trial account
   */
  async generateForTrial(organizationId: string): Promise<void> {
    this.logger.info({ organizationId }, 'Generating demo data for trial');

    try {
      // Generate in parallel for efficiency
      await Promise.all([
        this.generateServices(organizationId),
        this.generateTemplates(organizationId),
        this.generateTeams(organizationId),
        this.generatePlugins(organizationId),
        this.generateDashboards(organizationId),
        this.generateMetrics(organizationId)
      ]);

      this.logger.info({ organizationId }, 'Demo data generation completed');
    } catch (error) {
      this.logger.error({ error, organizationId }, 'Failed to generate demo data');
      throw error;
    }
  }

  /**
   * Generate demo services
   */
  private async generateServices(organizationId: string): Promise<void> {
    const services = [
      {
        name: 'user-service',
        displayName: 'User Service',
        description: 'Handles user authentication and management',
        type: 'backend',
        lifecycle: 'production',
        owner: 'platform-team',
        system: 'authentication',
        tags: ['auth', 'core', 'typescript'],
        metadata: {
          language: 'TypeScript',
          framework: 'NestJS',
          database: 'PostgreSQL',
          deploymentType: 'kubernetes',
          repository: 'https://github.com/demo/user-service',
          documentation: 'https://docs.demo.com/user-service',
          metrics: {
            uptime: 99.99,
            latencyP99: 45,
            requestsPerSecond: 1200
          }
        }
      },
      {
        name: 'payment-service',
        displayName: 'Payment Service',
        description: 'Processes payments and billing',
        type: 'backend',
        lifecycle: 'production',
        owner: 'payments-team',
        system: 'billing',
        tags: ['payments', 'critical', 'java'],
        metadata: {
          language: 'Java',
          framework: 'Spring Boot',
          database: 'MySQL',
          deploymentType: 'kubernetes',
          repository: 'https://github.com/demo/payment-service',
          compliance: ['PCI-DSS', 'SOC2'],
          metrics: {
            uptime: 99.999,
            latencyP99: 120,
            requestsPerSecond: 500
          }
        }
      },
      {
        name: 'notification-service',
        displayName: 'Notification Service',
        description: 'Sends emails, SMS, and push notifications',
        type: 'backend',
        lifecycle: 'production',
        owner: 'platform-team',
        system: 'communication',
        tags: ['notifications', 'async', 'python'],
        metadata: {
          language: 'Python',
          framework: 'FastAPI',
          messageQueue: 'RabbitMQ',
          deploymentType: 'serverless',
          repository: 'https://github.com/demo/notification-service',
          metrics: {
            messagesPerDay: 50000,
            deliveryRate: 98.5,
            latencyP99: 200
          }
        }
      },
      {
        name: 'web-app',
        displayName: 'Web Application',
        description: 'Main customer-facing web application',
        type: 'frontend',
        lifecycle: 'production',
        owner: 'frontend-team',
        system: 'customer-portal',
        tags: ['frontend', 'react', 'typescript'],
        metadata: {
          language: 'TypeScript',
          framework: 'React',
          bundler: 'Webpack',
          deploymentType: 'cdn',
          repository: 'https://github.com/demo/web-app',
          metrics: {
            pageLoadTime: 1.2,
            lighthouseScore: 95,
            activeUsers: 10000
          }
        }
      },
      {
        name: 'mobile-app',
        displayName: 'Mobile Application',
        description: 'iOS and Android mobile app',
        type: 'mobile',
        lifecycle: 'production',
        owner: 'mobile-team',
        system: 'customer-portal',
        tags: ['mobile', 'react-native', 'typescript'],
        metadata: {
          language: 'TypeScript',
          framework: 'React Native',
          platforms: ['iOS', 'Android'],
          repository: 'https://github.com/demo/mobile-app',
          metrics: {
            crashFreeRate: 99.8,
            appStoreRating: 4.7,
            monthlyActiveUsers: 25000
          }
        }
      },
      {
        name: 'analytics-pipeline',
        displayName: 'Analytics Pipeline',
        description: 'Real-time data processing pipeline',
        type: 'data',
        lifecycle: 'production',
        owner: 'data-team',
        system: 'analytics',
        tags: ['data', 'streaming', 'scala'],
        metadata: {
          language: 'Scala',
          framework: 'Apache Spark',
          dataStore: 'Apache Kafka',
          deploymentType: 'kubernetes',
          repository: 'https://github.com/demo/analytics-pipeline',
          metrics: {
            eventsPerSecond: 10000,
            processingLatency: 500,
            dataAccuracy: 99.95
          }
        }
      },
      {
        name: 'ml-recommendation',
        displayName: 'ML Recommendation Engine',
        description: 'Machine learning recommendation service',
        type: 'ml',
        lifecycle: 'experimental',
        owner: 'ml-team',
        system: 'intelligence',
        tags: ['ml', 'python', 'tensorflow'],
        metadata: {
          language: 'Python',
          framework: 'TensorFlow',
          modelType: 'Neural Network',
          deploymentType: 'gpu-cluster',
          repository: 'https://github.com/demo/ml-recommendation',
          metrics: {
            modelAccuracy: 0.92,
            inferenceTime: 50,
            requestsPerSecond: 100
          }
        }
      },
      {
        name: 'api-gateway',
        displayName: 'API Gateway',
        description: 'Central API gateway and rate limiter',
        type: 'infrastructure',
        lifecycle: 'production',
        owner: 'platform-team',
        system: 'infrastructure',
        tags: ['gateway', 'infrastructure', 'go'],
        metadata: {
          language: 'Go',
          framework: 'Kong',
          rateLimiting: true,
          authentication: ['OAuth2', 'JWT'],
          repository: 'https://github.com/demo/api-gateway',
          metrics: {
            uptime: 99.999,
            latencyP99: 10,
            requestsPerSecond: 50000
          }
        }
      }
    ];

    // Create services with proper database schema
    for (const service of services) {
      await this.prisma.$queryRaw`
        INSERT INTO services (
          id, name, display_name, description, type, lifecycle,
          owner, system, organization_id, metadata, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${service.name},
          ${service.displayName},
          ${service.description},
          ${service.type},
          ${service.lifecycle},
          ${service.owner},
          ${service.system},
          ${organizationId},
          ${JSON.stringify(service.metadata)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (name) DO NOTHING
      `;
    }

    this.logger.info({ count: services.length }, 'Generated demo services');
  }

  /**
   * Generate demo templates
   */
  private async generateTemplates(organizationId: string): Promise<void> {
    const templates = [
      {
        name: 'node-microservice',
        displayName: 'Node.js Microservice',
        description: 'Production-ready Node.js microservice with TypeScript',
        category: 'backend',
        tags: ['nodejs', 'typescript', 'microservice'],
        difficulty: 'beginner',
        estimatedTime: 5,
        metadata: {
          language: 'TypeScript',
          framework: 'Express',
          includes: ['Docker', 'CI/CD', 'Tests', 'Monitoring'],
          repository: 'https://github.com/demo/templates/node-microservice'
        }
      },
      {
        name: 'react-spa',
        displayName: 'React SPA',
        description: 'Modern React single-page application',
        category: 'frontend',
        tags: ['react', 'typescript', 'spa'],
        difficulty: 'beginner',
        estimatedTime: 3,
        metadata: {
          language: 'TypeScript',
          framework: 'React',
          includes: ['Redux', 'Router', 'Testing', 'Storybook'],
          repository: 'https://github.com/demo/templates/react-spa'
        }
      },
      {
        name: 'python-api',
        displayName: 'Python REST API',
        description: 'FastAPI service with async support',
        category: 'backend',
        tags: ['python', 'fastapi', 'async'],
        difficulty: 'intermediate',
        estimatedTime: 4,
        metadata: {
          language: 'Python',
          framework: 'FastAPI',
          includes: ['SQLAlchemy', 'Alembic', 'Pytest', 'Docker'],
          repository: 'https://github.com/demo/templates/python-api'
        }
      },
      {
        name: 'kubernetes-deployment',
        displayName: 'Kubernetes Deployment',
        description: 'Complete Kubernetes deployment configuration',
        category: 'infrastructure',
        tags: ['kubernetes', 'helm', 'infrastructure'],
        difficulty: 'advanced',
        estimatedTime: 10,
        metadata: {
          type: 'Infrastructure',
          includes: ['Helm Charts', 'ConfigMaps', 'Secrets', 'Ingress'],
          repository: 'https://github.com/demo/templates/k8s-deployment'
        }
      },
      {
        name: 'serverless-function',
        displayName: 'Serverless Function',
        description: 'AWS Lambda function with API Gateway',
        category: 'serverless',
        tags: ['aws', 'lambda', 'serverless'],
        difficulty: 'intermediate',
        estimatedTime: 2,
        metadata: {
          language: 'JavaScript',
          platform: 'AWS',
          includes: ['API Gateway', 'DynamoDB', 'CloudWatch'],
          repository: 'https://github.com/demo/templates/serverless-function'
        }
      },
      {
        name: 'data-pipeline',
        displayName: 'Data Pipeline',
        description: 'Apache Airflow data pipeline',
        category: 'data',
        tags: ['airflow', 'etl', 'python'],
        difficulty: 'advanced',
        estimatedTime: 8,
        metadata: {
          language: 'Python',
          framework: 'Apache Airflow',
          includes: ['DAGs', 'Operators', 'Sensors', 'Hooks'],
          repository: 'https://github.com/demo/templates/data-pipeline'
        }
      }
    ];

    for (const template of templates) {
      await this.prisma.$queryRaw`
        INSERT INTO templates (
          id, name, display_name, description, category,
          difficulty, estimated_time, organization_id, metadata,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${template.name},
          ${template.displayName},
          ${template.description},
          ${template.category},
          ${template.difficulty},
          ${template.estimatedTime},
          ${organizationId},
          ${JSON.stringify(template.metadata)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (name) DO NOTHING
      `;
    }

    this.logger.info({ count: templates.length }, 'Generated demo templates');
  }

  /**
   * Generate demo teams
   */
  private async generateTeams(organizationId: string): Promise<void> {
    const teams = [
      {
        name: 'platform-team',
        displayName: 'Platform Team',
        description: 'Core platform and infrastructure',
        members: 8
      },
      {
        name: 'frontend-team',
        displayName: 'Frontend Team',
        description: 'Web and mobile applications',
        members: 6
      },
      {
        name: 'backend-team',
        displayName: 'Backend Team',
        description: 'API and microservices',
        members: 10
      },
      {
        name: 'data-team',
        displayName: 'Data Team',
        description: 'Analytics and data engineering',
        members: 5
      },
      {
        name: 'ml-team',
        displayName: 'ML Team',
        description: 'Machine learning and AI',
        members: 4
      },
      {
        name: 'devops-team',
        displayName: 'DevOps Team',
        description: 'CI/CD and deployment automation',
        members: 6
      }
    ];

    for (const team of teams) {
      await this.prisma.team.create({
        data: {
          name: team.name,
          displayName: team.displayName,
          description: team.description
        }
      }).catch(() => {
        // Ignore if already exists
      });
    }

    this.logger.info({ count: teams.length }, 'Generated demo teams');
  }

  /**
   * Generate demo plugins
   */
  private async generatePlugins(organizationId: string): Promise<void> {
    const plugins = [
      {
        name: 'github-actions',
        displayName: 'GitHub Actions',
        description: 'CI/CD integration with GitHub Actions',
        category: 'ci-cd',
        enabled: true,
        config: {
          repositories: ['demo/user-service', 'demo/web-app'],
          workflows: ['build', 'test', 'deploy']
        }
      },
      {
        name: 'datadog',
        displayName: 'Datadog',
        description: 'Monitoring and observability',
        category: 'monitoring',
        enabled: true,
        config: {
          apiKey: 'demo-api-key',
          dashboards: ['infrastructure', 'applications', 'business']
        }
      },
      {
        name: 'pagerduty',
        displayName: 'PagerDuty',
        description: 'Incident management',
        category: 'incident',
        enabled: true,
        config: {
          serviceId: 'demo-service',
          escalationPolicy: 'standard'
        }
      },
      {
        name: 'sonarqube',
        displayName: 'SonarQube',
        description: 'Code quality and security',
        category: 'quality',
        enabled: true,
        config: {
          projectKeys: ['user-service', 'payment-service'],
          qualityGates: ['default']
        }
      },
      {
        name: 'kubernetes',
        displayName: 'Kubernetes',
        description: 'Container orchestration',
        category: 'infrastructure',
        enabled: true,
        config: {
          clusters: ['production', 'staging'],
          namespaces: ['default', 'monitoring', 'ingress']
        }
      }
    ];

    for (const plugin of plugins) {
      await this.prisma.$queryRaw`
        INSERT INTO plugins (
          id, name, display_name, description, category,
          enabled, organization_id, config, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${plugin.name},
          ${plugin.displayName},
          ${plugin.description},
          ${plugin.category},
          ${plugin.enabled},
          ${organizationId},
          ${JSON.stringify(plugin.config)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (name) DO NOTHING
      `;
    }

    this.logger.info({ count: plugins.length }, 'Generated demo plugins');
  }

  /**
   * Generate demo dashboards
   */
  private async generateDashboards(organizationId: string): Promise<void> {
    const dashboards = [
      {
        name: 'executive-overview',
        displayName: 'Executive Overview',
        description: 'High-level metrics and KPIs',
        widgets: [
          { type: 'metric', title: 'Total Services', value: 8 },
          { type: 'metric', title: 'Uptime', value: '99.95%' },
          { type: 'metric', title: 'Active Users', value: '35K' },
          { type: 'chart', title: 'Request Volume', chartType: 'line' },
          { type: 'chart', title: 'Error Rate', chartType: 'area' },
          { type: 'table', title: 'Top Services', rows: 5 }
        ]
      },
      {
        name: 'engineering-metrics',
        displayName: 'Engineering Metrics',
        description: 'Development and deployment metrics',
        widgets: [
          { type: 'metric', title: 'Deployments Today', value: 12 },
          { type: 'metric', title: 'PR Merge Time', value: '2.5h' },
          { type: 'metric', title: 'Test Coverage', value: '87%' },
          { type: 'chart', title: 'Deployment Frequency', chartType: 'bar' },
          { type: 'chart', title: 'Lead Time', chartType: 'line' },
          { type: 'table', title: 'Recent Deployments', rows: 10 }
        ]
      },
      {
        name: 'cost-optimization',
        displayName: 'Cost Optimization',
        description: 'Cloud costs and optimization opportunities',
        widgets: [
          { type: 'metric', title: 'Monthly Spend', value: '$24,500' },
          { type: 'metric', title: 'Cost Trend', value: '-5%' },
          { type: 'metric', title: 'Savings Identified', value: '$3,200' },
          { type: 'chart', title: 'Cost by Service', chartType: 'pie' },
          { type: 'chart', title: 'Daily Spend', chartType: 'area' },
          { type: 'table', title: 'Top Expensive Resources', rows: 5 }
        ]
      }
    ];

    for (const dashboard of dashboards) {
      await this.prisma.$queryRaw`
        INSERT INTO dashboards (
          id, name, display_name, description,
          organization_id, widgets, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${dashboard.name},
          ${dashboard.displayName},
          ${dashboard.description},
          ${organizationId},
          ${JSON.stringify(dashboard.widgets)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (name) DO NOTHING
      `;
    }

    this.logger.info({ count: dashboards.length }, 'Generated demo dashboards');
  }

  /**
   * Generate demo metrics
   */
  private async generateMetrics(organizationId: string): Promise<void> {
    const now = new Date();
    const metrics = [];

    // Generate 30 days of metrics
    for (let days = 0; days < 30; days++) {
      const date = new Date(now);
      date.setDate(date.getDate() - days);

      metrics.push({
        date,
        organizationId,
        metrics: {
          services: {
            total: 8 + Math.floor(Math.random() * 3),
            healthy: 7 + Math.floor(Math.random() * 2),
            degraded: Math.floor(Math.random() * 2),
            down: 0
          },
          deployments: {
            successful: 10 + Math.floor(Math.random() * 10),
            failed: Math.floor(Math.random() * 3),
            rollback: Math.floor(Math.random() * 2)
          },
          usage: {
            apiCalls: 100000 + Math.floor(Math.random() * 50000),
            activeUsers: 1000 + Math.floor(Math.random() * 200),
            dataTransferGB: 50 + Math.floor(Math.random() * 20)
          },
          performance: {
            avgResponseTime: 45 + Math.floor(Math.random() * 20),
            errorRate: 0.1 + Math.random() * 0.5,
            uptime: 99.9 + Math.random() * 0.09
          },
          costs: {
            compute: 500 + Math.floor(Math.random() * 100),
            storage: 200 + Math.floor(Math.random() * 50),
            network: 100 + Math.floor(Math.random() * 30),
            total: 800 + Math.floor(Math.random() * 180)
          }
        }
      });
    }

    // Store metrics
    for (const metric of metrics) {
      await this.prisma.$queryRaw`
        INSERT INTO metrics (
          id, organization_id, date, data, created_at
        ) VALUES (
          gen_random_uuid(),
          ${organizationId},
          ${metric.date},
          ${JSON.stringify(metric.metrics)}::jsonb,
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
    }

    this.logger.info({ count: metrics.length }, 'Generated demo metrics');
  }
}