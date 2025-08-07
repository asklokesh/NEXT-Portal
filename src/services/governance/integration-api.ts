/**
 * Integration API Service
 * External integrations, webhook endpoints, and API gateway for governance services
 * Provides REST and GraphQL APIs for external systems integration
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import { PolicyEngine } from './policy-engine';
import { ComplianceAutomationService } from './compliance-automation';
import { SecurityGovernanceService } from './security-governance';
import { QualityGatesService } from './quality-gates';
import { MonitoringReportingService } from './monitoring-reporting';

// API Configuration
export const APIConfigSchema = z.object({
  version: z.string().default('v1'),
  basePath: z.string().default('/api/governance'),
  rateLimit: z.object({
    windowMs: z.number().default(900000), // 15 minutes
    maxRequests: z.number().default(1000),
    skipSuccessfulRequests: z.boolean().default(false)
  }),
  authentication: z.object({
    required: z.boolean().default(true),
    methods: z.array(z.enum(['bearer', 'api-key', 'jwt'])).default(['bearer']),
    jwks_uri: z.string().optional(),
    audience: z.string().optional()
  }),
  cors: z.object({
    enabled: z.boolean().default(true),
    origins: z.array(z.string()).default(['*']),
    methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    headers: z.array(z.string()).default(['Content-Type', 'Authorization'])
  }),
  webhooks: z.object({
    enabled: z.boolean().default(true),
    secret: z.string().optional(),
    timeout: z.number().default(30000), // 30 seconds
    retries: z.number().default(3)
  })
});

export type APIConfig = z.infer<typeof APIConfigSchema>;

// Request/Response Schemas
export const PolicyEvaluationRequestSchema = z.object({
  policyId: z.string(),
  context: z.object({
    subject: z.object({
      user: z.string().optional(),
      service: z.string().optional(),
      team: z.string().optional(),
      roles: z.array(z.string()).optional()
    }),
    resource: z.object({
      type: z.string(),
      id: z.string(),
      attributes: z.record(z.any())
    }),
    action: z.string(),
    environment: z.object({
      time: z.date().optional(),
      location: z.string().optional(),
      network: z.string().optional()
    }),
    metadata: z.record(z.any()).optional()
  })
});

export const ComplianceAssessmentRequestSchema = z.object({
  framework: z.enum(['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'cis']),
  scope: z.object({
    services: z.array(z.string()).optional(),
    teams: z.array(z.string()).optional(),
    environments: z.array(z.string()).optional()
  }).optional()
});

export const SecurityScanRequestSchema = z.object({
  targetId: z.string(),
  targetType: z.enum(['service', 'container', 'dependency', 'infrastructure']),
  scanner: z.string().default('trivy')
});

export const QualityGateRequestSchema = z.object({
  gateId: z.string(),
  targetId: z.string(),
  targetType: z.enum(['service', 'deployment', 'pr', 'commit']),
  context: z.object({
    branch: z.string().optional(),
    environment: z.string().optional(),
    service: z.string().optional(),
    team: z.string().optional(),
    version: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),
  triggeredBy: z.string()
});

// Webhook Schemas
export const WebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  source: z.string(),
  timestamp: z.date(),
  data: z.record(z.any()),
  signature: z.string().optional()
});

export const WebhookConfigSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  events: z.array(z.string()),
  active: z.boolean().default(true),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  retries: z.number().default(3),
  timeout: z.number().default(30000)
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// External Integration Schemas
export const ExternalIntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['ci-cd', 'scm', 'monitoring', 'security', 'compliance', 'ticketing']),
  config: z.record(z.any()),
  credentials: z.record(z.string()),
  enabled: z.boolean().default(true),
  endpoints: z.array(z.object({
    name: z.string(),
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    headers: z.record(z.string()).optional(),
    timeout: z.number().default(30000)
  }))
});

export type ExternalIntegration = z.infer<typeof ExternalIntegrationSchema>;

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T = any> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class IntegrationAPIService extends EventEmitter {
  private app: express.Application;
  private config: APIConfig;
  
  private policyEngine: PolicyEngine;
  private complianceService: ComplianceAutomationService;
  private securityService: SecurityGovernanceService;
  private qualityGatesService: QualityGatesService;
  private monitoringService: MonitoringReportingService;

  private webhooks: Map<string, WebhookConfig> = new Map();
  private integrations: Map<string, ExternalIntegration> = new Map();
  private apiKeys: Map<string, { name: string; scopes: string[]; active: boolean }> = new Map();

  constructor(
    config: APIConfig,
    policyEngine: PolicyEngine,
    complianceService: ComplianceAutomationService,
    securityService: SecurityGovernanceService,
    qualityGatesService: QualityGatesService,
    monitoringService: MonitoringReportingService
  ) {
    super();
    this.config = config;
    this.policyEngine = policyEngine;
    this.complianceService = complianceService;
    this.securityService = securityService;
    this.qualityGatesService = qualityGatesService;
    this.monitoringService = monitoringService;

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeIntegrations();
  }

  /**
   * Start the API server
   */
  async start(port: number = 8080): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`Governance API server started on port ${port}`);
        this.emit('serverStarted', { port });
        resolve();
      });
    });
  }

  /**
   * Policy Engine API Endpoints
   */
  private setupPolicyRoutes(): void {
    const router = express.Router();

    // Evaluate policy
    router.post('/evaluate', async (req: Request, res: Response) => {
      try {
        const request = PolicyEvaluationRequestSchema.parse(req.body);
        const results = await this.policyEngine.evaluatePolicy(request.policyId, request.context);
        
        res.json(this.createSuccessResponse(results, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('POLICY_EVALUATION_FAILED', error.message, req));
      }
    });

    // Evaluate all applicable policies
    router.post('/evaluate-all', async (req: Request, res: Response) => {
      try {
        const context = req.body.context;
        const results = await this.policyEngine.evaluateAllPolicies(context);
        
        res.json(this.createSuccessResponse(results, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('POLICY_EVALUATION_FAILED', error.message, req));
      }
    });

    // List policies
    router.get('/', async (req: Request, res: Response) => {
      try {
        const policies = this.policyEngine.listPolicies();
        res.json(this.createSuccessResponse(policies, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('POLICY_LIST_FAILED', error.message, req));
      }
    });

    // Get policy by ID
    router.get('/:id', async (req: Request, res: Response) => {
      try {
        const policy = this.policyEngine.getPolicy(req.params.id);
        if (!policy) {
          return res.status(404).json(this.createErrorResponse('POLICY_NOT_FOUND', 'Policy not found', req));
        }
        res.json(this.createSuccessResponse(policy, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('POLICY_GET_FAILED', error.message, req));
      }
    });

    // Get evaluation metrics
    router.get('/metrics/evaluation', async (req: Request, res: Response) => {
      try {
        const metrics = this.policyEngine.getEvaluationMetrics();
        res.json(this.createSuccessResponse(metrics, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('METRICS_GET_FAILED', error.message, req));
      }
    });

    this.app.use(`${this.config.basePath}/${this.config.version}/policies`, router);
  }

  /**
   * Compliance API Endpoints
   */
  private setupComplianceRoutes(): void {
    const router = express.Router();

    // Perform compliance assessment
    router.post('/assessments', async (req: Request, res: Response) => {
      try {
        const request = ComplianceAssessmentRequestSchema.parse(req.body);
        const assessment = await this.complianceService.performAssessment(
          request.framework,
          request.scope || {}
        );
        
        res.json(this.createSuccessResponse(assessment, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('COMPLIANCE_ASSESSMENT_FAILED', error.message, req));
      }
    });

    // Get compliance dashboard
    router.get('/dashboard', async (req: Request, res: Response) => {
      try {
        const dashboard = await this.complianceService.getComplianceDashboard();
        res.json(this.createSuccessResponse(dashboard, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('DASHBOARD_GET_FAILED', error.message, req));
      }
    });

    // Generate compliance report
    router.post('/reports/:framework', async (req: Request, res: Response) => {
      try {
        const framework = req.params.framework as any;
        const reportType = req.query.type as 'executive' | 'detailed' | 'technical' || 'detailed';
        
        const report = await this.complianceService.generateComplianceReport(framework, reportType);
        res.json(this.createSuccessResponse(report, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('REPORT_GENERATION_FAILED', error.message, req));
      }
    });

    // Track audit event
    router.post('/audit-events', async (req: Request, res: Response) => {
      try {
        const eventId = await this.complianceService.trackAuditEvent(req.body);
        res.json(this.createSuccessResponse({ id: eventId }, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('AUDIT_EVENT_FAILED', error.message, req));
      }
    });

    this.app.use(`${this.config.basePath}/${this.config.version}/compliance`, router);
  }

  /**
   * Security API Endpoints
   */
  private setupSecurityRoutes(): void {
    const router = express.Router();

    // Perform security scan
    router.post('/scans', async (req: Request, res: Response) => {
      try {
        const request = SecurityScanRequestSchema.parse(req.body);
        const report = await this.securityService.scanForVulnerabilities(
          request.targetId,
          request.targetType,
          request.scanner
        );
        
        res.json(this.createSuccessResponse(report, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('SECURITY_SCAN_FAILED', error.message, req));
      }
    });

    // Scan container image
    router.post('/container-scan', async (req: Request, res: Response) => {
      try {
        const { image, tag, registry } = req.body;
        const profile = await this.securityService.scanContainerImage(image, tag, registry);
        
        res.json(this.createSuccessResponse(profile, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('CONTAINER_SCAN_FAILED', error.message, req));
      }
    });

    // Evaluate access
    router.post('/access/evaluate', async (req: Request, res: Response) => {
      try {
        const { subject, resource, action } = req.body;
        const result = await this.securityService.evaluateAccess(subject, resource, action);
        
        res.json(this.createSuccessResponse(result, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('ACCESS_EVALUATION_FAILED', error.message, req));
      }
    });

    // Get security dashboard
    router.get('/dashboard', async (req: Request, res: Response) => {
      try {
        const dashboard = await this.securityService.getSecurityDashboard();
        res.json(this.createSuccessResponse(dashboard, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('DASHBOARD_GET_FAILED', error.message, req));
      }
    });

    this.app.use(`${this.config.basePath}/${this.config.version}/security`, router);
  }

  /**
   * Quality Gates API Endpoints
   */
  private setupQualityGatesRoutes(): void {
    const router = express.Router();

    // Execute quality gate
    router.post('/execute', async (req: Request, res: Response) => {
      try {
        const request = QualityGateRequestSchema.parse(req.body);
        const execution = await this.qualityGatesService.executeQualityGate(
          request.gateId,
          request.targetId,
          request.targetType,
          request.context,
          request.triggeredBy
        );
        
        res.json(this.createSuccessResponse(execution, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('QUALITY_GATE_EXECUTION_FAILED', error.message, req));
      }
    });

    // Perform architecture review
    router.post('/architecture-review', async (req: Request, res: Response) => {
      try {
        const { targetId, reviewType, reviewers } = req.body;
        const review = await this.qualityGatesService.performArchitectureReview(
          targetId,
          reviewType,
          reviewers
        );
        
        res.json(this.createSuccessResponse(review, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('ARCHITECTURE_REVIEW_FAILED', error.message, req));
      }
    });

    // Validate performance standards
    router.post('/performance/validate', async (req: Request, res: Response) => {
      try {
        const { standardsId, targetId, environment } = req.body;
        const report = await this.qualityGatesService.validatePerformanceStandards(
          standardsId,
          targetId,
          environment
        );
        
        res.json(this.createSuccessResponse(report, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('PERFORMANCE_VALIDATION_FAILED', error.message, req));
      }
    });

    // Check documentation requirements
    router.post('/documentation/check', async (req: Request, res: Response) => {
      try {
        const { targetId, requirements } = req.body;
        const checks = await this.qualityGatesService.checkDocumentationRequirements(
          targetId,
          requirements
        );
        
        res.json(this.createSuccessResponse(checks, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('DOCUMENTATION_CHECK_FAILED', error.message, req));
      }
    });

    // Get quality gates dashboard
    router.get('/dashboard', async (req: Request, res: Response) => {
      try {
        const dashboard = await this.qualityGatesService.getQualityGatesDashboard();
        res.json(this.createSuccessResponse(dashboard, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('DASHBOARD_GET_FAILED', error.message, req));
      }
    });

    this.app.use(`${this.config.basePath}/${this.config.version}/quality-gates`, router);
  }

  /**
   * Monitoring API Endpoints
   */
  private setupMonitoringRoutes(): void {
    const router = express.Router();

    // Get dashboards
    router.get('/dashboards', async (req: Request, res: Response) => {
      try {
        const { category, audience } = req.query;
        const dashboards = await this.monitoringService.getDashboardsList(
          category as any,
          audience as any
        );
        res.json(this.createSuccessResponse(dashboards, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('DASHBOARDS_GET_FAILED', error.message, req));
      }
    });

    // Get dashboard by ID
    router.get('/dashboards/:id', async (req: Request, res: Response) => {
      try {
        const dashboard = await this.monitoringService.getDashboard(req.params.id);
        if (!dashboard) {
          return res.status(404).json(this.createErrorResponse('DASHBOARD_NOT_FOUND', 'Dashboard not found', req));
        }
        res.json(this.createSuccessResponse(dashboard, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('DASHBOARD_GET_FAILED', error.message, req));
      }
    });

    // Generate report
    router.post('/reports', async (req: Request, res: Response) => {
      try {
        const { type, format, filters } = req.body;
        const report = await this.monitoringService.generateReport(type, format, filters);
        
        res.json(this.createSuccessResponse(report, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('REPORT_GENERATION_FAILED', error.message, req));
      }
    });

    // Get governance metrics
    router.get('/metrics', async (req: Request, res: Response) => {
      try {
        const metrics = await this.monitoringService.collectGovernanceMetrics();
        res.json(this.createSuccessResponse(metrics, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('METRICS_GET_FAILED', error.message, req));
      }
    });

    // Get audit log
    router.get('/audit-log', async (req: Request, res: Response) => {
      try {
        const filters = {
          startDate: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
          endDate: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
          actor: req.query.actor as string,
          action: req.query.action as string,
          resource: req.query.resource as string,
          outcome: req.query.outcome as string
        };
        
        const pagination = {
          limit: parseInt(req.query.limit as string) || 100,
          offset: parseInt(req.query.offset as string) || 0
        };
        
        const result = await this.monitoringService.getAuditLog(filters, pagination);
        
        res.json(this.createPaginatedResponse(
          result.entries,
          pagination.limit,
          pagination.offset / pagination.limit + 1,
          result.total,
          req
        ));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('AUDIT_LOG_GET_FAILED', error.message, req));
      }
    });

    this.app.use(`${this.config.basePath}/${this.config.version}/monitoring`, router);
  }

  /**
   * Webhook Management
   */
  private setupWebhookRoutes(): void {
    const router = express.Router();

    // Register webhook
    router.post('/register', async (req: Request, res: Response) => {
      try {
        const webhook = WebhookConfigSchema.parse(req.body);
        this.webhooks.set(webhook.id, webhook);
        
        this.emit('webhookRegistered', webhook);
        res.json(this.createSuccessResponse({ id: webhook.id }, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('WEBHOOK_REGISTRATION_FAILED', error.message, req));
      }
    });

    // List webhooks
    router.get('/', async (req: Request, res: Response) => {
      try {
        const webhooks = Array.from(this.webhooks.values());
        res.json(this.createSuccessResponse(webhooks, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('WEBHOOKS_GET_FAILED', error.message, req));
      }
    });

    // Update webhook
    router.put('/:id', async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const existingWebhook = this.webhooks.get(id);
        
        if (!existingWebhook) {
          return res.status(404).json(this.createErrorResponse('WEBHOOK_NOT_FOUND', 'Webhook not found', req));
        }
        
        const updatedWebhook = WebhookConfigSchema.parse({ ...existingWebhook, ...req.body, id });
        this.webhooks.set(id, updatedWebhook);
        
        this.emit('webhookUpdated', updatedWebhook);
        res.json(this.createSuccessResponse(updatedWebhook, req));
      } catch (error) {
        res.status(400).json(this.createErrorResponse('WEBHOOK_UPDATE_FAILED', error.message, req));
      }
    });

    // Delete webhook
    router.delete('/:id', async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const webhook = this.webhooks.get(id);
        
        if (!webhook) {
          return res.status(404).json(this.createErrorResponse('WEBHOOK_NOT_FOUND', 'Webhook not found', req));
        }
        
        this.webhooks.delete(id);
        this.emit('webhookDeleted', { id });
        
        res.json(this.createSuccessResponse({ deleted: true }, req));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('WEBHOOK_DELETE_FAILED', error.message, req));
      }
    });

    this.app.use(`${this.config.basePath}/${this.config.version}/webhooks`, router);
  }

  /**
   * Health and Status Endpoints
   */
  private setupHealthRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: this.config.version,
        services: {
          policyEngine: 'healthy',
          compliance: 'healthy',
          security: 'healthy',
          qualityGates: 'healthy',
          monitoring: 'healthy'
        }
      });
    });

    // Readiness check
    this.app.get('/ready', (req: Request, res: Response) => {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    });

    // Version info
    this.app.get('/version', (req: Request, res: Response) => {
      res.json({
        version: this.config.version,
        api: 'governance-integration',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Webhook Event Delivery
   */
  async sendWebhookEvent(eventType: string, data: any): Promise<void> {
    const relevantWebhooks = Array.from(this.webhooks.values())
      .filter(webhook => webhook.active && webhook.events.includes(eventType));

    for (const webhook of relevantWebhooks) {
      try {
        await this.deliverWebhookEvent(webhook, {
          id: crypto.randomUUID(),
          type: eventType,
          source: 'governance-api',
          timestamp: new Date(),
          data,
          signature: webhook.secret ? this.generateWebhookSignature(data, webhook.secret) : undefined
        });
      } catch (error) {
        console.error(`Failed to deliver webhook ${webhook.id}:`, error);
        this.emit('webhookDeliveryFailed', { webhook, error });
      }
    }
  }

  /**
   * External Integration Management
   */
  async registerIntegration(integration: ExternalIntegration): Promise<void> {
    const validatedIntegration = ExternalIntegrationSchema.parse(integration);
    this.integrations.set(integration.id, validatedIntegration);
    this.emit('integrationRegistered', validatedIntegration);
  }

  async callExternalIntegration(
    integrationId: string,
    endpointName: string,
    data?: any
  ): Promise<any> {
    const integration = this.integrations.get(integrationId);
    if (!integration || !integration.enabled) {
      throw new Error(`Integration ${integrationId} not found or disabled`);
    }

    const endpoint = integration.endpoints.find(e => e.name === endpointName);
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointName} not found in integration ${integrationId}`);
    }

    // Make HTTP call to external system
    const response = await this.makeHttpRequest(endpoint, data, integration.credentials);
    return response;
  }

  // Private methods

  private setupMiddleware(): void {
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    if (this.config.cors.enabled) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', this.config.cors.origins.join(','));
        res.header('Access-Control-Allow-Methods', this.config.cors.methods.join(','));
        res.header('Access-Control-Allow-Headers', this.config.cors.headers.join(','));
        next();
      });
    }

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = crypto.randomUUID();
      req.headers['x-request-id'] = requestId;
      
      console.log(`${req.method} ${req.url} - Request ID: ${requestId}`);
      next();
    });

    // Authentication middleware
    if (this.config.authentication.required) {
      this.app.use(this.authenticationMiddleware.bind(this));
    }

    // Rate limiting
    this.app.use(this.rateLimitingMiddleware.bind(this));

    // Error handling
    this.app.use(this.errorHandlingMiddleware.bind(this));
  }

  private setupRoutes(): void {
    this.setupPolicyRoutes();
    this.setupComplianceRoutes();
    this.setupSecurityRoutes();
    this.setupQualityGatesRoutes();
    this.setupMonitoringRoutes();
    this.setupWebhookRoutes();
    this.setupHealthRoutes();
  }

  private authenticationMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip authentication for health endpoints
    if (req.path === '/health' || req.path === '/ready' || req.path === '/version') {
      return next();
    }

    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT token authentication
      const token = authHeader.substring(7);
      try {
        // Validate JWT token (implementation would verify signature, expiration, etc.)
        req.user = { id: 'user-from-token', roles: ['admin'] };
        next();
      } catch (error) {
        res.status(401).json(this.createErrorResponse('INVALID_TOKEN', 'Invalid JWT token', req));
      }
    } else if (apiKey) {
      // API key authentication
      const keyInfo = this.apiKeys.get(apiKey);
      if (keyInfo && keyInfo.active) {
        req.user = { id: keyInfo.name, roles: keyInfo.scopes };
        next();
      } else {
        res.status(401).json(this.createErrorResponse('INVALID_API_KEY', 'Invalid API key', req));
      }
    } else {
      res.status(401).json(this.createErrorResponse('MISSING_AUTH', 'Authentication required', req));
    }
  }

  private rateLimitingMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Simple in-memory rate limiting (in production, use Redis)
    const clientId = req.ip || req.headers['x-forwarded-for'] as string;
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.windowMs;
    
    // Clean up old entries
    // Implementation would track requests per client and enforce limits
    
    next();
  }

  private errorHandlingMiddleware(error: Error, req: Request, res: Response, next: NextFunction): void {
    console.error('API Error:', error);
    
    if (res.headersSent) {
      return next(error);
    }
    
    res.status(500).json(this.createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      req
    ));
  }

  private createSuccessResponse<T>(data: T, req: Request): APIResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: this.config.version
      }
    };
  }

  private createErrorResponse(code: string, message: string, req: Request, details?: any): APIResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: this.config.version
      }
    };
  }

  private createPaginatedResponse<T>(
    data: T[],
    limit: number,
    page: number,
    total: number,
    req: Request
  ): PaginatedResponse<T> {
    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: this.config.version
      }
    };
  }

  private async deliverWebhookEvent(webhook: WebhookConfig, event: WebhookEvent): Promise<void> {
    const axios = require('axios');
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Governance-Webhook/1.0',
      ...webhook.headers
    };

    if (event.signature) {
      headers['X-Governance-Signature'] = event.signature;
    }

    await axios.post(webhook.url, event, {
      headers,
      timeout: webhook.timeout
    });
  }

  private generateWebhookSignature(data: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(data));
    return `sha256=${hmac.digest('hex')}`;
  }

  private async makeHttpRequest(
    endpoint: ExternalIntegration['endpoints'][0],
    data: any,
    credentials: Record<string, string>
  ): Promise<any> {
    const axios = require('axios');
    
    const headers = {
      'Content-Type': 'application/json',
      ...endpoint.headers
    };

    // Add authentication headers based on credentials
    if (credentials.token) {
      headers['Authorization'] = `Bearer ${credentials.token}`;
    }
    if (credentials.apiKey) {
      headers['X-API-Key'] = credentials.apiKey;
    }

    const config = {
      method: endpoint.method,
      url: endpoint.url,
      headers,
      timeout: endpoint.timeout,
      data: endpoint.method !== 'GET' ? data : undefined,
      params: endpoint.method === 'GET' ? data : undefined
    };

    const response = await axios(config);
    return response.data;
  }

  private initializeIntegrations(): void {
    // Initialize default API keys
    this.apiKeys.set('governance-admin-key', {
      name: 'governance-admin',
      scopes: ['admin', 'read', 'write'],
      active: true
    });

    this.apiKeys.set('governance-read-key', {
      name: 'governance-readonly',
      scopes: ['read'],
      active: true
    });

    // Set up event listeners for webhook delivery
    this.policyEngine.on('policyLoaded', (policy) => {
      this.sendWebhookEvent('policy.loaded', { policy });
    });

    this.complianceService.on('assessmentCompleted', (assessment) => {
      this.sendWebhookEvent('compliance.assessment.completed', { assessment });
    });

    this.securityService.on('vulnerabilityScanCompleted', (report) => {
      this.sendWebhookEvent('security.scan.completed', { report });
    });

    this.qualityGatesService.on('qualityGateCompleted', (execution) => {
      this.sendWebhookEvent('quality-gate.completed', { execution });
    });

    this.monitoringService.on('alertCreated', (alert) => {
      this.sendWebhookEvent('monitoring.alert.created', { alert });
    });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        roles: string[];
      };
    }
  }
}