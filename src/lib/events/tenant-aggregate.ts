/**
 * Tenant Aggregate with Event Sourcing
 * Domain model for tenant lifecycle management
 */

import { AggregateRoot, DomainEvent, EventSourcedRepository, Snapshot } from './event-store';

// Tenant Events
export interface TenantCreatedEvent {
  tenantId: string;
  name: string;
  slug: string;
  adminEmail: string;
  subscriptionPlan: string;
  settings: TenantSettings;
  createdAt: Date;
}

export interface TenantSubscriptionChangedEvent {
  tenantId: string;
  oldPlan: string;
  newPlan: string;
  effectiveDate: Date;
  prorationAmount?: number;
}

export interface TenantConfigurationUpdatedEvent {
  tenantId: string;
  configuration: Partial<TenantConfiguration>;
  updatedBy: string;
  updatedAt: Date;
}

export interface TenantPluginInstalledEvent {
  tenantId: string;
  pluginId: string;
  pluginName: string;
  version: string;
  installedBy: string;
  installedAt: Date;
  dependencies: string[];
}

export interface TenantPluginUninstalledEvent {
  tenantId: string;
  pluginId: string;
  uninstalledBy: string;
  uninstalledAt: Date;
  reason?: string;
}

export interface TenantLimitsUpdatedEvent {
  tenantId: string;
  oldLimits: TenantLimits;
  newLimits: TenantLimits;
  reason: string;
  updatedAt: Date;
}

export interface TenantSuspendedEvent {
  tenantId: string;
  reason: string;
  suspendedBy: string;
  suspendedAt: Date;
  autoResumeAt?: Date;
}

export interface TenantResumedEvent {
  tenantId: string;
  resumedBy: string;
  resumedAt: Date;
  reason?: string;
}

export interface TenantDeletedEvent {
  tenantId: string;
  deletedBy: string;
  deletedAt: Date;
  reason: string;
  dataRetentionDays: number;
}

// Domain Types
export interface TenantSettings {
  timeZone: string;
  locale: string;
  theme: 'light' | 'dark' | 'auto';
  features: string[];
  integrations: Record<string, any>;
}

export interface TenantConfiguration {
  authProvider: string;
  ssoSettings?: Record<string, any>;
  customDomain?: string;
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  notifications: {
    email: boolean;
    slack: boolean;
    webhook?: string;
  };
}

export interface TenantLimits {
  maxUsers: number;
  maxProjects: number;
  maxPlugins: number;
  storageGb: number;
  computeHours: number;
  apiCallsPerMonth: number;
}

export interface InstalledPlugin {
  pluginId: string;
  pluginName: string;
  version: string;
  installedAt: Date;
  installedBy: string;
  status: 'active' | 'inactive' | 'error';
  dependencies: string[];
  configuration?: Record<string, any>;
}

export type TenantStatus = 'active' | 'suspended' | 'deleted' | 'provisioning';

/**
 * Tenant Aggregate Root
 */
export class TenantAggregate extends AggregateRoot {
  private name: string = '';
  private slug: string = '';
  private adminEmail: string = '';
  private status: TenantStatus = 'provisioning';
  private subscriptionPlan: string = '';
  private settings: TenantSettings = {
    timeZone: 'UTC',
    locale: 'en-US',
    theme: 'light',
    features: [],
    integrations: {}
  };
  private configuration: TenantConfiguration = {
    authProvider: 'local',
    branding: {},
    notifications: {
      email: true,
      slack: false
    }
  };
  private limits: TenantLimits = {
    maxUsers: 10,
    maxProjects: 5,
    maxPlugins: 10,
    storageGb: 10,
    computeHours: 100,
    apiCallsPerMonth: 10000
  };
  private installedPlugins: Map<string, InstalledPlugin> = new Map();
  private createdAt?: Date;
  private updatedAt?: Date;
  private suspendedAt?: Date;
  private deletedAt?: Date;

  constructor(id: string) {
    super(id);
  }

  // Getters
  getName(): string { return this.name; }
  getSlug(): string { return this.slug; }
  getAdminEmail(): string { return this.adminEmail; }
  getStatus(): TenantStatus { return this.status; }
  getSubscriptionPlan(): string { return this.subscriptionPlan; }
  getSettings(): TenantSettings { return { ...this.settings }; }
  getConfiguration(): TenantConfiguration { return { ...this.configuration }; }
  getLimits(): TenantLimits { return { ...this.limits }; }
  getInstalledPlugins(): InstalledPlugin[] { return Array.from(this.installedPlugins.values()); }
  getCreatedAt(): Date | undefined { return this.createdAt; }
  getUpdatedAt(): Date | undefined { return this.updatedAt; }

  // Commands
  static create(
    tenantId: string,
    name: string,
    slug: string,
    adminEmail: string,
    subscriptionPlan: string,
    settings: Partial<TenantSettings> = {},
    metadata?: any
  ): TenantAggregate {
    const tenant = new TenantAggregate(tenantId);
    
    tenant.raiseEvent('TenantCreated', {
      tenantId,
      name,
      slug,
      adminEmail,
      subscriptionPlan,
      settings: { ...tenant.settings, ...settings },
      createdAt: new Date()
    } as TenantCreatedEvent, metadata);

    return tenant;
  }

  changeSubscription(
    newPlan: string,
    effectiveDate: Date,
    prorationAmount?: number,
    metadata?: any
  ): void {
    if (this.status !== 'active') {
      throw new Error('Cannot change subscription for inactive tenant');
    }

    if (this.subscriptionPlan === newPlan) {
      throw new Error('New plan is the same as current plan');
    }

    this.raiseEvent('TenantSubscriptionChanged', {
      tenantId: this.id,
      oldPlan: this.subscriptionPlan,
      newPlan,
      effectiveDate,
      prorationAmount
    } as TenantSubscriptionChangedEvent, metadata);
  }

  updateConfiguration(
    configuration: Partial<TenantConfiguration>,
    updatedBy: string,
    metadata?: any
  ): void {
    if (this.status === 'deleted') {
      throw new Error('Cannot update configuration for deleted tenant');
    }

    this.raiseEvent('TenantConfigurationUpdated', {
      tenantId: this.id,
      configuration,
      updatedBy,
      updatedAt: new Date()
    } as TenantConfigurationUpdatedEvent, metadata);
  }

  installPlugin(
    pluginId: string,
    pluginName: string,
    version: string,
    installedBy: string,
    dependencies: string[] = [],
    metadata?: any
  ): void {
    if (this.status !== 'active') {
      throw new Error('Cannot install plugins for inactive tenant');
    }

    if (this.installedPlugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is already installed`);
    }

    if (this.installedPlugins.size >= this.limits.maxPlugins) {
      throw new Error('Plugin installation limit exceeded');
    }

    this.raiseEvent('TenantPluginInstalled', {
      tenantId: this.id,
      pluginId,
      pluginName,
      version,
      installedBy,
      installedAt: new Date(),
      dependencies
    } as TenantPluginInstalledEvent, metadata);
  }

  uninstallPlugin(
    pluginId: string,
    uninstalledBy: string,
    reason?: string,
    metadata?: any
  ): void {
    if (!this.installedPlugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }

    // Check if other plugins depend on this one
    const dependentPlugins = Array.from(this.installedPlugins.values())
      .filter(plugin => plugin.dependencies.includes(pluginId));

    if (dependentPlugins.length > 0) {
      throw new Error(`Cannot uninstall plugin ${pluginId}: it is required by ${dependentPlugins.map(p => p.pluginId).join(', ')}`);
    }

    this.raiseEvent('TenantPluginUninstalled', {
      tenantId: this.id,
      pluginId,
      uninstalledBy,
      uninstalledAt: new Date(),
      reason
    } as TenantPluginUninstalledEvent, metadata);
  }

  updateLimits(
    newLimits: Partial<TenantLimits>,
    reason: string,
    metadata?: any
  ): void {
    if (this.status === 'deleted') {
      throw new Error('Cannot update limits for deleted tenant');
    }

    const updatedLimits = { ...this.limits, ...newLimits };

    // Validate limits don't violate current usage
    if (updatedLimits.maxPlugins < this.installedPlugins.size) {
      throw new Error('New plugin limit is less than currently installed plugins');
    }

    this.raiseEvent('TenantLimitsUpdated', {
      tenantId: this.id,
      oldLimits: { ...this.limits },
      newLimits: updatedLimits,
      reason,
      updatedAt: new Date()
    } as TenantLimitsUpdatedEvent, metadata);
  }

  suspend(reason: string, suspendedBy: string, autoResumeAt?: Date, metadata?: any): void {
    if (this.status !== 'active') {
      throw new Error('Can only suspend active tenants');
    }

    this.raiseEvent('TenantSuspended', {
      tenantId: this.id,
      reason,
      suspendedBy,
      suspendedAt: new Date(),
      autoResumeAt
    } as TenantSuspendedEvent, metadata);
  }

  resume(resumedBy: string, reason?: string, metadata?: any): void {
    if (this.status !== 'suspended') {
      throw new Error('Can only resume suspended tenants');
    }

    this.raiseEvent('TenantResumed', {
      tenantId: this.id,
      resumedBy,
      resumedAt: new Date(),
      reason
    } as TenantResumedEvent, metadata);
  }

  delete(deletedBy: string, reason: string, dataRetentionDays = 30, metadata?: any): void {
    if (this.status === 'deleted') {
      throw new Error('Tenant is already deleted');
    }

    this.raiseEvent('TenantDeleted', {
      tenantId: this.id,
      deletedBy,
      deletedAt: new Date(),
      reason,
      dataRetentionDays
    } as TenantDeletedEvent, metadata);
  }

  // Event Application
  protected apply(event: DomainEvent): void {
    switch (event.eventType) {
      case 'TenantCreated':
        this.applyTenantCreated(event.data as TenantCreatedEvent);
        break;
      case 'TenantSubscriptionChanged':
        this.applyTenantSubscriptionChanged(event.data as TenantSubscriptionChangedEvent);
        break;
      case 'TenantConfigurationUpdated':
        this.applyTenantConfigurationUpdated(event.data as TenantConfigurationUpdatedEvent);
        break;
      case 'TenantPluginInstalled':
        this.applyTenantPluginInstalled(event.data as TenantPluginInstalledEvent);
        break;
      case 'TenantPluginUninstalled':
        this.applyTenantPluginUninstalled(event.data as TenantPluginUninstalledEvent);
        break;
      case 'TenantLimitsUpdated':
        this.applyTenantLimitsUpdated(event.data as TenantLimitsUpdatedEvent);
        break;
      case 'TenantSuspended':
        this.applyTenantSuspended(event.data as TenantSuspendedEvent);
        break;
      case 'TenantResumed':
        this.applyTenantResumed(event.data as TenantResumedEvent);
        break;
      case 'TenantDeleted':
        this.applyTenantDeleted(event.data as TenantDeletedEvent);
        break;
      default:
        console.warn(`Unknown event type: ${event.eventType}`);
    }
    
    this.updatedAt = event.timestamp;
  }

  private applyTenantCreated(event: TenantCreatedEvent): void {
    this.name = event.name;
    this.slug = event.slug;
    this.adminEmail = event.adminEmail;
    this.subscriptionPlan = event.subscriptionPlan;
    this.settings = event.settings;
    this.status = 'active';
    this.createdAt = event.createdAt;
  }

  private applyTenantSubscriptionChanged(event: TenantSubscriptionChangedEvent): void {
    this.subscriptionPlan = event.newPlan;
    // Update limits based on new plan (would be handled by a separate service in practice)
  }

  private applyTenantConfigurationUpdated(event: TenantConfigurationUpdatedEvent): void {
    this.configuration = { ...this.configuration, ...event.configuration };
  }

  private applyTenantPluginInstalled(event: TenantPluginInstalledEvent): void {
    this.installedPlugins.set(event.pluginId, {
      pluginId: event.pluginId,
      pluginName: event.pluginName,
      version: event.version,
      installedAt: event.installedAt,
      installedBy: event.installedBy,
      status: 'active',
      dependencies: event.dependencies
    });
  }

  private applyTenantPluginUninstalled(event: TenantPluginUninstalledEvent): void {
    this.installedPlugins.delete(event.pluginId);
  }

  private applyTenantLimitsUpdated(event: TenantLimitsUpdatedEvent): void {
    this.limits = event.newLimits;
  }

  private applyTenantSuspended(event: TenantSuspendedEvent): void {
    this.status = 'suspended';
    this.suspendedAt = event.suspendedAt;
  }

  private applyTenantResumed(event: TenantResumedEvent): void {
    this.status = 'active';
    this.suspendedAt = undefined;
  }

  private applyTenantDeleted(event: TenantDeletedEvent): void {
    this.status = 'deleted';
    this.deletedAt = event.deletedAt;
  }

  // State snapshot for performance
  toSnapshot(): any {
    return {
      id: this.id,
      version: this.version,
      name: this.name,
      slug: this.slug,
      adminEmail: this.adminEmail,
      status: this.status,
      subscriptionPlan: this.subscriptionPlan,
      settings: this.settings,
      configuration: this.configuration,
      limits: this.limits,
      installedPlugins: Array.from(this.installedPlugins.entries()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      suspendedAt: this.suspendedAt,
      deletedAt: this.deletedAt
    };
  }

  static fromSnapshot(snapshot: any): TenantAggregate {
    const tenant = new TenantAggregate(snapshot.id);
    tenant.version = snapshot.version;
    tenant.name = snapshot.name;
    tenant.slug = snapshot.slug;
    tenant.adminEmail = snapshot.adminEmail;
    tenant.status = snapshot.status;
    tenant.subscriptionPlan = snapshot.subscriptionPlan;
    tenant.settings = snapshot.settings;
    tenant.configuration = snapshot.configuration;
    tenant.limits = snapshot.limits;
    tenant.installedPlugins = new Map(snapshot.installedPlugins);
    tenant.createdAt = snapshot.createdAt;
    tenant.updatedAt = snapshot.updatedAt;
    tenant.suspendedAt = snapshot.suspendedAt;
    tenant.deletedAt = snapshot.deletedAt;
    return tenant;
  }
}

/**
 * Tenant Repository
 */
export class TenantRepository extends EventSourcedRepository<TenantAggregate> {
  constructor() {
    super(require('./event-store').eventStore, 'TenantAggregate');
  }

  protected createEmpty(id: string): TenantAggregate {
    return new TenantAggregate(id);
  }

  protected createFromSnapshot(snapshot: Snapshot): TenantAggregate {
    return TenantAggregate.fromSnapshot(snapshot.data);
  }

  async saveSnapshot(tenant: TenantAggregate): Promise<void> {
    await this.eventStore.saveSnapshot({
      aggregateId: tenant.getId(),
      aggregateType: this.aggregateType,
      version: tenant.getVersion(),
      data: tenant.toSnapshot()
    });
  }
}

export default TenantAggregate;