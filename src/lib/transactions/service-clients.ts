/**
 * Service Clients for Saga Orchestration
 * Implements service interfaces for distributed transaction steps
 */

export interface ServiceClient {
  serviceName: string;
  baseUrl: string;
  timeout: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    baseDelay: number;
  };
}

export interface ServiceContext {
  tenantId: string;
  sagaExecutionId: string;
  stepId: string;
  stepResults?: Record<string, any>;
  [key: string]: any;
}

/**
 * Base Service Client with common functionality
 */
abstract class BaseServiceClient implements ServiceClient {
  public serviceName: string;
  public baseUrl: string;
  public timeout: number;

  constructor(serviceName: string, baseUrl: string, timeout = 30000) {
    this.serviceName = serviceName;
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  protected async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    data?: any,
    headers: Record<string, string> = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const options: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(this.timeout)
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Service ${this.serviceName} request failed: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * Tenant Service Client
 */
export class TenantServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/tenants') {
    super('tenant-service', baseUrl);
  }

  async validateTenantData(context: ServiceContext): Promise<{ valid: boolean; tenantId: string }> {
    return this.makeRequest('/validate', 'POST', {
      tenantData: context.tenantData,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async cleanupValidation(context: ServiceContext): Promise<void> {
    return this.makeRequest('/validate/cleanup', 'POST', {
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async updateTenantLimits(context: ServiceContext): Promise<{ updated: boolean }> {
    return this.makeRequest(`/${context.tenantId}/limits`, 'PUT', {
      limits: context.newLimits,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async revertTenantLimits(context: ServiceContext): Promise<void> {
    return this.makeRequest(`/${context.tenantId}/limits/revert`, 'POST', {
      sagaExecutionId: context.sagaExecutionId,
      originalLimits: context.originalLimits
    });
  }
}

/**
 * Database Service Client
 */
export class DatabaseServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/database') {
    super('database-service', baseUrl);
  }

  async createTenantSchema(context: ServiceContext): Promise<{ schemaCreated: boolean; schemaName: string }> {
    return this.makeRequest('/schema/create', 'POST', {
      tenantId: context.tenantId,
      schemaTemplate: context.schemaTemplate,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async dropTenantSchema(context: ServiceContext): Promise<void> {
    return this.makeRequest('/schema/drop', 'POST', {
      tenantId: context.tenantId,
      schemaName: context.originalResult?.schemaName,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async createPluginSchema(context: ServiceContext): Promise<{ schemaCreated: boolean; tableName: string }> {
    return this.makeRequest('/plugin-schema/create', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      schemaDefinition: context.pluginSchema,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async dropPluginSchema(context: ServiceContext): Promise<void> {
    return this.makeRequest('/plugin-schema/drop', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      tableName: context.originalResult?.tableName,
      sagaExecutionId: context.sagaExecutionId
    });
  }
}

/**
 * Authentication Service Client
 */
export class AuthServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/auth') {
    super('auth-service', baseUrl);
  }

  async createTenantAuthConfig(context: ServiceContext): Promise<{ configCreated: boolean; configId: string }> {
    return this.makeRequest('/tenant-config/create', 'POST', {
      tenantId: context.tenantId,
      authSettings: context.authSettings,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async removeTenantAuthConfig(context: ServiceContext): Promise<void> {
    return this.makeRequest('/tenant-config/remove', 'POST', {
      tenantId: context.tenantId,
      configId: context.originalResult?.configId,
      sagaExecutionId: context.sagaExecutionId
    });
  }
}

/**
 * Billing Service Client
 */
export class BillingServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/billing') {
    super('billing-service', baseUrl);
  }

  async createBillingAccount(context: ServiceContext): Promise<{ accountCreated: boolean; accountId: string }> {
    return this.makeRequest('/account/create', 'POST', {
      tenantId: context.tenantId,
      billingDetails: context.billingDetails,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async deleteBillingAccount(context: ServiceContext): Promise<void> {
    return this.makeRequest('/account/delete', 'POST', {
      tenantId: context.tenantId,
      accountId: context.originalResult?.accountId,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async checkPluginInstallationLimits(context: ServiceContext): Promise<{ allowed: boolean; remainingQuota: number }> {
    return this.makeRequest('/limits/plugin-installation', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async releaseLimitCheck(context: ServiceContext): Promise<void> {
    return this.makeRequest('/limits/release', 'POST', {
      tenantId: context.tenantId,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async recordPluginInstallation(context: ServiceContext): Promise<{ recorded: boolean; usageId: string }> {
    return this.makeRequest('/usage/plugin-installation', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      installationCost: context.installationCost,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async removePluginFromBilling(context: ServiceContext): Promise<void> {
    return this.makeRequest('/usage/plugin-removal', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      usageId: context.originalResult?.usageId,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async validateSubscriptionChange(context: ServiceContext): Promise<{ valid: boolean; changeId: string }> {
    return this.makeRequest('/subscription/validate-change', 'POST', {
      tenantId: context.tenantId,
      currentPlan: context.currentPlan,
      targetPlan: context.targetPlan,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async logValidationFailure(context: ServiceContext): Promise<void> {
    return this.makeRequest('/logs/validation-failure', 'POST', {
      tenantId: context.tenantId,
      sagaExecutionId: context.sagaExecutionId,
      error: context.error
    });
  }

  async calculateProration(context: ServiceContext): Promise<{ amount: number; adjustmentId: string }> {
    return this.makeRequest('/subscription/calculate-proration', 'POST', {
      tenantId: context.tenantId,
      currentPlan: context.currentPlan,
      targetPlan: context.targetPlan,
      changeDate: context.changeDate,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async clearProrationCalculation(context: ServiceContext): Promise<void> {
    return this.makeRequest('/subscription/clear-proration', 'POST', {
      tenantId: context.tenantId,
      adjustmentId: context.originalResult?.adjustmentId,
      sagaExecutionId: context.sagaExecutionId
    });
  }
}

/**
 * Plugin Service Client
 */
export class PluginServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/plugins') {
    super('plugin-service', baseUrl);
  }

  async validateInstallationRequest(context: ServiceContext): Promise<{ valid: boolean; requestId: string }> {
    return this.makeRequest('/validate-installation', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      version: context.version,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async logValidationFailure(context: ServiceContext): Promise<void> {
    return this.makeRequest('/logs/validation-failure', 'POST', {
      tenantId: context.tenantId,
      sagaExecutionId: context.sagaExecutionId,
      error: context.error
    });
  }

  async resolveDependencies(context: ServiceContext): Promise<{ dependencies: string[]; resolutionId: string }> {
    return this.makeRequest('/resolve-dependencies', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      version: context.version,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async cleanupDependencyResolution(context: ServiceContext): Promise<void> {
    return this.makeRequest('/cleanup-dependencies', 'POST', {
      tenantId: context.tenantId,
      resolutionId: context.originalResult?.resolutionId,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async downloadPluginArtifacts(context: ServiceContext): Promise<{ downloaded: boolean; artifactPath: string }> {
    return this.makeRequest('/download-artifacts', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      version: context.version,
      dependencies: context.stepResults?.['resolve-dependencies']?.dependencies,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async deleteDownloadedArtifacts(context: ServiceContext): Promise<void> {
    return this.makeRequest('/cleanup-artifacts', 'POST', {
      tenantId: context.tenantId,
      artifactPath: context.originalResult?.artifactPath,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async configurePlugin(context: ServiceContext): Promise<{ configured: boolean; configId: string }> {
    return this.makeRequest('/configure', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      configuration: context.pluginConfiguration,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async removePluginConfiguration(context: ServiceContext): Promise<void> {
    return this.makeRequest('/remove-configuration', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      configId: context.originalResult?.configId,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async installDefaultPlugins(context: ServiceContext): Promise<{ installed: string[]; installId: string }> {
    return this.makeRequest('/install-defaults', 'POST', {
      tenantId: context.tenantId,
      defaultPlugins: context.defaultPlugins,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async uninstallDefaultPlugins(context: ServiceContext): Promise<void> {
    return this.makeRequest('/uninstall-defaults', 'POST', {
      tenantId: context.tenantId,
      installId: context.originalResult?.installId,
      installedPlugins: context.originalResult?.installed,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async adjustPluginAccess(context: ServiceContext): Promise<{ adjusted: boolean; adjustmentId: string }> {
    return this.makeRequest('/adjust-access', 'POST', {
      tenantId: context.tenantId,
      newLimits: context.newLimits,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async revertPluginAccess(context: ServiceContext): Promise<void> {
    return this.makeRequest('/revert-access', 'POST', {
      tenantId: context.tenantId,
      adjustmentId: context.originalResult?.adjustmentId,
      originalLimits: context.originalLimits,
      sagaExecutionId: context.sagaExecutionId
    });
  }
}

/**
 * Monitoring Service Client
 */
export class MonitoringServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/monitoring') {
    super('monitoring-service', baseUrl);
  }

  async setupTenantMonitoring(context: ServiceContext): Promise<{ setup: boolean; monitoringId: string }> {
    return this.makeRequest('/tenant/setup', 'POST', {
      tenantId: context.tenantId,
      monitoringConfig: context.monitoringConfig,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async removeTenantMonitoring(context: ServiceContext): Promise<void> {
    return this.makeRequest('/tenant/remove', 'POST', {
      tenantId: context.tenantId,
      monitoringId: context.originalResult?.monitoringId,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async updateMonitoringQuotas(context: ServiceContext): Promise<{ updated: boolean }> {
    return this.makeRequest('/quotas/update', 'POST', {
      tenantId: context.tenantId,
      newQuotas: context.newQuotas,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async revertMonitoringQuotas(context: ServiceContext): Promise<void> {
    return this.makeRequest('/quotas/revert', 'POST', {
      tenantId: context.tenantId,
      originalQuotas: context.originalQuotas,
      sagaExecutionId: context.sagaExecutionId
    });
  }
}

/**
 * Notification Service Client
 */
export class NotificationServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/notifications') {
    super('notification-service', baseUrl);
  }

  async sendWelcomeEmail(context: ServiceContext): Promise<{ sent: boolean; messageId: string }> {
    return this.makeRequest('/welcome', 'POST', {
      tenantId: context.tenantId,
      userEmail: context.userEmail,
      tenantName: context.tenantName,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async notifyPluginInstalled(context: ServiceContext): Promise<{ sent: boolean; messageId: string }> {
    return this.makeRequest('/plugin-installed', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      pluginName: context.pluginName,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async sendSubscriptionChangeNotification(context: ServiceContext): Promise<{ sent: boolean; messageId: string }> {
    return this.makeRequest('/subscription-change', 'POST', {
      tenantId: context.tenantId,
      oldPlan: context.oldPlan,
      newPlan: context.newPlan,
      effectiveDate: context.effectiveDate,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async logNotificationFailure(context: ServiceContext): Promise<void> {
    return this.makeRequest('/logs/failure', 'POST', {
      tenantId: context.tenantId,
      sagaExecutionId: context.sagaExecutionId,
      error: context.error,
      notificationType: context.notificationType
    });
  }
}

/**
 * Gateway Service Client
 */
export class GatewayServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/gateway') {
    super('gateway-service', baseUrl);
  }

  async registerPluginRoutes(context: ServiceContext): Promise<{ registered: boolean; routeId: string }> {
    return this.makeRequest('/routes/register', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      routes: context.pluginRoutes,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async unregisterPluginRoutes(context: ServiceContext): Promise<void> {
    return this.makeRequest('/routes/unregister', 'POST', {
      tenantId: context.tenantId,
      pluginId: context.pluginId,
      routeId: context.originalResult?.routeId,
      sagaExecutionId: context.sagaExecutionId
    });
  }
}

/**
 * Payment Service Client
 */
export class PaymentServiceClient extends BaseServiceClient {
  constructor(baseUrl = '/api/payments') {
    super('payment-service', baseUrl);
  }

  async processSubscriptionPayment(context: ServiceContext): Promise<{ processed: boolean; transactionId: string }> {
    return this.makeRequest('/subscription/process', 'POST', {
      tenantId: context.tenantId,
      amount: context.prorationAmount,
      description: context.paymentDescription,
      sagaExecutionId: context.sagaExecutionId
    });
  }

  async refundPaymentAdjustment(context: ServiceContext): Promise<void> {
    return this.makeRequest('/subscription/refund', 'POST', {
      tenantId: context.tenantId,
      transactionId: context.originalResult?.transactionId,
      refundReason: 'Subscription change failed',
      sagaExecutionId: context.sagaExecutionId
    });
  }
}

/**
 * Service Client Registry
 */
export class ServiceClientRegistry {
  private clients: Map<string, BaseServiceClient> = new Map();

  registerClient(serviceName: string, client: BaseServiceClient): void {
    this.clients.set(serviceName, client);
  }

  getClient(serviceName: string): BaseServiceClient | undefined {
    return this.clients.get(serviceName);
  }

  getAllClients(): Map<string, BaseServiceClient> {
    return new Map(this.clients);
  }
}

// Global service client registry
export const serviceClientRegistry = new ServiceClientRegistry();

// Register default clients
serviceClientRegistry.registerClient('tenant-service', new TenantServiceClient());
serviceClientRegistry.registerClient('database-service', new DatabaseServiceClient());
serviceClientRegistry.registerClient('auth-service', new AuthServiceClient());
serviceClientRegistry.registerClient('billing-service', new BillingServiceClient());
serviceClientRegistry.registerClient('plugin-service', new PluginServiceClient());
serviceClientRegistry.registerClient('monitoring-service', new MonitoringServiceClient());
serviceClientRegistry.registerClient('notification-service', new NotificationServiceClient());
serviceClientRegistry.registerClient('gateway-service', new GatewayServiceClient());
serviceClientRegistry.registerClient('payment-service', new PaymentServiceClient());

export default serviceClientRegistry;